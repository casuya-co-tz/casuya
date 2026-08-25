export class MetricsCollector {
  constructor(options = {}) {
    this._options = {
      maxMetrics: 500,
      ...options
    };
    this._metrics = new Map();
    this._counters = new Map();
    this._gauges = new Map();
  }

  record(name, value, tags = {}) {
    if (!this._metrics.has(name)) {
      this._metrics.set(name, []);
    }
    const entry = { value, tags, timestamp: Date.now() };
    const entries = this._metrics.get(name);
    entries.push(entry);
    if (entries.length > this._options.maxMetrics) {
      entries.shift();
    }
    return entry;
  }

  increment(name, by = 1, tags = {}) {
    const key = `${name}:${JSON.stringify(tags)}`;
    this._counters.set(key, (this._counters.get(key) || 0) + by);
    return this._counters.get(key);
  }

  gauge(name, value, tags = {}) {
    const key = `${name}:${JSON.stringify(tags)}`;
    this._gauges.set(key, { value, tags, timestamp: Date.now() });
  }

  get(name) {
    const entries = this._metrics.get(name);
    if (!entries || entries.length === 0) return null;
    const values = entries.map(e => e.value);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      last: values[values.length - 1]
    };
  }

  getCounter(name, tags = {}) {
    const key = `${name}:${JSON.stringify(tags)}`;
    return this._counters.get(key) || 0;
  }

  getGauge(name, tags = {}) {
    const key = `${name}:${JSON.stringify(tags)}`;
    return this._gauges.get(key)?.value || null;
  }

  getAll() {
    const result = {};
    for (const name of this._metrics.keys()) {
      result[name] = this.get(name);
    }
    result._counters = Object.fromEntries(this._counters);
    result._gauges = Object.fromEntries(
      Array.from(this._gauges.entries()).map(([k, v]) => [k, v.value])
    );
    return result;
  }

  flush() {
    this._metrics.clear();
    this._counters.clear();
    this._gauges.clear();
  }

  destroy() {
    this.flush();
  }
}
