export class LRUCache {
  constructor(options = {}) {
    this._options = {
      maxSize: 50 * 1024 * 1024,
      ttl: 30 * 60 * 1000,
      ...options
    };
    this._map = new Map();
    this._size = 0;
  }

  get size() {
    return this._size;
  }

  get entries() {
    const result = {};
    for (const [key, entry] of this._map) {
      result[key] = entry.value;
    }
    return result;
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    const entry = this._map.get(key);
    if (this._isExpired(entry)) {
      this._map.delete(key);
      this._size -= entry.size || 0;
      return undefined;
    }
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value, size = 0, ttl) {
    if (this._map.has(key)) {
      const old = this._map.get(key);
      this._size -= old.size || 0;
      this._map.delete(key);
    }
    const t = ttl !== undefined ? ttl : this._options.ttl;
    const entry = {
      value,
      size,
      expires: t > 0 ? Date.now() + t : Infinity
    };
    this._size += size;
    this._map.set(key, entry);
    this._evictIfNeeded();
  }

  has(key) {
    if (!this._map.has(key)) return false;
    const entry = this._map.get(key);
    if (this._isExpired(entry)) {
      this._map.delete(key);
      this._size -= entry.size || 0;
      return false;
    }
    return true;
  }

  delete(key) {
    if (!this._map.has(key)) return false;
    const entry = this._map.get(key);
    this._size -= entry.size || 0;
    this._map.delete(key);
    return true;
  }

  clear() {
    this._map.clear();
    this._size = 0;
  }

  keys() {
    this._purgeExpired();
    return Array.from(this._map.keys());
  }

  _isExpired(entry) {
    return entry.expires !== Infinity && Date.now() > entry.expires;
  }

  _evictIfNeeded() {
    if (this._size <= this._options.maxSize) return;
    const entriesToDelete = [];
    for (const [key, entry] of this._map) {
      if (this._isExpired(entry)) {
        entriesToDelete.push(key);
      }
    }
    for (const key of entriesToDelete) {
      const entry = this._map.get(key);
      this._size -= entry.size || 0;
      this._map.delete(key);
    }
    while (this._size > this._options.maxSize && this._map.size > 0) {
      const oldestKey = this._map.keys().next().value;
      const entry = this._map.get(oldestKey);
      this._size -= entry.size || 0;
      this._map.delete(oldestKey);
    }
  }

  _purgeExpired() {
    for (const [key, entry] of this._map) {
      if (this._isExpired(entry)) {
        this._size -= entry.size || 0;
        this._map.delete(key);
      }
    }
  }
}
