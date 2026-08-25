export class Timer {
  constructor() {
    this._startTime = null;
    this._elapsed = 0;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._startTime = performance.now();
    this._running = true;
    return this;
  }

  stop() {
    if (!this._running) return this._elapsed;
    this._elapsed += performance.now() - this._startTime;
    this._running = false;
    this._startTime = null;
    return this._elapsed;
  }

  reset() {
    this._startTime = null;
    this._elapsed = 0;
    this._running = false;
    return this;
  }

  get elapsed() {
    if (this._running) {
      return this._elapsed + (performance.now() - this._startTime);
    }
    return this._elapsed;
  }

  get running() {
    return this._running;
  }

  static measure(fn) {
    const t = new Timer();
    t.start();
    fn();
    return t.stop();
  }

  static async measureAsync(fn) {
    const t = new Timer();
    t.start();
    await fn();
    return t.stop();
  }
}
