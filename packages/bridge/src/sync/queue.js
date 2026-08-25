/** Persistent FIFO queue of pending sync events, backed by the storage layer. */

import { STORES } from '../core/constants.js';
import { uuid } from '../utils/uuid.js';

export class SyncQueue {
  constructor(db) {
    this._db = db;
  }

  async enqueue(event) {
    const id = uuid();
    const record = { id, createdAt: Date.now(), attempts: 0, event };
    await this._db.put(STORES.QUEUE, id, record);
    return record;
  }

  async all() {
    const records = await this._db.values(STORES.QUEUE);
    return records.sort((a, b) => a.createdAt - b.createdAt);
  }

  async remove(id) {
    return this._db.delete(STORES.QUEUE, id);
  }

  async updateAttempts(id, attempts) {
    const record = await this._db.get(STORES.QUEUE, id);
    if (!record) return null;
    record.attempts = attempts;
    await this._db.put(STORES.QUEUE, id, record);
    return record;
  }

  async size() {
    return (await this.all()).length;
  }

  async clear() {
    return this._db.clear(STORES.QUEUE);
  }
}
