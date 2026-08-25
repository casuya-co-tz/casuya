export class StorageAPI {
  constructor(options = {}) {
    this._options = {
      namespace: 'casuya',
      storage: null,
      ...options
    };
    this._namespace = this._options.namespace;
    this._memoryStore = new Map();
    this._storage = this._options.storage;
  }

  setNamespace(namespace) {
    this._namespace = namespace;
  }

  async set(key, value) {
    const fullKey = this._makeKey(key);
    const serialized = this._serialize(value);
    this._memoryStore.set(fullKey, serialized);
    if (this._storage) {
      try {
        await this._storage.set(fullKey, serialized);
      } catch (err) {
        this._memoryStore.set(fullKey, serialized);
      }
    }
    return true;
  }

  async get(key, defaultValue = null) {
    const fullKey = this._makeKey(key);
    if (this._memoryStore.has(fullKey)) {
      return this._deserialize(this._memoryStore.get(fullKey));
    }
    if (this._storage) {
      try {
        const value = await this._storage.get(fullKey);
        if (value !== undefined && value !== null) {
          this._memoryStore.set(fullKey, value);
          return this._deserialize(value);
        }
      } catch {}
    }
    return defaultValue;
  }

  async delete(key) {
    const fullKey = this._makeKey(key);
    this._memoryStore.delete(fullKey);
    if (this._storage) {
      try {
        await this._storage.delete(fullKey);
      } catch {}
    }
    return true;
  }

  async has(key) {
    const fullKey = this._makeKey(key);
    if (this._memoryStore.has(fullKey)) return true;
    if (this._storage) {
      try {
        const value = await this._storage.get(fullKey);
        return value !== undefined && value !== null;
      } catch {}
    }
    return false;
  }

  async clear() {
    this._memoryStore.clear();
    if (this._storage) {
      try {
        await this._storage.clear();
      } catch {}
    }
    return true;
  }

  async keys() {
    const keys = new Set();
    for (const key of this._memoryStore.keys()) {
      keys.add(key.replace(`${this._namespace}:`, ''));
    }
    return Array.from(keys);
  }

  async size() {
    return this._memoryStore.size;
  }

  setItem(key, value) {
    return this.set(key, value);
  }

  getItem(key, defaultValue) {
    return this.get(key, defaultValue);
  }

  removeItem(key) {
    return this.delete(key);
  }

  _makeKey(key) {
    return `${this._namespace}:${key}`;
  }

  _serialize(value) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return JSON.stringify(value);
  }

  _deserialize(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  destroy() {
    this._memoryStore.clear();
  }
}
