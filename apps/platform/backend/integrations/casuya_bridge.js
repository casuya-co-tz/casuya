"use strict";

const DB_NAME = 'casuya-offline';
const DB_VERSION = 1;

const IndexedDBManager = (() => {
    let instance;
    
    class IndexedDBManager {
        constructor() {
            if (instance) {
                return instance;
            }
            this.db = null;
            this.stores = {
                studentProgress: 'student_progress',
                sessions: 'learning_sessions',
                syncQueue: 'sync_queue',
                lessonPackages: 'lesson_packages',
                apiCache: 'api_responses'
            };
            instance = this;
        }
    }
    return IndexedDBManager;
})();

class SyncService {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.syncQueue = new Map();
        this.retryDelays = [1000, 5000, 15000, 30000, 60000];
    }

    async addToQueue(type, data, maxRetries = 3) {
        const queueItem = {
            id: this.generateId(),
            type,
            data,
            timestamp: Date.now(),
            retries: 0,
            maxRetries,
            status: 'pending'
        };
        
        await this.dbManager.add(this.dbManager.stores.syncQueue, queueItem);
        this.syncQueue.set(queueItem.id, queueItem);
        
        return queueItem;
    }

    async processQueue() {
        const queuedItems = await this.dbManager.getAll(this.dbManager.stores.syncQueue);
        const pendingItems = queuedItems.filter(item => item.status === 'pending');
        
        for (const item of pendingItems) {
            try {
                await this.processQueueItem(item);
                await this.dbManager.delete(this.dbManager.stores.syncQueue, item.id);
                this.syncQueue.delete(item.id);
            } catch (error) {
                await this.handleSyncError(item, error);
            }
        }
    }

    async processQueueItem(item) {
        switch (item.type) {
            case 'progress':
                await this.processProgressSync(item.data);
                break;
            case 'session':
                await this.processSessionSync(item.data);
                break;
            case 'package':
                await this.processPackageSync(item.data);
                break;
            default:
                throw new Error(`Unknown sync type: ${item.type}`);
        }
    }

    async processProgressSync(progressData) {
        const response = await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(progressData)
        });
        
        if (!response.ok) {
            throw new Error(`Progress sync failed: ${response.statusText}`);
        }
    }

    async processSessionSync(sessionData) {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        
        if (!response.ok) {
            throw new Error(`Session sync failed: ${response.statusText}`);
        }
    }

    async processPackageSync(packageData) {
        const response = await fetch(`/api/packages/${packageData.lessonId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packageData)
        });
        
        if (!response.ok) {
            throw new Error(`Package sync failed: ${response.statusText}`);
        }
    }

    async handleSyncError(item, error) {
        item.retries++;
        
        if (item.retries >= item.maxRetries) {
            item.status = 'failed';
            console.error(`Sync failed permanently for item ${item.id}:`, error);
        } else {
            item.status = 'retrying';
            const retryDelay = this.retryDelays[Math.min(item.retries - 1, this.retryDelays.length - 1)];
            setTimeout(() => this.processQueueItem(item).catch(e => this.handleSyncError(item, e)), retryDelay);
        }
        
        await this.dbManager.put(this.dbManager.stores.syncQueue, item, item.id);
        this.syncQueue.set(item.id, item);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

class ConflictResolver {
    constructor() {}

    async resolveConflict(localData, serverData) {
        if (!localData || !serverData) {
            return serverData || localData;
        }

        if (localData.timestamp > serverData.timestamp) {
            return { action: 'keep_local', data: localData };
        } else if (serverData.timestamp > localData.timestamp) {
            return { action: 'pull_server', data: serverData };
        } else {
            return { action: 'pull_server', data: serverData };
        }
    }

    async detectConflicts(localData, serverData) {
        const conflicts = [];
        
        if (localData && serverData) {
            if (localData.completionPercentage !== serverData.completionPercentage) {
                conflicts.push('completionPercentage');
            }
            
            if (localData.scorePercentage !== serverData.scorePercentage) {
                conflicts.push('scorePercentage');
            }
            
            if (localData.elapsedTime !== serverData.elapsedTime) {
                conflicts.push('elapsedTime');
            }
        }
        
        return conflicts.length > 0 ? conflicts : null;
    }
}

class CasuyaBridge {
    constructor() {
        this.dbManager = new IndexedDBManager();
        this.syncService = new SyncService(this.dbManager);
        this.conflictResolver = new ConflictResolver();
        this.isInitialized = false;
        this.isOnline = navigator.onLine;
        this.pendingOperations = [];
        
        window.addEventListener('online', () => this.handleConnectivityChange(true));
        window.addEventListener('offline', () => this.handleConnectivityChange(false));
    }

    async init() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            await this.dbManager.init();
            this.isInitialized = true;
            console.log('Casuya Bridge initialized successfully');
            
            if (this.isOnline) {
                await this.syncService.processQueue();
            }
        } catch (error) {
            console.error('Failed to initialize Casuya Bridge:', error);
            setTimeout(() => this.init(), 1000);
        }
    }

    handleConnectivityChange(isOnline) {
        this.isOnline = isOnline;
        
        if (isOnline) {
            console.log('Network connection restored, starting sync...');
            this.syncService.processQueue().catch(error => {
                console.error('Sync failed:', error);
            });
        } else {
            console.log('Network connection lost, going offline...');
        }
    }

    async saveProgress(lessonId, studentId, progressData) {
        const progressRecord = {
            id: this.generateId(),
            lessonId,
            studentId,
            sessionId: progressData.sessionId,
            elapsedMs: progressData.elapsedMs,
            completionPercentage: progressData.completionPercentage,
            scorePercentage: progressData.scorePercentage,
            timestamp: Date.now(),
            synced: false
        };
        
        await this.dbManager.add(this.dbManager.stores.studentProgress, progressRecord);
        await this.syncService.addToQueue('progress', progressRecord);
        
        return progressRecord;
    }

    async cacheLessonPackage(lessonId, packageData) {
        const package = {
            lessonId,
            data: packageData.html,
            metadata: packageData.metadata,
            timestamp: Date.now(),
            version: packageData.version || '1.0',
            lastAccessed: Date.now(),
            accessCount: 0
        };
        
        await this.dbManager.put(this.dbManager.stores.lessonPackages, package, lessonId);
    }

    async getLessonPackage(lessonId) {
        let package = await this.dbManager.get(this.dbManager.stores.lessonPackages, lessonId);
        
        if (package) {
            package.accessCount++;
            await this.dbManager.put(this.dbManager.stores.lessonPackages, package, lessonId);
        }
        
        return package;
    }

    async storeSession(sessionData) {
        const session = {
            id: this.generateSessionId(),
            studentId: sessionData.studentId,
            courseId: sessionData.courseId,
            lessonId: sessionData.lessonId,
            progress: sessionData.progress,
            lastActivity: Date.now(),
            active: true,
            synced: false
        };
        
        await this.dbManager.add(this.dbManager.stores.sessions, session);
        return session;
    }

    async getActiveSession(studentId) {
        const sessions = await this.dbManager.getAllByIndex(
            this.dbManager.stores.sessions,
            'active',
            true
        );
        
        return sessions.find(session => session.studentId === studentId) || null;
    }

    async clearSession(sessionId) {
        await this.dbManager.delete(this.dbManager.stores.sessions, sessionId);
    }

    async markSessionInactive(sessionId) {
        const session = await this.dbManager.get(this.dbManager.stores.sessions, sessionId);
        if (session) {
            session.active = false;
            session.synced = false;
            await this.dbManager.put(this.dbManager.stores.sessions, session, sessionId);
            await this.syncService.addToQueue('session', session);
        }
    }

    async cacheApiResponse(key, data, ttl = 3600000) {
        const response = {
            key,
            data,
            timestamp: Date.now(),
            ttl
        };
        
        await this.dbManager.put(this.dbManager.stores.apiCache, response, key);
    }

    async getApiResponse(key) {
        const response = await this.dbManager.get(this.dbManager.stores.apiCache, key);
        
        if (response && Date.now() - response.timestamp < response.ttl) {
            return response.data;
        }
        
        if (response) {
            await this.dbManager.delete(this.dbManager.stores.apiCache, key);
        }
        
        return null;
    }

    async processQueueItem(item) {
        await this.syncService.processQueueItem(item);
    }

    async getPendingCount() {
        const queuedItems = await this.dbManager.getAll(this.dbManager.stores.syncQueue);
        return queuedItems.filter(item => item.status === 'pending').length;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    generateSessionId() {
        return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    isOffline() {
        return !this.isOnline;
    }
}

const casuyaBridge = new CasuyaBridge();

window.casuyaBridge = casuyaBridge;
