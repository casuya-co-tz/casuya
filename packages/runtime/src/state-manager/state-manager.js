import { deepClone } from '../utilities/object-utils.js';
import { IdGenerator } from '../utilities/id-generator.js';

export class StateManager {
  constructor(options = {}) {
    this._options = {
      maxSnapshots: 10,
      storage: null,
      eventBus: null,
      ...options
    };
    this._state = {};
    this._snapshots = [];
    this._lastSnapshot = null;
    this._listeners = new Map();
  }

  initialize(pkg) {
    this._state = {
      packageId: pkg?.id || pkg?.manifest?.id,
      packageVersion: pkg?.manifest?.version,
      startedAt: Date.now(),
      currentSlide: null,
      currentSlideIndex: 0,
      totalSlides: pkg?.manifest?.slides?.length || 0,
      quizAnswers: {},
      quizScores: {},
      gameState: {},
      variables: {},
      mediaState: {},
      timerState: {},
      completed: false,
      completedSlides: [],
      metadata: {}
    };
    this._options.eventBus?.emit('state:initialized', { state: this._state });
    return this;
  }

  get(key) {
    if (key === undefined) return deepClone(this._state);
    const keys = key.split('.');
    let current = this._state;
    for (const k of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[k];
    }
    return current;
  }

  set(key, value) {
    const keys = key.split('.');
    let current = this._state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined || current[keys[i]] === null) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    const changed = current[keys[keys.length - 1]] !== value;
    current[keys[keys.length - 1]] = value;
    if (changed) {
      this._options.eventBus?.emit('state:changed', { key, value });
      this._notifyListeners(key, value);
    }
    return this;
  }

  merge(updates) {
    const changed = this._mergeDeep(this._state, updates);
    if (changed) {
      this._options.eventBus?.emit('state:merged', { updates });
    }
    return this;
  }

  snapshot() {
    const snapshot = {
      id: IdGenerator.generate('snap'),
      timestamp: Date.now(),
      state: deepClone(this._state)
    };
    this._snapshots.push(snapshot);
    if (this._snapshots.length > this._options.maxSnapshots) {
      this._snapshots.shift();
    }
    this._lastSnapshot = snapshot;
    this._options.eventBus?.emit('state:snapshot', { snapshot });
    return snapshot;
  }

  restore(snapshot) {
    if (!snapshot) return false;
    const stateData = snapshot.state || snapshot;
    this._state = deepClone(stateData);
    this._options.eventBus?.emit('state:restored', { state: this._state });
    return true;
  }

  getLastSnapshot() {
    return this._lastSnapshot ? deepClone(this._lastSnapshot) : null;
  }

  getSnapshots() {
    return this._snapshots.map(s => deepClone(s));
  }

  clearSnapshots() {
    this._snapshots = [];
    this._lastSnapshot = null;
  }

  watch(key, listener) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, []);
    }
    this._listeners.get(key).push(listener);
    return () => this.unwatch(key, listener);
  }

  unwatch(key, listener) {
    if (!this._listeners.has(key)) return;
    this._listeners.set(key, this._listeners.get(key).filter(l => l !== listener));
  }

  reset() {
    this._state = {};
    this._snapshots = [];
    this._lastSnapshot = null;
    this._options.eventBus?.emit('state:reset', {});
  }

  toJSON() {
    return deepClone(this._state);
  }

  _mergeDeep(target, source) {
    let changed = false;
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
        if (this._mergeDeep(target[key], source[key])) {
          changed = true;
        }
      } else if (target[key] !== source[key]) {
        target[key] = source[key];
        changed = true;
      }
    }
    return changed;
  }

  _notifyListeners(key, value) {
    for (const [watchKey, listeners] of this._listeners) {
      if (key.startsWith(watchKey) || watchKey.startsWith(key)) {
        for (const listener of listeners) {
          try { listener(key, value, deepClone(this._state)); } catch {}
        }
      }
    }
  }
}
