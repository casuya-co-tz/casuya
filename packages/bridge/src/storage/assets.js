/** Storage of binary/media assets referenced by lessons (images, audio, video). */

import { STORES } from '../core/constants.js';

export class AssetStore {
  constructor(db) {
    this._db = db;
  }

  async save(url, blobOrData) {
    return this._db.put(STORES.ASSETS, url, {
      data: blobOrData,
      cachedAt: Date.now(),
    });
  }

  async get(url) {
    const record = await this._db.get(STORES.ASSETS, url);
    return record ? record.data : null;
  }

  async has(url) {
    return (await this._db.get(STORES.ASSETS, url)) !== null;
  }

  async remove(url) {
    return this._db.delete(STORES.ASSETS, url);
  }

  async evictOlderThan(maxAgeMs) {
    const keys = await this._db.keys(STORES.ASSETS);
    const now = Date.now();
    let evicted = 0;
    for (const key of keys) {
      const record = await this._db.get(STORES.ASSETS, key);
      if (record && now - record.cachedAt > maxAgeMs) {
        await this._db.delete(STORES.ASSETS, key);
        evicted += 1;
      }
    }
    return evicted;
  }
}
