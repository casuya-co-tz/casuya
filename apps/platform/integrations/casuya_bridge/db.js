// integrations/casuya_bridge/db.js — IndexedDB layer. Load before sync.js / index.js.

class IndexedDBManager {
    constructor() {
        this.db = null;
        this.stores = {
            studentProgress: 'student_progress',
            sessions: 'learning_sessions',
            syncQueue: 'sync_queue',
            lessonPackages: 'lesson_packages',
            apiCache: 'api_responses'
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('casuya-offline', 2);
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                const tx = event.target.transaction;
                Object.values(this.stores).forEach(storeName => {
                    if (!this.db.objectStoreNames.contains(storeName)) {
                        const store = this.db.createObjectStore(storeName, { keyPath: 'id' });
                        this.setupStoreIndexes(store, storeName);
                    }
                });
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.setupStoreHandlers();
                resolve();
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    setupStoreIndexes(store, storeName) {
        switch (storeName) {
            case this.stores.studentProgress:
                store.createIndex('lessonId', 'lessonId', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('studentId', 'studentId', { unique: false });
                break;
            case this.stores.sessions:
                store.createIndex('active', 'active', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                break;
            case this.stores.syncQueue:
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
                store.createIndex('retries', 'retries', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                break;
            case this.stores.lessonPackages:
                store.createIndex('lessonId', 'lessonId', { unique: true });
                store.createIndex('version', 'version', { unique: false });
                store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                break;
            case this.stores.apiCache:
                store.createIndex('key', 'key', { unique: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                break;
        }
    }

    setupStoreHandlers() {
        this.db.onerror = event => console.error('IndexedDB error:', event.target.error);
    }

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
}

window.indexedDBManager = IndexedDBManager;