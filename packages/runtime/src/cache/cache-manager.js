import { LRUCache } from './lru-cache.js';

export class CacheManager {
  constructor(options = {}) {
    this._options = {
      maxSize: 50 * 1024 * 1024,
      ttl: 30 * 60 * 1000,
      ...options
    };
    this._caches = new Map();
    this._totalSize = 0;
  }

  get(namespace) {
    if (!this._caches.has(namespace)) {
      this._caches.set(namespace, new LRUCache({
        maxSize: this._options.maxSize,
        ttl: this._options.ttl
      }));
    }
    return this._caches.get(namespace);
  }

  set(namespace, key, value, ttl) {
    const cache = this.get(namespace);
    const size = typeof value === 'string' ? value.length : (value instanceof ArrayBuffer ? value.byteLength : JSON.stringify(value).length);
    cache.set(key, value, size, ttl);
    return this;
  }

  getValue(namespace, key) {
    const cache = this._caches.get(namespace);
    if (!cache) return undefined;
    return cache.get(key);
  }

  has(namespace, key) {
    const cache = this._caches.get(namespace);
    return cache ? cache.has(key) : false;
  }

  delete(namespace, key) {
    const cache = this._caches.get(namespace);
    if (cache) {
      cache.delete(key);
    }
    return this;
  }

  clearNamespace(namespace) {
    const cache = this._caches.get(namespace);
    if (cache) {
      cache.clear();
    }
    return this;
  }

  clear() {
    for (const cache of this._caches.values()) {
      cache.clear();
    }
    this._caches.clear();
    this._totalSize = 0;
  }

  get size() {
    let total = 0;
    for (const cache of this._caches.values()) {
      total += cache.size;
    }
    return total;
  }

  get entries() {
    const all = {};
    for (const [namespace, cache] of this._caches.entries()) {
      all[namespace] = cache.entries;
    }
    return all;
  }

  destroy() {
    this.clear();
  }
}
