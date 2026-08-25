export class EventBus {
  constructor() {
    this._listeners = new Map();
    this._wildcardListeners = [];
    this._onceListeners = new Set();
    this._maxListeners = 100;
  }

  on(event, listener) {
    if (typeof listener !== 'function') return this;
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    const listeners = this._listeners.get(event);
    if (listeners.length >= this._maxListeners) {
      console.warn(`EventBus: Max listeners (${this._maxListeners}) reached for "${event}"`);
      return this;
    }
    listeners.push(listener);
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      this._onceListeners.delete(onceWrapper);
      listener.apply(this, args);
    };
    this._onceListeners.add(onceWrapper);
    this.on(event, onceWrapper);
    return this;
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return this;
    if (!listener) {
      this._listeners.delete(event);
      return this;
    }
    const listeners = this._listeners.get(event);
    this._listeners.set(event, listeners.filter(l => l !== listener));
    return this;
  }

  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of [...listeners]) {
        try {
          listener(data);
        } catch (err) {
          console.error(`EventBus: Error in listener for "${event}":`, err);
        }
      }
    }
    for (const listener of this._wildcardListeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error(`EventBus: Error in wildcard listener:`, err);
      }
    }
    return this;
  }

  onAny(listener) {
    if (typeof listener === 'function') {
      this._wildcardListeners.push(listener);
    }
    return this;
  }

  offAny(listener) {
    this._wildcardListeners = this._wildcardListeners.filter(l => l !== listener);
    return this;
  }

  listenerCount(event) {
    return this._listeners.get(event)?.length || 0;
  }

  listeners(event) {
    return [...(this._listeners.get(event) || [])];
  }

  eventNames() {
    return Array.from(this._listeners.keys());
  }

  clear() {
    this._listeners.clear();
    this._wildcardListeners = [];
    this._onceListeners.clear();
  }

  destroy() {
    this.clear();
  }
}
