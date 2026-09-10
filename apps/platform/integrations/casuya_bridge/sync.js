// integrations/casuya_bridge/sync.js — offline sync queue runner. Load after db.js, before index.js.

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

window.SyncService = SyncService;