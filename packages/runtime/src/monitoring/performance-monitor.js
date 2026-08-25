export class PerformanceMonitor {
  constructor(options = {}) {
    this._options = {
      sampleRate: 0.1,
      maxEntries: 1000,
      ...options
    };
    this._measurements = new Map();
  }

  record(name, duration) {
    if (Math.random() > this._options.sampleRate) return;
    if (!this._measurements.has(name)) {
      this._measurements.set(name, []);
    }
    const entries = this._measurements.get(name);
    entries.push({ duration, timestamp: Date.now() });
    if (entries.length > this._options.maxEntries) {
      entries.shift();
    }
  }

  get(name) {
    const entries = this._measurements.get(name);
    if (!entries || entries.length === 0) return null;
    const durations = entries.map(e => e.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      count: durations.length,
      sum,
      avg: sum / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      last: durations[durations.length - 1]
    };
  }

  getAll() {
    const result = {};
    for (const name of this._measurements.keys()) {
      result[name] = this.get(name);
    }
    return result;
  }

  clear(name) {
    if (name) {
      this._measurements.delete(name);
    } else {
      this._measurements.clear();
    }
  }

  destroy() {
    this._measurements.clear();
  }
}
