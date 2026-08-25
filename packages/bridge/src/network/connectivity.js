/** Tracks online/offline state, preferring the browser's connectivity
 * events but tolerating environments where `navigator` is unavailable. */

import { EVENTS } from '../core/constants.js';

export class ConnectivityMonitor {
  constructor(bus) {
    this._bus = bus;
    this._online = typeof navigator === 'undefined' ? true : navigator.onLine;
    this._boundOnline = () => this._setOnline(true);
    this._boundOffline = () => this._setOnline(false);
  }

  start() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._boundOnline);
      window.addEventListener('offline', this._boundOffline);
    }
  }

  stop() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._boundOnline);
      window.removeEventListener('offline', this._boundOffline);
    }
  }

  get isOnline() {
    return this._online;
  }

  _setOnline(value) {
    if (this._online === value) return;
    this._online = value;
    this._bus?.emit(value ? EVENTS.CONNECTIVITY_ONLINE : EVENTS.CONNECTIVITY_OFFLINE);
  }

  /** Allows tests / non-browser callers to simulate a connectivity change. */
  simulate(online) {
    this._setOnline(online);
  }
}
