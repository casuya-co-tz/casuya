const fs = require('fs');
const path = require('path');

const INDEXEDB_DB_PATH = path.join(__dirname, '../../storage/indexeddb.db');

class IndexedDBBackup {
    static async createBackup() {
        if (!fs.existsSync(INDEXEDB_DB_PATH)) {
            console.log('IndexedDB database not found, skipping backup');
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, '../../storage/backups/indexeddb-backup-' + timestamp + '.db');
        
        fs.copyFileSync(INDEXEDB_DB_PATH, backupPath);
        console.log(`IndexedDB backup created: ${backupPath}`);
        
        return backupPath;
    }

    static async restoreBackup(backupPath) {
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }
        
        if (!fs.existsSync(INDEXEDB_DB_PATH)) {
            console.log('Creating IndexedDB database directory');
            fs.mkdirSync(path.dirname(INDEXEDB_DB_PATH), { recursive: true });
        }
        
        fs.copyFileSync(backupPath, INDEXEDB_DB_PATH);
        console.log(`IndexedDB restored from: ${backupPath}`);
    }
}

module.exports = { IndexedDBBackup };
