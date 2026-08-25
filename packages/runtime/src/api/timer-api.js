export class TimerAPI {
  constructor(options = {}) {
    this._options = {
      eventBus: null,
      ...options
    };
    this._timers = new Map();
    this._counter = 0;
    this._listeners = new Map();
  }

  create(duration, options = {}) {
    const id = `timer_${++this._counter}`;
    const timer = {
      id,
      duration,
      remaining: duration,
      elapsed: 0,
      running: false,
      finished: false,
      paused: false,
      startTime: null,
      options: {
        autostart: options.autostart ?? true,
        countdown: options.countdown ?? true,
        interval: options.interval ?? 1000,
        repeat: options.repeat ?? false,
        ...options
      },
      intervalId: null,
      callbacks: {
        onTick: options.onTick || null,
        onFinish: options.onFinish || null,
        onPause: options.onPause || null,
        onResume: options.onResume || null
      }
    };
    this._timers.set(id, timer);
    if (timer.options.autostart) {
      this.start(id);
    }
    this._emit('timer:created', { id, duration });
    return id;
  }

  start(id) {
    const timer = this._timers.get(id);
    if (!timer || timer.running) return false;
    timer.running = true;
    timer.paused = false;
    timer.startTime = performance.now() - timer.elapsed;
    timer.intervalId = setInterval(() => {
      this._tick(id);
    }, timer.options.interval);
    this._emit('timer:started', { id });
    return true;
  }

  pause(id) {
    const timer = this._timers.get(id);
    if (!timer || !timer.running || timer.paused) return false;
    timer.paused = true;
    timer.running = false;
    clearInterval(timer.intervalId);
    timer.elapsed = performance.now() - timer.startTime;
    if (timer.options.countdown) {
      timer.remaining = Math.max(0, timer.duration - timer.elapsed);
    }
    if (timer.callbacks.onPause) {
      try { timer.callbacks.onPause(timer.remaining); } catch {}
    }
    this._emit('timer:paused', { id, remaining: timer.remaining });
    return true;
  }

  resume(id) {
    const timer = this._timers.get(id);
    if (!timer || timer.running || !timer.paused) return false;
    timer.running = true;
    timer.paused = false;
    timer.startTime = performance.now() - timer.elapsed;
    timer.intervalId = setInterval(() => {
      this._tick(id);
    }, timer.options.interval);
    if (timer.callbacks.onResume) {
      try { timer.callbacks.onResume(timer.remaining); } catch {}
    }
    this._emit('timer:resumed', { id, remaining: timer.remaining });
    return true;
  }

  stop(id) {
    const timer = this._timers.get(id);
    if (!timer) return false;
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.paused = false;
    timer.elapsed = 0;
    timer.remaining = timer.duration;
    this._emit('timer:stopped', { id });
    return true;
  }

  reset(id) {
    const timer = this._timers.get(id);
    if (!timer) return false;
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.paused = false;
    timer.elapsed = 0;
    timer.remaining = timer.duration;
    timer.finished = false;
    this._emit('timer:reset', { id });
    return true;
  }

  remove(id) {
    const timer = this._timers.get(id);
    if (!timer) return false;
    clearInterval(timer.intervalId);
    this._timers.delete(id);
    this._emit('timer:removed', { id });
    return true;
  }

  getTime(id) {
    const timer = this._timers.get(id);
    if (!timer) return null;
    if (timer.running) {
      const currentElapsed = performance.now() - timer.startTime;
      return {
        elapsed: currentElapsed,
        remaining: Math.max(0, timer.duration - currentElapsed),
        duration: timer.duration,
        running: true,
        paused: false,
        finished: false
      };
    }
    return {
      elapsed: timer.elapsed,
      remaining: timer.remaining,
      duration: timer.duration,
      running: timer.running,
      paused: timer.paused,
      finished: timer.finished
    };
  }

  getRemaining(id) {
    const time = this.getTime(id);
    return time ? time.remaining : null;
  }

  getElapsed(id) {
    const time = this.getTime(id);
    return time ? time.elapsed : null;
  }

  isRunning(id) {
    const timer = this._timers.get(id);
    return timer ? timer.running : false;
  }

  isFinished(id) {
    const timer = this._timers.get(id);
    return timer ? timer.finished : false;
  }

  getAllTimers() {
    const result = {};
    for (const [id, timer] of this._timers) {
      result[id] = this.getTime(id);
    }
    return result;
  }

  pauseAll() {
    for (const id of this._timers.keys()) {
      if (this._timers.get(id).running) {
        this.pause(id);
      }
    }
  }

  resumeAll() {
    for (const id of this._timers.keys()) {
      if (this._timers.get(id).paused) {
        this.resume(id);
      }
    }
  }

  stopAll() {
    for (const id of this._timers.keys()) {
      this.stop(id);
    }
  }

  removeAll() {
    for (const id of this._timers.keys()) {
      this.remove(id);
    }
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

  destroy() {
    for (const timer of this._timers.values()) {
      clearInterval(timer.intervalId);
    }
    this._timers.clear();
    this._listeners.clear();
  }

  _tick(id) {
    const timer = this._timers.get(id);
    if (!timer) return;
    if (timer.options.countdown) {
      timer.remaining = Math.max(0, timer.duration - (performance.now() - timer.startTime));
      if (timer.remaining <= 0) {
        this._finish(id);
        return;
      }
    } else {
      timer.elapsed = performance.now() - timer.startTime;
    }
    if (timer.callbacks.onTick) {
      try {
        timer.callbacks.onTick(timer.options.countdown ? timer.remaining : timer.elapsed);
      } catch {}
    }
    this._emit('timer:tick', { id, remaining: timer.remaining, elapsed: timer.elapsed });
  }

  _finish(id) {
    const timer = this._timers.get(id);
    if (!timer) return;
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.finished = true;
    timer.remaining = 0;
    timer.elapsed = timer.duration;
    if (timer.callbacks.onFinish) {
      try { timer.callbacks.onFinish(); } catch {}
    }
    this._emit('timer:finished', { id });
    if (timer.options.repeat) {
      this.reset(id);
      this.start(id);
    }
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
}
