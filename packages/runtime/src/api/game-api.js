export class GameAPI {
  constructor(options = {}) {
    this._options = {
      stateManager: null,
      eventBus: null,
      ...options
    };
    this._state = {};
    this._scores = {};
    this._leaderboards = {};
    this._listeners = new Map();
  }

  setState(key, value) {
    this._state[key] = value;
    this._saveToState('gameState', key, value);
    this._emit('game:stateChanged', { key, value });
  }

  getState(key) {
    if (key === undefined) return { ...this._state };
    return this._state[key];
  }

  incrementScore(points = 1, reason = '') {
    const total = (this._scores.total || 0) + points;
    this._scores.total = total;
    this._scores.lastIncrement = { points, reason, timestamp: Date.now() };
    this._emit('game:scoreChanged', { total, points, reason });
    return total;
  }

  getScore() {
    return this._scores.total || 0;
  }

  setScore(score) {
    const old = this._scores.total || 0;
    this._scores.total = score;
    this._emit('game:scoreChanged', { total: score, points: score - old, reason: 'set' });
  }

  submitScore(leaderboardId, score, metadata = {}) {
    if (!this._leaderboards[leaderboardId]) {
      this._leaderboards[leaderboardId] = [];
    }
    const entry = {
      score,
      metadata,
      timestamp: Date.now()
    };
    this._leaderboards[leaderboardId].push(entry);
    this._leaderboards[leaderboardId].sort((a, b) => b.score - a.score);
    if (this._leaderboards[leaderboardId].length > 100) {
      this._leaderboards[leaderboardId] = this._leaderboards[leaderboardId].slice(0, 100);
    }
    this._emit('game:scoreSubmitted', { leaderboardId, entry });
    return entry;
  }

  getLeaderboard(leaderboardId, limit = 10) {
    const board = this._leaderboards[leaderboardId] || [];
    return board.slice(0, limit);
  }

  getLevel() {
    return this._state.level || 1;
  }

  setLevel(level) {
    this.setState('level', level);
    this._emit('game:levelChanged', { level });
  }

  getLives() {
    return this._state.lives !== undefined ? this._state.lives : 3;
  }

  setLives(lives) {
    this.setState('lives', Math.max(0, lives));
  }

  getHealth() {
    return this._state.health !== undefined ? this._state.health : 100;
  }

  setHealth(health) {
    this.setState('health', Math.max(0, Math.min(100, health)));
  }

  getCoins() {
    return this._state.coins || 0;
  }

  addCoins(amount) {
    const coins = (this._state.coins || 0) + Math.max(0, amount);
    this.setState('coins', coins);
    this._emit('game:coinsChanged', { coins, added: amount });
    return coins;
  }

  spendCoins(amount) {
    const coins = this._state.coins || 0;
    if (coins < amount) return false;
    this.setState('coins', coins - amount);
    this._emit('game:coinsChanged', { coins: coins - amount, spent: amount });
    return true;
  }

  isCompleted(level) {
    return !!this._state.completedLevels?.includes(level);
  }

  completeLevel(level) {
    const completed = this._state.completedLevels || [];
    if (!completed.includes(level)) {
      completed.push(level);
    }
    this.setState('completedLevels', completed);
    this._emit('game:levelCompleted', { level });
  }

  getCompletedLevels() {
    return this._state.completedLevels || [];
  }

  reset() {
    this._state = {};
    this._scores = {};
    this._emit('game:reset', {});
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch {}
      }
    }
    this._options.eventBus?.emit(event, data);
  }

  _saveToState(key, id, value) {
    if (this._options.stateManager) {
      this._options.stateManager.set(`${key}.${id}`, value);
    }
  }

  destroy() {
    this._listeners.clear();
    this._state = {};
    this._scores = {};
  }
}
