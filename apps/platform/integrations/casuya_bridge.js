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


class ConflictResolver {
    constructor(indexedDb) {
        this.db = indexedDb;
        this.strategies = {
            'last-write-wins': this.lastWriteWins.bind(this),
            'server-wins': this.serverWins.bind(this),
            'client-wins': this.clientWins.bind(this),
        };
        this.defaultStrategy = 'last-write-wins';
    }

    async resolve(storeName, localRecord, serverRecord) {
        if (!serverRecord) return localRecord;
        if (!localRecord) return serverRecord;

        const strategy = this.detectStrategy(storeName);
        return this.strategies[strategy](localRecord, serverRecord);
    }

    detectStrategy(storeName) {
        switch (storeName) {
            case 'student_progress':
            case 'learning_sessions':
                return 'last-write-wins';
            case 'lesson_packages':
                return 'server-wins';
            default:
                return this.defaultStrategy;
        }
    }

    lastWriteWins(local, server) {
        const localTime = new Date(local.timestamp || 0).getTime();
        const serverTime = new Date(server.timestamp || 0).getTime();

        if (localTime > serverTime) {
            return { ...local, resolvedBy: 'last-write-wins', source: 'local' };
        } else if (serverTime > localTime) {
            return { ...server, resolvedBy: 'last-write-wins', source: 'server' };
        }
        return { ...server, resolvedBy: 'last-write-wins', source: 'server' };
    }

    serverWins(local, server) {
        return { ...server, resolvedBy: 'server-wins', source: 'server' };
    }

    clientWins(local, server) {
        return { ...local, resolvedBy: 'client-wins', source: 'local' };
    }

    mergeProgress(local, server) {
        const merged = { ...server };
        const fields = ['completionPercentage', 'scorePercentage', 'elapsedTime'];

        for (const field of fields) {
            const lVal = local[field] || 0;
            const sVal = server[field] || 0;
            merged[field] = Math.max(lVal, sVal);
        }

        merged.resolvedBy = 'merge-max';
        merged.serverTimestamp = server.timestamp;
        merged.localTimestamp = local.timestamp;
        return merged;
    }
}


class SyncService {
    constructor(indexedDb, conflictResolver) {
        this.db = indexedDb;
        this.conflictResolver = conflictResolver;
        this.isSyncing = false;
        this.retryDelays = [1000, 5000, 15000, 30000, 60000];
    }

    async syncAll() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const queue = await this.db.getAll(this.db.stores.syncQueue);
            const unsynced = queue.filter(item => !item.synced);

            for (const item of unsynced) {
                await this.syncItem(item);
            }
        } finally {
            this.isSyncing = false;
        }
    }

    async syncItem(item) {
        let lastError;

        for (let attempt = 0; attempt <= (item.maxRetries || 3); attempt++) {
            try {
                const serverData = await this.sendToServer(item);
                const resolved = await this.conflictResolver.resolve(
                    item.storeName || 'student_progress',
                    item.data,
                    serverData
                );
                await this.handleSyncSuccess(item, resolved);
                return;
            } catch (err) {
                lastError = err;
                item.retries = (item.retries || 0) + 1;
                const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
                await this.sleep(delay);
            }
        }

        await this.handleSyncFailure(item, lastError);
    }

    async sendToServer(item) {
        const response = await fetch(`/api/sync/${item.type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
        });
        if (!response.ok) throw new Error(`Sync failed: ${response.statusText}`);
        return response.json();
    }

    async handleSyncSuccess(item, resolved) {
        const updated = { ...item, synced: true, resolvedData: resolved, syncedAt: new Date().toISOString() };
        await this.db.put(this.db.stores.syncQueue, updated);

        const progressStore = this.db.stores.studentProgress;
        if (resolved.source === 'server') {
            const existing = await this.db.get(progressStore, resolved.id);
            if (existing) {
                await this.db.put(progressStore, { ...existing, ...resolved, synced: true });
            }
        }
    }

    async handleSyncFailure(item, error) {
        const updated = {
            ...item,
            lastError: error.message,
            lastAttempt: new Date().toISOString(),
            status: 'failed',
        };
        await this.db.put(this.db.stores.syncQueue, updated);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


class CasuyaBridge {
    constructor() {
        this.db = new IndexedDBManager();
        this.conflictResolver = new ConflictResolver(this.db);
        this.syncService = new SyncService(this.db, this.conflictResolver);
        this._initialized = false;
    }

    async ensureInitialized() {
        if (!this._initialized) {
            await this.db.init();
            this._initialized = true;
        }
    }

    isOffline() {
        return !navigator.onLine;
    }

    async saveProgress(lessonId, studentId, progressData) {
        await this.ensureInitialized();
        const record = {
            id: `progress-${this.db.generateId()}`,
            lessonId,
            studentId,
            ...progressData,
            timestamp: new Date().toISOString(),
            synced: false,
        };
        await this.db.add(this.db.stores.studentProgress, record);

        const queueItem = {
            id: `sync-${this.db.generateId()}`,
            type: 'progress',
            storeName: 'student_progress',
            data: record,
            synced: false,
            retries: 0,
            maxRetries: 3,
            createdAt: new Date().toISOString(),
        };
        await this.db.add(this.db.stores.syncQueue, queueItem);

        if (!this.isOffline()) {
            this.syncService.syncAll().catch(() => {});
        }

        return record;
    }

    async getPendingCount() {
        await this.ensureInitialized();
        const queue = await this.db.getAll(this.db.stores.syncQueue);
        return queue.filter(item => !item.synced).length;
    }

    async getActiveSession(studentId) {
        await this.ensureInitialized();
        const sessions = await this.db.getAllByIndex(this.db.stores.sessions, 'active', true);
        return sessions.find(s => s.studentId === studentId) || null;
    }

    async storeSession(sessionData) {
        await this.ensureInitialized();
        const session = {
            id: `session-${this.db.generateId()}`,
            ...sessionData,
            active: true,
            timestamp: new Date().toISOString(),
        };
        await this.db.add(this.db.stores.sessions, session);
        return session;
    }

    async getLessonPackage(lessonId) {
        await this.ensureInitialized();
        const packages = await this.db.getAllByIndex(this.db.stores.lessonPackages, 'lessonId', lessonId);
        return packages[0] || null;
    }

    async cacheLessonPackage(lessonId, lessonData) {
        await this.ensureInitialized();
        const pkg = {
            id: `pkg-${this.db.generateId()}`,
            lessonId,
            data: lessonData,
            version: lessonData.version || 1,
            lastAccessed: new Date().toISOString(),
        };
        await this.db.put(this.db.stores.lessonPackages, pkg);
        return pkg;
    }

    async processQueueItem(item) {
        await this.ensureInitialized();
        await this.syncService.syncAll();
    }

    async getConflicts() {
        await this.ensureInitialized();
        const queue = await this.db.getAll(this.db.stores.syncQueue);
        return queue.filter(item => item.status === 'failed' && item.resolvedBy);
    }

    async forceResync(itemId) {
        await this.ensureInitialized();
        const item = await this.db.get(this.db.stores.syncQueue, itemId);
        if (item) {
            item.synced = false;
            item.retries = 0;
            item.status = 'pending';
            await this.db.put(this.db.stores.syncQueue, item);
            await this.syncService.syncAll();
        }
    }
}


window.CasuyaBridge = CasuyaBridge;
window.indexedDBManager = IndexedDBManager;
window.ConflictResolver = ConflictResolver;
window.SyncService = SyncService;
