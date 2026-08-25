/** Collects raw analytics events from the runtime and batches them
 * for periodic upload. */

import { uuid } from '../../utils/uuid.js';

export class AnalyticsCollector {
  constructor({ queue, batchSize = 50 }) {
    this._queue = queue;
    this._batchSize = batchSize;
    this._buffer = [];
  }

  track(eventType, payload) {
    const record = {
      id: uuid(),
      type: eventType,
      payload,
      timestamp: Date.now(),
    };
    this._buffer.push(record);
    if (this._buffer.length >= this._batchSize) {
      this.flush();
    }
    return record;
  }

  async flush() {
    if (this._buffer.length === 0) return;
    const batch = this._buffer.splice(0);
    for (const record of batch) {
      await this._queue.enqueue({ type: 'analytics', payload: record });
    }
  }

  get pendingCount() {
    return this._buffer.length;
  }
}