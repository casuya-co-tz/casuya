// integrations/casuya_bridge/index.js — public bridge entry. Load LAST, after db.js, conflicts.js and sync.js.

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