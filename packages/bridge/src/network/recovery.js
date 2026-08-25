/** Network recovery strategies: detects network restoration and
 * orchestrates staggered reconnection with exponential backoff. */

import { EVENTS } from '../core/constants.js';
import { sleep } from '../utils/helpers.js';

export class NetworkRecovery {
  constructor({ bus, config }) {
    this._bus = bus;
    this._config = config;
    this._recovering = false;
    this._recoveryAttempts = 0;
    this._timer = null;
    this._maxRecoveryDelayMs = 120_000;
  }

  start() {
    this._boundReconnect = () => this._onReconnect();
    this._bus?.on(EVENTS.CONNECTIVITY_ONLINE, this._boundReconnect);
  }

  stop() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    if (this._boundReconnect) {
      this._bus?.off(EVENTS.CONNECTIVITY_ONLINE, this._boundReconnect);
      this._boundReconnect = null;
    }
  }

  async _onReconnect() {
    this._recoveryAttempts = 0;
    this._recovering = true;
    try {
      await this._attemptRecovery();
    } finally {
      this._recovering = false;
    }
  }

  async _attemptRecovery() {
    while (this._recovering) {
      const delay = Math.min(
        this._maxRecoveryDelayMs,
        this._config.retryBaseDelayMs * 2 ** this._recoveryAttempts
      );
      await sleep(delay);
      this._recoveryAttempts += 1;
    }
  }

  get isRecovering() {
    return this._recovering;
  }
}