"use strict";

// backend/integrations/casuya_bridge/db.js — IndexedDB connection settings + singleton shell.
// Load before sync.js / conflicts.js / index.js.

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