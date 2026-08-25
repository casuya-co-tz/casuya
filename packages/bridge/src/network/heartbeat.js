/** Periodically pings a health endpoint to confirm reachability beyond the
 * (sometimes unreliable) browser online/offline events. */

export class Heartbeat {
  constructor({ url, intervalMs = 30_000, fetchImpl = fetch, onChange }) {
    this._url = url;
    this._intervalMs = intervalMs;
    this._fetchImpl = fetchImpl;
    this._onChange = onChange;
    this._timer = null;
    this._reachable = null;
  }

  start() {
    this._tick();
    this._timer = setInterval(() => this._tick(), this._intervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _tick() {
    let reachable = false;
    try {
      const response = await this._fetchImpl(this._url, { method: 'HEAD' });
      reachable = response.ok;
    } catch {
      reachable = false;
    }
    if (reachable !== this._reachable) {
      this._reachable = reachable;
      this._onChange?.(reachable);
    }
  }

  get isReachable() {
    return this._reachable;
  }
}
