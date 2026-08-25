/** Thin promise-based wrapper around IndexedDB, with an in-memory fallback
 * for environments where indexedDB is unavailable (Node/tests/older WebViews). */

import { StorageError } from '../core/errors.js';
import { STORES, DB_VERSION } from '../core/constants.js';

class MemoryStore {
  constructor() {
    this._tables = new Map();
    for (const store of Object.values(STORES)) this._tables.set(store, new Map());
  }

  async get(store, key) {
    return this._table(store).get(key) ?? null;
  }

  async put(store, key, value) {
    this._table(store).set(key, value);
    return value;
  }

  async delete(store, key) {
    this._table(store).delete(key);
  }

  async keys(store) {
    return [...this._table(store).keys()];
  }

  async values(store) {
    return [...this._table(store).values()];
  }

  async clear(store) {
    this._table(store).clear();
  }

  _table(store) {
    if (!this._tables.has(store)) this._tables.set(store, new Map());
    return this._tables.get(store);
  }
}

class IndexedDBStore {
  constructor(dbName, dbVersion) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
    this._dbPromise = this._open();
  }

  _open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new StorageError(`Failed to open IndexedDB '${this.dbName}'`, {
          cause: request.error,
        }));
    });
  }

  async _tx(store, mode) {
    const db = await this._dbPromise;
    return db.transaction(store, mode).objectStore(store);
  }

  async get(store, key) {
    const objectStore = await this._tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const req = objectStore.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(new StorageError('get failed', { cause: req.error }));
    });
  }

  async put(store, key, value) {
    const objectStore = await this._tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = objectStore.put(value, key);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(new StorageError('put failed', { cause: req.error }));
    });
  }

  async delete(store, key) {
    const objectStore = await this._tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = objectStore.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError('delete failed', { cause: req.error }));
    });
  }

  async keys(store) {
    const objectStore = await this._tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const req = objectStore.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new StorageError('keys failed', { cause: req.error }));
    });
  }

  async values(store) {
    const objectStore = await this._tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const req = objectStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new StorageError('values failed', { cause: req.error }));
    });
  }

  async clear(store) {
    const objectStore = await this._tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = objectStore.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError('clear failed', { cause: req.error }));
    });
  }
}

/** Returns an IndexedDB-backed store, or an in-memory store when
 * `indexedDB` is not available in the current environment. */
export function createStore(dbName, dbVersion = DB_VERSION) {
  if (typeof indexedDB !== 'undefined') {
    return new IndexedDBStore(dbName, dbVersion);
  }
  return new MemoryStore();
}

export { MemoryStore, IndexedDBStore };
