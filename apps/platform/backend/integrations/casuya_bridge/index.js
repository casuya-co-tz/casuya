"use strict";

// backend/integrations/casuya_bridge/index.js — public bridge entry.
// Load LAST, after db.js, sync.js and conflicts.js.

class CasuyaBridge {
    constructor() {
        this.dbManager = new IndexedDBManager();
        this.syncService = new SyncService(this.dbManager);
        this.conflictResolver = new ConflictResolver();
        this.isInitialized = false;
        this.isOnline = navigator.onLine;
        this.pendingOperations = [];
        this.initRetries = 0;
        this.maxInitRetries = 5;

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
            this.initRetries = 0;
            console.log('Casuya Bridge initialized successfully');

            if (this.isOnline) {
                await this.syncService.processQueue();
            }
        } catch (error) {
            this.initRetries++;
            console.error('Failed to initialize Casuya Bridge:', error);
            if (this.initRetries < this.maxInitRetries) {
                setTimeout(() => this.init(), 1000);
            } else {
                console.error('Max init retries reached. Casuya Bridge initialization failed.');
            }
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