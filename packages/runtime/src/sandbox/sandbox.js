import { JavaScriptEngine } from './javascript-engine/index.js';
import { PermissionManager } from './permissions/index.js';
import { SecurityPolicies } from './security-policies/index.js';
import { ExecutionContext } from './execution-context/index.js';
import { EventBus } from '../events/event-bus.js';
import { QuizAPI } from '../api/quiz-api.js';
import { GameAPI } from '../api/game-api.js';
import { StorageAPI } from '../api/storage-api.js';
import { MediaAPI } from '../api/media-api.js';
import { AnalyticsAPI } from '../api/analytics-api.js';
import { TimerAPI } from '../api/timer-api.js';
import { EventAPI } from '../api/event-api.js';

const ALLOWED_GLOBALS = [
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'Math', 'Date', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'RegExp',
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent', 'typeof', 'instanceof',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView', 'TextEncoder', 'TextDecoder',
  'atob', 'btoa', 'performance', 'structuredClone',
  'Infinity', 'NaN', 'undefined', 'null', 'true', 'false'
];

export class Sandbox {
  constructor(options = {}) {
    this._options = {
      security: null,
      eventBus: null,
      monitor: null,
      allowAudio: true,
      allowVideo: true,
      allowCanvas: true,
      allowStorage: false,
      maxExecutionTime: 10000,
      maxMemory: 128 * 1024 * 1024,
      ...options
    };
    this._jsEngine = new JavaScriptEngine({
      maxExecutionTime: this._options.maxExecutionTime,
      maxMemory: this._options.maxMemory
    });
    this._permissionManager = new PermissionManager({
      defaultPermissions: this._options.allowStorage ? ['storage'] : []
    });
    this._securityPolicies = new SecurityPolicies({
      security: this._options.security
    });
    this._context = null;
    this._sandboxWindow = null;
    this._apis = {};
    this._eventBus = this._options.eventBus || new EventBus();
    this._initialized = false;
  }

  setup(pkg) {
    const permissions = pkg.manifest?.permissions || [];
    this._permissionManager.configure(permissions);
    this._context = new ExecutionContext({
      packageId: pkg.id || pkg.manifest?.id,
      permissions,
      allowedGlobals: ALLOWED_GLOBALS,
      securityPolicies: this._securityPolicies,
      eventBus: this._eventBus
    });
  }

  async initialize(pkg) {
    if (this._initialized) return;
    this._options.monitor?.startMark('sandbox_init');
    this._setupSandboxWindow();
    this._setupAPIs();
    this._context?.setWindow(this._sandboxWindow);
    if (pkg?.manifest?.scripts) {
      for (const script of pkg.manifest.scripts) {
        if (this._permissionManager.hasPermission('script-execution')) {
          await this._jsEngine.execute(script.content || script.src, this._sandboxWindow);
        }
      }
    }
    this._initialized = true;
    this._options.monitor?.endMark('sandbox_init');
    this._eventBus.emit('sandbox:initialized', {});
    this._eventBus.emit('api:ready', {});
  }

  executeJavaScript(js) {
    if (!this._context?.hasPermission('script-execution')) {
      throw new Error('Script execution not permitted');
    }
    return this._jsEngine.execute(js, this._sandboxWindow);
  }

  getAPIs() {
    return { ...this._apis };
  }

  getAPI(name) {
    return this._apis[name] || null;
  }

  getWindow() {
    return this._sandboxWindow;
  }

  hasPermission(permission) {
    return this._permissionManager.hasPermission(permission);
  }

  requestPermission(permission) {
    return this._permissionManager.request(permission);
  }

  on(event, listener) {
    this._eventBus.on(event, listener);
    return this;
  }

  off(event, listener) {
    this._eventBus.off(event, listener);
    return this;
  }

  pause() {
    this._jsEngine.pause();
  }

  resume() {
    this._jsEngine.resume();
  }

  destroy() {
    this._jsEngine.destroy();
    this._context = null;
    this._sandboxWindow = null;
    this._apis = {};
    this._initialized = false;
  }

  _setupSandboxWindow() {
    this._sandboxWindow = {};
    const allowed = this._context?.getAllowedGlobals() || ALLOWED_GLOBALS;
    for (const global of allowed) {
      if (global in globalThis) {
        this._sandboxWindow[global] = globalThis[global];
      }
    }
    this._sandboxWindow.console = {
      log: (...args) => this._eventBus.emit('console:log', { level: 'log', args }),
      warn: (...args) => this._eventBus.emit('console:log', { level: 'warn', args }),
      error: (...args) => this._eventBus.emit('console:log', { level: 'error', args }),
      info: (...args) => this._eventBus.emit('console:log', { level: 'info', args }),
      debug: (...args) => this._eventBus.emit('console:log', { level: 'debug', args })
    };
    this._sandboxWindow.__CASUYA__ = {
      version: '1.0.0',
      runtime: 'casuya-runtime',
      initialized: true
    };
  }

  _setupAPIs() {
    if (this._permissionManager.hasPermission('storage')) {
      this._apis.storage = new StorageAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_STORAGE__ = this._apis.storage;
    }
    if (this._permissionManager.hasPermission('quiz')) {
      this._apis.quiz = new QuizAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_QUIZ__ = this._apis.quiz;
    }
    if (this._permissionManager.hasPermission('game')) {
      this._apis.game = new GameAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_GAME__ = this._apis.game;
    }
    if (this._permissionManager.hasPermission('media') || this._options.allowAudio || this._options.allowVideo) {
      this._apis.media = new MediaAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_MEDIA__ = this._apis.media;
    }
    if (this._permissionManager.hasPermission('analytics')) {
      this._apis.analytics = new AnalyticsAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_ANALYTICS__ = this._apis.analytics;
    }
    if (this._permissionManager.hasPermission('timer')) {
      this._apis.timer = new TimerAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_TIMER__ = this._apis.timer;
    }
    {
      this._apis.event = new EventAPI({ eventBus: this._eventBus });
      this._sandboxWindow.__CASUYA_EVENT__ = this._apis.event;
    }
  }
}
