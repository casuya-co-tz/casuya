import { IdGenerator } from '../utilities/id-generator.js';
import { deepClone } from '../utilities/object-utils.js';

export class SessionManager {
  constructor(options = {}) {
    this._options = {
      timeout: 30 * 60 * 1000,
      storage: null,
      stateManager: null,
      eventBus: null,
      ...options
    };
    this._sessions = new Map();
    this._currentSessionId = null;
    this._timeoutTimers = new Map();
  }

  create(data = {}) {
    const session = {
      id: IdGenerator.generate('sess'),
      packageId: data.packageId || '',
      version: data.version || '1.0.0',
      startedAt: Date.now(),
      lastActivity: Date.now(),
      pausedAt: null,
      totalPausedTime: 0,
      state: data.state || null,
      progress: data.progress || {},
      metadata: data.metadata || {},
      status: 'active'
    };

    this._sessions.set(session.id, session);
    this._currentSessionId = session.id;
    this._startTimeoutTimer(session.id);

    this._options.eventBus?.emit('session:created', { session });
    return session;
  }

  async restore(sessionId) {
    if (this._sessions.has(sessionId)) {
      const session = this._sessions.get(sessionId);
      if (this._isExpired(session)) {
        this._sessions.delete(sessionId);
        this._options.eventBus?.emit('session:expired', { sessionId });
        return null;
      }
      session.status = 'active';
      session.lastActivity = Date.now();
      this._currentSessionId = sessionId;
      this._startTimeoutTimer(sessionId);
      this._options.eventBus?.emit('session:restored', { session });
      return deepClone(session);
    }
    if (this._options.storage) {
      try {
        const stored = await this._options.storage.get(`session:${sessionId}`);
        if (stored) {
          const session = typeof stored === 'string' ? JSON.parse(stored) : stored;
          if (this._isExpired(session)) {
            this._options.eventBus?.emit('session:expired', { sessionId });
            return null;
          }
          session.status = 'active';
          session.lastActivity = Date.now();
          this._sessions.set(sessionId, session);
          this._currentSessionId = sessionId;
          this._startTimeoutTimer(sessionId);
          this._options.eventBus?.emit('session:restored', { session });
          return deepClone(session);
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  getCurrent() {
    if (!this._currentSessionId) return null;
    return this._sessions.get(this._currentSessionId) || null;
  }

  get(sessionId) {
    const session = this._sessions.get(sessionId);
    return session ? deepClone(session) : null;
  }

  async save(sessionId, data = {}) {
    const session = this._sessions.get(sessionId);
    if (!session) return false;
    if (data.state) session.state = data.state;
    if (data.progress) session.progress = data.progress;
    if (data.metadata) Object.assign(session.metadata, data.metadata);
    session.lastActivity = Date.now();
    if (this._options.storage) {
      try {
        await this._options.storage.set(`session:${sessionId}`, JSON.stringify(session));
      } catch {}
    }
    this._options.eventBus?.emit('session:saved', { sessionId });
    return true;
  }

  pause(sessionId) {
    const session = this._sessions.get(sessionId || this._currentSessionId);
    if (!session) return false;
    if (session.status === 'paused') return true;
    session.status = 'paused';
    session.pausedAt = Date.now();
    this._clearTimeoutTimer(sessionId);
    this._options.eventBus?.emit('session:paused', { sessionId });
    this._saveToStorage(sessionId);
    return true;
  }

  resume(sessionId) {
    const session = this._sessions.get(sessionId || this._currentSessionId);
    if (!session) return false;
    if (session.status !== 'paused') return true;
    if (session.pausedAt) {
      session.totalPausedTime += Date.now() - session.pausedAt;
    }
    session.status = 'active';
    session.pausedAt = null;
    session.lastActivity = Date.now();
    this._startTimeoutTimer(sessionId);
    this._options.eventBus?.emit('session:resumed', { sessionId });
    return true;
  }

  async end(sessionId) {
    const session = this._sessions.get(sessionId || this._currentSessionId);
    if (!session) return false;
    session.status = 'completed';
    session.endedAt = Date.now();
    this._clearTimeoutTimer(sessionId);
    this._options.eventBus?.emit('session:ended', { session });
    if (this._options.storage) {
      try {
        await this._options.storage.set(`session:${sessionId}:archived`, JSON.stringify(session));
        await this._options.storage.delete(`session:${sessionId}`);
      } catch {}
    }
    this._sessions.delete(sessionId);
    if (this._currentSessionId === sessionId) {
      this._currentSessionId = null;
    }
    return true;
  }

  touch(sessionId) {
    const session = this._sessions.get(sessionId || this._currentSessionId);
    if (!session || session.status !== 'active') return;
    session.lastActivity = Date.now();
    this._startTimeoutTimer(sessionId);
  }

  getActiveSessions() {
    const active = [];
    for (const session of this._sessions.values()) {
      if (session.status === 'active') {
        active.push(deepClone(session));
      }
    }
    return active;
  }

  _isExpired(session) {
    if (session.status === 'completed') return true;
    if (session.status === 'paused') return false;
    const elapsed = Date.now() - session.lastActivity;
    return elapsed > this._options.timeout;
  }

  _startTimeoutTimer(sessionId) {
    this._clearTimeoutTimer(sessionId);
    const timer = setTimeout(() => {
      const session = this._sessions.get(sessionId);
      if (session && session.status === 'active') {
        session.status = 'timedout';
        this._options.eventBus?.emit('session:timeout', { sessionId });
        this._options.eventBus?.emit('session:timedout', { session });
      }
    }, this._options.timeout);
    this._timeoutTimers.set(sessionId, timer);
  }

  _clearTimeoutTimer(sessionId) {
    if (this._timeoutTimers.has(sessionId)) {
      clearTimeout(this._timeoutTimers.get(sessionId));
      this._timeoutTimers.delete(sessionId);
    }
  }

  async _saveToStorage(sessionId) {
    const session = this._sessions.get(sessionId);
    if (session && this._options.storage) {
      try {
        await this._options.storage.set(`session:${sessionId}`, JSON.stringify(session));
      } catch {}
    }
  }

  destroy() {
    for (const [id, timer] of this._timeoutTimers) {
      clearTimeout(timer);
    }
    this._timeoutTimers.clear();
    this._sessions.clear();
    this._currentSessionId = null;
  }
}
