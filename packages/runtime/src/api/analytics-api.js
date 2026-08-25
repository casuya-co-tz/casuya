export class AnalyticsAPI {
  constructor(options = {}) {
    this._options = {
      eventBus: null,
      collector: null,
      ...options
    };
    this._events = [];
    this._batchSize = 50;
    this._autoFlush = true;
    this._flushInterval = 30000;
    this._flushTimer = null;
    this._listeners = new Map();
    this._startAutoFlush();
  }

  track(event, data = {}) {
    const entry = {
      event,
      data: this._sanitizeData(data),
      timestamp: Date.now(),
      id: this._generateId()
    };
    this._events.push(entry);
    this._emit('analytics:tracked', entry);
    if (this._autoFlush && this._events.length >= this._batchSize) {
      this.flush();
    }
    return entry;
  }

  trackPageView(page) {
    return this.track('page_view', { page });
  }

  trackInteraction(type, target, metadata = {}) {
    return this.track('interaction', { type, target, ...metadata });
  }

  trackProgress(lessonId, progress, metadata = {}) {
    return this.track('progress', { lessonId, progress, ...metadata });
  }

  trackPerformance(metric, value, metadata = {}) {
    return this.track('performance', { metric, value, ...metadata });
  }

  trackError(error, context = {}) {
    return this.track('error', {
      message: error?.message || String(error),
      stack: error?.stack,
      ...context
    });
  }

  async flush() {
    if (this._events.length === 0) return;
    const batch = this._events.splice(0, this._batchSize);
    try {
      if (this._options.collector) {
        await this._options.collector.send(batch);
      }
      this._emit('analytics:flushed', { count: batch.length });
    } catch (err) {
      this._events.unshift(...batch);
      this._emit('analytics:flushError', { error: err, count: batch.length });
    }
  }

  getEvents() {
    return [...this._events];
  }

  getEventCount() {
    return this._events.length;
  }

  clear() {
    this._events = [];
  }

  setBatchSize(size) {
    this._batchSize = Math.max(1, size);
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
  }

  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this._events = [];
    this._listeners.clear();
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch (_) { /* ignore */ }
      }
    }
  }

  _startAutoFlush() {
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._flushTimer = setInterval(() => {
      if (this._events.length > 0) {
        this.flush();
      }
    }, this._flushInterval);
  }

  _sanitizeData(data) {
    if (!data || typeof data !== 'object') return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('__') || key === 'password' || key === 'token' || key === 'secret') continue;
      sanitized[key] = value;
    }
    return sanitized;
  }

  _generateId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
