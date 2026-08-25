import { PackageLoader } from './package-loader/index.js';
import { Renderer } from './renderer/index.js';
import { Sandbox } from './sandbox/index.js';
import { StateManager } from './state-manager/index.js';
import { SessionManager } from './session-manager/index.js';
import { CacheManager } from './cache/index.js';
import { SecurityManager } from './security/index.js';
import { EventBus } from './events/index.js';
import { ExtensionManager } from './extensions/index.js';
import { Monitor } from './monitoring/index.js';
import { version } from './version.js';

const DEFAULT_OPTIONS = {
  container: null,
  permissions: ['storage', 'media'],
  maxCacheSize: 50 * 1024 * 1024,
  sessionTimeout: 30 * 60 * 1000,
  sandbox: {
    allowAudio: true,
    allowVideo: true,
    allowCanvas: true,
    allowStorage: true,
    maxExecutionTime: 10000,
    maxMemory: 128 * 1024 * 1024
  },
  renderer: {
    iframeAttributes: {
      sandbox: 'allow-scripts allow-same-origin',
      loading: 'lazy'
    }
  },
  performance: {
    enableMonitoring: true,
    sampleRate: 0.1
  },
  bridge: null
};

export class Runtime {
  constructor(options = {}) {
    this._options = this._mergeOptions(DEFAULT_OPTIONS, options);
    this._state = 'created';
    this._currentPackage = null;
    this._error = null;

    this._eventBus = new EventBus();
    this._cache = new CacheManager({ maxSize: this._options.maxCacheSize });
    this._security = new SecurityManager(this._options);
    this._stateManager = new StateManager({ eventBus: this._eventBus });
    this._sessionManager = new SessionManager({
      timeout: this._options.sessionTimeout,
      stateManager: this._stateManager,
      eventBus: this._eventBus
    });
    this._packageLoader = new PackageLoader({
      cache: this._cache,
      security: this._security,
      eventBus: this._eventBus
    });
    this._monitor = new Monitor({
      enabled: this._options.performance.enableMonitoring,
      sampleRate: this._options.performance.sampleRate,
      eventBus: this._eventBus
    });
    this._sandbox = new Sandbox({
      security: this._security,
      eventBus: this._eventBus,
      monitor: this._monitor,
      ...this._options.sandbox
    });
    this._renderer = new Renderer({
      container: this._options.container,
      sandbox: this._sandbox,
      security: this._security,
      eventBus: this._eventBus,
      monitor: this._monitor,
      ...this._options.renderer
    });
    this._extensionManager = new ExtensionManager({
      eventBus: this._eventBus,
      runtime: this
    });

    this._initLifecycle();
  }

  get state() { return this._state; }
  get version() { return version; }
  get currentPackage() { return this._currentPackage; }
  get eventBus() { return this._eventBus; }
  get monitor() { return this._monitor; }
  get sandbox() { return this._sandbox; }
  get renderer() { return this._renderer; }
  get stateManager() { return this._stateManager; }
  get sessionManager() { return this._sessionManager; }
  get extensionManager() { return this._extensionManager; }

  async load(packageSource) {
    this._assertState('created', 'idle');
    this._setState('loading');

    try {
      this._monitor?.startMark('load');

      const pkg = await this._packageLoader.load(packageSource);

      this._security.validatePackage(pkg);

      this._currentPackage = pkg;
      this._stateManager.initialize(pkg);

      this._monitor?.endMark('load');

      this._setState('loaded');
      this._eventBus.emit('package:loaded', { package: pkg });
      return pkg;
    } catch (err) {
      this._handleError('load', err);
      throw err;
    }
  }

  async start(sessionId) {
    this._assertState('loaded');
    this._setState('starting');

    try {
      this._monitor?.startMark('start');

      let session;
      if (sessionId) {
        session = await this._sessionManager.restore(sessionId);
        if (session) {
          this._stateManager.restore(session.state);
        }
      }

      if (!session) {
        session = this._sessionManager.create({
          packageId: this._currentPackage.id,
          version: this._currentPackage.version
        });
      }

      this._sandbox.setup(this._currentPackage);

      this._sandbox.on('api:ready', () => {
        this._renderer.initialize();
      });

      await this._sandbox.initialize(this._currentPackage);

      this._renderer.render(this._currentPackage, session);

      this._extensionManager.triggerHook('onStart', {
        runtime: this,
        package: this._currentPackage,
        session
      });

      this._currentSession = session;
      this._setState('running');

      this._monitor?.endMark('start');
      this._eventBus.emit('runtime:started', { session });
    } catch (err) {
      this._handleError('start', err);
      throw err;
    }
  }

  pause() {
    this._assertState('running');
    this._setState('paused');

    this._sandbox.pause();
    this._renderer.pause();
    if (this._currentSession) {
      this._sessionManager.pause(this._currentSession.id);
    }

    this._extensionManager.triggerHook('onPause', { runtime: this });
    this._eventBus.emit('runtime:paused', { session: this._currentSession });
  }

  resume() {
    this._assertState('paused');
    this._setState('running');

    this._sandbox.resume();
    this._renderer.resume();
    if (this._currentSession) {
      this._sessionManager.resume(this._currentSession.id);
    }

    this._extensionManager.triggerHook('onResume', { runtime: this });
    this._eventBus.emit('runtime:resumed', { session: this._currentSession });
  }

  async stop(saveState = true) {
    if (this._state === 'stopped' || this._state === 'created') return;

    this._setState('stopping');

    if (saveState && this._currentSession) {
      const snapshot = this._stateManager.snapshot();
      await this._sessionManager.save(this._currentSession.id, {
        state: snapshot,
        progress: this._currentPackage?.progress
      });
    }

    this._extensionManager.triggerHook('onStop', { runtime: this });
    this._renderer.destroy();
    this._sandbox.destroy();
    this._monitor?.flush();

    this._currentSession = null;
    this._setState('stopped');
    this._eventBus.emit('runtime:stopped', {});
  }

  async destroy() {
    await this.stop(false);
    this._eventBus.clear();
    this._cache.clear();
    this._monitor?.destroy();
    this._extensionManager.destroy();
    this._state = 'destroyed';
  }

  getAPIs() {
    return this._sandbox?.getAPIs() || {};
  }

  getMetrics() {
    return this._monitor?.getMetrics() || {};
  }

  use(extension) {
    this._extensionManager.register(extension);
    return this;
  }

  _mergeOptions(defaults, overrides) {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && defaults[key]) {
        result[key] = this._mergeOptions(defaults[key], overrides[key]);
      } else if (overrides[key] !== undefined) {
        result[key] = overrides[key];
      }
    }
    return result;
  }

  _initLifecycle() {
    this._eventBus.on('package:load:error', (err) => this._handleError('package_load', err));
    this._eventBus.on('sandbox:error', (err) => this._handleError('sandbox', err));
    this._eventBus.on('renderer:error', (err) => this._handleError('renderer', err));
    this._eventBus.on('session:timeout', () => {
      this.pause();
      this._eventBus.emit('runtime:timeout', { session: this._currentSession });
    });
  }

  _assertState(...expected) {
    if (!expected.includes(this._state)) {
      throw new Error(`Invalid state transition: current state is "${this._state}", expected "${expected.join('" or "')}"`);
    }
  }

  _setState(newState) {
    const oldState = this._state;
    this._state = newState;
    this._eventBus.emit('runtime:stateChanged', { oldState, newState });
  }

  _handleError(context, error) {
    this._error = { context, error, timestamp: Date.now() };
    this._monitor?.recordError(context, error);
    this._eventBus.emit('runtime:error', { context, error });
    if (this._state === 'loading' || this._state === 'starting') {
      this._setState('error');
    }
  }
}
