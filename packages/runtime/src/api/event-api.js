export class EventAPI {
  constructor(options = {}) {
    this._options = {
      eventBus: null,
      ...options
    };
    this._registeredEvents = new Set();
    this._listeners = new Map();
  }

  on(event, listener) {
    this._registeredEvents.add(event);
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      listener(data);
    };
    this.on(event, wrapper);
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
  }

  emit(event, data = {}) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch (err) {
          console.warn(`EventAPI: Error in listener for "${event}":`, err);
        }
      }
    }
    if (this._options.eventBus) {
      this._options.eventBus.emit(`lesson:${event}`, data);
    }
    return true;
  }

  emitToRuntime(event, data = {}) {
    if (this._options.eventBus) {
      this._options.eventBus.emit(`lesson:${event}`, data);
    }
    return true;
  }

  onRuntimeEvent(event, listener) {
    if (this._options.eventBus) {
      this._options.eventBus.on(event, listener);
    }
    return () => {
      if (this._options.eventBus) {
        this._options.eventBus.off(event, listener);
      }
    };
  }

  getRegisteredEvents() {
    return Array.from(this._registeredEvents);
  }

  clear() {
    this._listeners.clear();
    this._registeredEvents.clear();
  }

  destroy() {
    this.clear();
  }
}
