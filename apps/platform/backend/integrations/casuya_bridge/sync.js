"use strict";

// backend/integrations/casuya_bridge/sync.js — offline sync queue runner. Load after db.js, before index.js.

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
            setTimeout(() => {
                this.processQueueItem(item)
                    .then(() => {
                        this.syncQueue.delete(item.id);
                    })
                    .catch(e => this.handleSyncError(item, e));
            }, retryDelay);
        }

        await this.dbManager.put(this.dbManager.stores.syncQueue, item, item.id);
        this.syncQueue.set(item.id, item);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}