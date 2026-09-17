/** Offline queue for STT uploads — stores WAV blobs until connectivity returns. */

import { createStore } from '../storage/indexeddb.js';
import { STORES } from '../core/constants.js';
import { uuid } from '../utils/uuid.js';

const STT_WAV_PREFIX = 'stt-wav:';
const STT_INDEX_KEY = 'stt-outbox-index';

export class SttOutbox {
  constructor(db) {
    this._db = db;
  }

  static open(dbName, dbVersion) {
    return new SttOutbox(createStore(dbName, dbVersion));
  }

  async _readIndex() {
    const ids = await this._db.get(STORES.META, STT_INDEX_KEY);
    return Array.isArray(ids) ? ids : [];
  }

  async _writeIndex(ids) {
    await this._db.put(STORES.META, STT_INDEX_KEY, ids);
  }

  async enqueue(wavBlob, targetSelector = '', append = false, language = '') {
    const id = uuid();
    await this._db.put(STORES.ASSETS, `${STT_WAV_PREFIX}${id}`, {
      data: wavBlob,
      targetSelector,
      append: !!append,
      language: language === 'en' || language === 'sw' ? language : '',
      createdAt: Date.now(),
    });
    const ids = await this._readIndex();
    ids.push(id);
    await this._writeIndex(ids);
    return id;
  }

  async all() {
    const ids = await this._readIndex();
    const records = [];
    for (const id of ids) {
      const record = await this._db.get(STORES.ASSETS, `${STT_WAV_PREFIX}${id}`);
      if (record) records.push({ id, ...record });
    }
    return records.sort((a, b) => a.createdAt - b.createdAt);
  }

  async remove(id) {
    await this._db.delete(STORES.ASSETS, `${STT_WAV_PREFIX}${id}`);
    const ids = (await this._readIndex()).filter((entry) => entry !== id);
    await this._writeIndex(ids);
  }

  async size() {
    return (await this._readIndex()).length;
  }

  /** Drain pending clips through `transcribe(blob)`; fills targets when provided. */
  async drain(transcribe) {
    const pending = await this.all();
    const results = [];
    for (const item of pending) {
      try {
        const text = await transcribe(item.data, item.language);
        results.push({ id: item.id, text, targetSelector: item.targetSelector, append: item.append });
        await this.remove(item.id);
      } catch {
        break;
      }
    }
    return results;
  }
}
