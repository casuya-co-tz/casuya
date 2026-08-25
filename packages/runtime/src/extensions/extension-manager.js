export class ExtensionManager {
  constructor(options = {}) {
    this._options = {
      eventBus: null,
      runtime: null,
      ...options
    };
    this._extensions = new Map();
    this._hooks = new Map();
    this._lifecycle = ['onLoad', 'onStart', 'onPause', 'onResume', 'onStop', 'onDestroy', 'onError', 'onStateChange'];
  }

  register(extension) {
    if (typeof extension !== 'object' || extension === null) {
      throw new Error('Extension must be an object');
    }
    if (!extension.id) {
      throw new Error('Extension must have an "id" field');
    }
    if (this._extensions.has(extension.id)) {
      console.warn(`Extension "${extension.id}" is already registered. Overwriting.`);
    }
    this._extensions.set(extension.id, extension);
    for (const hook of this._lifecycle) {
      if (typeof extension[hook] === 'function') {
        if (!this._hooks.has(hook)) {
          this._hooks.set(hook, []);
        }
        this._hooks.get(hook).push(extension[hook].bind(extension));
      }
    }
    this.triggerHook('onLoad', { extension: extension.id, runtime: this._options.runtime });
    this._options.eventBus?.emit('extension:registered', { id: extension.id });
    return this;
  }

  unregister(id) {
    const extension = this._extensions.get(id);
    if (!extension) return this;
    for (const hook of this._lifecycle) {
      if (typeof extension[hook] === 'function') {
        const hooks = this._hooks.get(hook);
        if (hooks) {
          this._hooks.set(hook, hooks.filter(fn => fn !== extension[hook].bind(extension)));
        }
      }
    }
    this._extensions.delete(id);
    this._options.eventBus?.emit('extension:unregistered', { id });
    return this;
  }

  triggerHook(hook, data = {}) {
    const handlers = this._hooks.get(hook);
    if (!handlers || handlers.length === 0) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`Extension hook "${hook}" error:`, err);
        this._options.eventBus?.emit('extension:error', { hook, error: err.message });
      }
    }
  }

  getExtension(id) {
    return this._extensions.get(id) || null;
  }

  getExtensions() {
    return Array.from(this._extensions.values());
  }

  hasExtension(id) {
    return this._extensions.has(id);
  }

  getRegisteredHooks() {
    const result = {};
    for (const [hook, handlers] of this._hooks) {
      result[hook] = handlers.length;
    }
    return result;
  }

  destroy() {
    this.triggerHook('onDestroy', { runtime: this._options.runtime });
    this._extensions.clear();
    this._hooks.clear();
  }
}
