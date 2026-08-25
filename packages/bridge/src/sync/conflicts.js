/** Conflict resolution strategies for sync events.
 * Supports last-write-wins and basic merge strategies. */

import { ConflictError } from '../core/errors.js';
import { uuid } from '../utils/uuid.js';

const STRATEGIES = {
  LWW: 'last-write-wins',
  MERGE: 'merge',
};

export class ConflictResolver {
  constructor(strategy = STRATEGIES.LWW) {
    this._strategy = strategy;
    this._conflictLog = [];
  }

  setStrategy(strategy) {
    if (!Object.values(STRATEGIES).includes(strategy)) {
      throw new ConflictError(`Unknown conflict strategy: ${strategy}`);
    }
    this._strategy = strategy;
  }

  async resolve(local, remote, { localTimestamp, remoteTimestamp } = {}) {
    const record = {
      id: uuid(),
      localVersion: local,
      remoteVersion: remote,
      localTimestamp,
      remoteTimestamp,
      strategy: this._strategy,
      resolved: null,
    };

    if (this._strategy === STRATEGIES.LWW) {
      const localTime = localTimestamp ?? 0;
      const remoteTime = remoteTimestamp ?? 0;
      record.resolved = localTime >= remoteTime ? local : remote;
      record.winner = localTime >= remoteTime ? 'local' : 'remote';
    } else if (this._strategy === STRATEGIES.MERGE) {
      record.resolved = this._merge(local, remote);
      record.winner = 'merge';
    }

    this._conflictLog.push(record);
    return record.resolved;
  }

  _merge(local, remote) {
    if (local === null || local === undefined) return remote;
    if (remote === null || remote === undefined) return local;
    if (typeof local !== 'object' || typeof remote !== 'object') return remote;
    if (Array.isArray(local) && Array.isArray(remote)) return this._mergeArrays(local, remote);
    return this._mergeObjects(local, remote);
  }

  _mergeObjects(local, remote) {
    const result = { ...local };
    for (const key of Object.keys(remote)) {
      if (key in local) {
        result[key] = this._merge(local[key], remote[key]);
      } else {
        result[key] = remote[key];
      }
    }
    return result;
  }

  _mergeArrays(local, remote) {
    const merged = [...local];
    for (const item of remote) {
      if (!merged.some((existing) => this._isEqual(existing, item))) {
        merged.push(item);
      }
    }
    return merged;
  }

  _isEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  getConflictLog() {
    return this._conflictLog;
  }

  clearLog() {
    this._conflictLog = [];
  }
}

export { STRATEGIES as CONFLICT_STRATEGIES };