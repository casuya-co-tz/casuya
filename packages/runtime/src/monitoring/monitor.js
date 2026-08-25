import { PerformanceMonitor } from './performance-monitor.js';
import { ErrorTracker } from './error-tracker.js';
import { MetricsCollector } from './metrics.js';

export class Monitor {
  constructor(options = {}) {
    this._options = {
      enabled: true,
      sampleRate: 0.1,
      eventBus: null,
      ...options
    };
    this._performance = new PerformanceMonitor({ sampleRate: this._options.sampleRate });
    this._errors = new ErrorTracker();
    this._metrics = new MetricsCollector();
    this._marks = new Map();
    this._enabled = this._options.enabled;
  }

  startMark(name) {
    if (!this._enabled) return;
    this._marks.set(name, performance.now());
  }

  endMark(name) {
    if (!this._enabled) return;
    const start = this._marks.get(name);
    if (start === undefined) return;
    const duration = performance.now() - start;
    this._marks.delete(name);
    this._performance.record(name, duration);
    this._options.eventBus?.emit('monitor:measure', { name, duration });
    return duration;
  }

  measure(name, fn) {
    if (!this._enabled) return fn();
    this.startMark(name);
    try {
      const result = fn();
      this.endMark(name);
      return result;
    } catch (err) {
      this.endMark(name);
      throw err;
    }
  }

  async measureAsync(name, fn) {
    if (!this._enabled) return fn();
    this.startMark(name);
    try {
      const result = await fn();
      this.endMark(name);
      return result;
    } catch (err) {
      this.endMark(name);
      throw err;
    }
  }

  recordError(context, error) {
    if (!this._enabled) return;
    this._errors.record(context, error);
    this._options.eventBus?.emit('monitor:error', { context, error: error?.message });
  }

  recordMetric(name, value, tags = {}) {
    if (!this._enabled) return;
    this._metrics.record(name, value, tags);
  }

  incrementMetric(name, by = 1, tags = {}) {
    if (!this._enabled) return;
    this._metrics.increment(name, by, tags);
  }

  getMetrics() {
    return {
      performance: this._performance.getAll(),
      errors: this._errors.getAll(),
      custom: this._metrics.getAll()
    };
  }

  getPerformance(name) {
    return this._performance.get(name);
  }

  getErrorReport() {
    return this._errors.getReport();
  }

  flush() {
    this._metrics.flush();
  }

  enable() {
    this._enabled = true;
  }

  disable() {
    this._enabled = false;
  }

  isEnabled() {
    return this._enabled;
  }

  destroy() {
    this._marks.clear();
    this._performance.destroy();
    this._errors.destroy();
    this._metrics.destroy();
  }
}
