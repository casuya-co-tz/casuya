// integrations/casuya_bridge/conflicts.js — conflict resolution strategies. Load before index.js.

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

window.ConflictResolver = ConflictResolver;