/** Minimal, dependency-free event emitter used throughout the bridge. */

export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const off = this.on(event, (...args) => {
      off();
      handler(...args);
    });
    return off;
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (err) {
        // Never let one bad listener break the emit loop.
        console.error(`[casuya-bridge] listener for '${event}' threw:`, err);
      }
    }
  }

  removeAllListeners(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }

  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0;
  }
}
