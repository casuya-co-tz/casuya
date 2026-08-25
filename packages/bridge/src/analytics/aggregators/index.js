/** Aggregates raw analytics events into summary statistics
 * for efficient upload. */

export class AnalyticsAggregator {
  constructor() {
    this._counts = new Map();
    this._totals = new Map();
  }

  ingest(event) {
    const type = event.type;
    this._counts.set(type, (this._counts.get(type) ?? 0) + 1);
    if (typeof event.payload?.value === 'number') {
      const current = this._totals.get(type) ?? { sum: 0, count: 0 };
      current.sum += event.payload.value;
      current.count += 1;
      this._totals.set(type, current);
    }
  }

  summary() {
    const result = [];
    for (const [type, count] of this._counts) {
      const totals = this._totals.get(type);
      result.push({
        eventType: type,
        count,
        avgValue: totals ? Math.round(totals.sum / totals.count) : null,
      });
    }
    return result;
  }

  clear() {
    this._counts.clear();
    this._totals.clear();
  }
}