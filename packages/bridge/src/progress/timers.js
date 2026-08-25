/** Tracks time-on-task for a lesson session. */

export class SessionTimer {
  constructor(nowFn = Date.now) {
    this._now = nowFn;
    this._startedAt = null;
    this._accumulatedMs = 0;
  }

  start() {
    if (this._startedAt !== null) return; // already running
    this._startedAt = this._now();
  }

  pause() {
    if (this._startedAt === null) return;
    this._accumulatedMs += this._now() - this._startedAt;
    this._startedAt = null;
  }

  reset() {
    this._startedAt = null;
    this._accumulatedMs = 0;
  }

  get elapsedMs() {
    if (this._startedAt === null) return this._accumulatedMs;
    return this._accumulatedMs + (this._now() - this._startedAt);
  }

  get isRunning() {
    return this._startedAt !== null;
  }
}
