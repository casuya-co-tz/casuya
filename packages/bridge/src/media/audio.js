/** Persistent TTS WAV cache backed by the bridge AssetStore (IndexedDB). */

import { createStore } from '../storage/indexeddb.js';
import { STORES } from '../core/constants.js';

const TTS_PREFIX = 'tts-wav:';
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class TtsAudioCache {
  constructor(db) {
    this._db = db;
  }

  static open(dbName, dbVersion) {
    return new TtsAudioCache(createStore(dbName, dbVersion));
  }

  static cacheKey(lang, speed, text) {
    return `${lang}|${speed}|${text}`;
  }

  _storageKey(cacheKey) {
    return `${TTS_PREFIX}${cacheKey}`;
  }

  async get(cacheKey) {
    const record = await this._db.get(STORES.ASSETS, this._storageKey(cacheKey));
    return record?.data ?? null;
  }

  async put(cacheKey, blob) {
    await this._db.put(STORES.ASSETS, this._storageKey(cacheKey), {
      data: blob,
      cachedAt: Date.now(),
      byteSize: blob?.size ?? 0,
    });
  }

  async evictOlderThan(maxAgeMs = DEFAULT_MAX_AGE_MS) {
    const keys = await this._db.keys(STORES.ASSETS);
    const now = Date.now();
    let evicted = 0;
    for (const key of keys) {
      if (!String(key).startsWith(TTS_PREFIX)) continue;
      const record = await this._db.get(STORES.ASSETS, key);
      if (record && now - record.cachedAt > maxAgeMs) {
        await this._db.delete(STORES.ASSETS, key);
        evicted += 1;
      }
    }
    return evicted;
  }

  async evictOverBudget(maxBytes = DEFAULT_MAX_BYTES) {
    const keys = await this._db.keys(STORES.ASSETS);
    const entries = [];
    for (const key of keys) {
      if (!String(key).startsWith(TTS_PREFIX)) continue;
      const record = await this._db.get(STORES.ASSETS, key);
      if (record) entries.push({ key, cachedAt: record.cachedAt, byteSize: record.byteSize ?? 0 });
    }
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    let total = entries.reduce((sum, e) => sum + e.byteSize, 0);
    let evicted = 0;
    for (const entry of entries) {
      if (total <= maxBytes) break;
      await this._db.delete(STORES.ASSETS, entry.key);
      total -= entry.byteSize;
      evicted += 1;
    }
    return evicted;
  }
}
