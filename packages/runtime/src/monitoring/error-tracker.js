export class ErrorTracker {
  constructor(options = {}) {
    this._options = {
      maxErrors: 100,
      ...options
    };
    this._errors = [];
    this._errorCounts = new Map();
  }

  record(context, error) {
    const entry = {
      context,
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: Date.now()
    };
    this._errors.push(entry);
    if (this._errors.length > this._options.maxErrors) {
      this._errors.shift();
    }
    const key = `${context}:${error?.message || 'unknown'}`;
    this._errorCounts.set(key, (this._errorCounts.get(key) || 0) + 1);
    return entry;
  }

  getAll() {
    return [...this._errors];
  }

  getRecent(count = 10) {
    return this._errors.slice(-count);
  }

  getByContext(context) {
    return this._errors.filter(e => e.context === context);
  }

  getReport() {
    const byContext = {};
    for (const error of this._errors) {
      if (!byContext[error.context]) {
        byContext[error.context] = [];
      }
      byContext[error.context].push(error);
    }
    const topErrors = Array.from(this._errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));
    return {
      total: this._errors.length,
      unique: this._errorCounts.size,
      byContext,
      topErrors
    };
  }

  clear() {
    this._errors = [];
    this._errorCounts.clear();
  }

  destroy() {
    this.clear();
  }
}
