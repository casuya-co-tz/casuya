/** Data migration engine for versioned storage upgrades.
 * Each migration is a function that transforms stored data
 * from one version to the next. */

import { MigrationError } from '../core/errors.js';
import { STORES } from '../core/constants.js';

export class MigrationEngine {
  constructor({ db, currentVersion = 1 }) {
    this._db = db;
    this._currentVersion = currentVersion;
    this._migrations = new Map();
  }

  register(version, fn) {
    if (this._migrations.has(version)) {
      throw new MigrationError(`Migration for version ${version} already registered`);
    }
    this._migrations.set(version, fn);
  }

  async run() {
    const storedVersion = await this._getStoredVersion();
    if (storedVersion >= this._currentVersion) return { migrated: false };

    const sorted = [...this._migrations.keys()].sort((a, b) => a - b);
    const pending = sorted.filter((v) => v > storedVersion && v <= this._currentVersion);

    for (const version of pending) {
      const fn = this._migrations.get(version);
      try {
        await fn(this._db);
      } catch (err) {
        throw new MigrationError(`Migration v${version} failed`, { cause: err });
      }
    }

    await this._setStoredVersion(this._currentVersion);
    return { migrated: true, versions: pending };
  }

  async _getStoredVersion() {
    try {
      const v = await this._db.get(STORES.META, 'schema_version');
      return v ?? 0;
    } catch {
      return 0;
    }
  }

  async _setStoredVersion(version) {
    await this._db.put(STORES.META, 'schema_version', version);
  }
}