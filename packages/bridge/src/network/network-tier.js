/** Detects network quality tier using the Network Information API
 * (navigator.connection). Falls back gracefully in environments where
 * the API is unavailable (Node, older browsers, some WebViews).
 *
 * Tier classification:
 *   'slow-2g'  — effectiveType === 'slow-2g' or downlink <= 0.05 Mbps
 *   '2g'       — effectiveType === '2g' or downlink <= 0.15 Mbps
 *   '3g'       — effectiveType === '3g' or downlink <= 0.7 Mbps
 *   '4g'       — effectiveType === '4g' or downlink > 0.7 Mbps
 *   'unknown'  — API unavailable or connection type not reported
 */

import { EVENTS } from '../core/constants.js';

export const NETWORK_TIERS = Object.freeze({
  SLOW_2G: 'slow-2g',
  G2: '2g',
  G3: '3g',
  G4: '4g',
  UNKNOWN: 'unknown',
});

const TIER_ORDER = [
  NETWORK_TIERS.SLOW_2G,
  NETWORK_TIERS.G2,
  NETWORK_TIERS.G3,
  NETWORK_TIERS.G4,
  NETWORK_TIERS.UNKNOWN,
];

function tierRank(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? TIER_ORDER.length : idx;
}

/** Derive a tier string from the Network Information API connection object. */
function tierFromConnection(connection) {
  if (!connection) return NETWORK_TIERS.UNKNOWN;

  const et = connection.effectiveType;
  if (et === 'slow-2g') return NETWORK_TIERS.SLOW_2G;
  if (et === '2g') return NETWORK_TIERS.G2;
  if (et === '3g') return NETWORK_TIERS.G3;
  if (et === '4g') return NETWORK_TIERS.G4;

  // Fallback: derive from downlink speed (Mbps)
  if (typeof connection.downlink === 'number') {
    if (connection.downlink <= 0.05) return NETWORK_TIERS.SLOW_2G;
    if (connection.downlink <= 0.15) return NETWORK_TIERS.G2;
    if (connection.downlink <= 0.7) return NETWORK_TIERS.G3;
    return NETWORK_TIERS.G4;
  }

  return NETWORK_TIERS.UNKNOWN;
}

export class NetworkTierDetector {
  /**
   * @param {object}  opts
   * @param {object}  [opts.bus]        - EventBus instance (optional)
   * @param {number}  [opts.pollMs=5000] - How often to poll when change events are unavailable
   * @param {object}  [opts.connection] - Override navigator.connection (for testing)
   */
  constructor({ bus, pollMs = 5000, connection } = {}) {
    this._bus = bus;
    this._pollMs = pollMs;
    this._connection = connection ?? (typeof navigator !== 'undefined' ? navigator.connection : null);
    this._tier = NETWORK_TIERS.UNKNOWN;
    this._effectiveType = null;
    this._downlink = null;
    this._rtt = null;
    this._saveData = false;
    this._pollTimer = null;
    this._boundHandler = null;
    this._update();
  }

  start() {
    if (this._connection) {
      this._boundHandler = () => this._update();
      this._connection.addEventListener('change', this._boundHandler);
    }
    // Periodic poll as fallback (some WebViews don't fire 'change')
    if (typeof setInterval !== 'undefined') {
      this._pollTimer = setInterval(() => this._update(), this._pollMs);
    }
  }

  stop() {
    if (this._connection && this._boundHandler) {
      this._connection.removeEventListener('change', this._boundHandler);
      this._boundHandler = null;
    }
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /** Current network tier. */
  get tier() {
    return this._tier;
  }

  /** Raw effectiveType from the API (e.g. 'slow-2g', '2g', '3g', '4g'). */
  get effectiveType() {
    return this._effectiveType;
  }

  /** Estimated downlink in Mbps. */
  get downlink() {
    return this._downlink;
  }

  /** Round-trip time estimate in ms. */
  get rtt() {
    return this._rtt;
  }

  /** Whether the user has requested reduced data usage. */
  get saveData() {
    return this._saveData;
  }

  /** True when the connection is known to be slow (2G or slow-2G). */
  get isSlow() {
    return tierRank(this._tier) <= tierRank(NETWORK_TIERS.G2);
  }

  /** True when the connection is 3G or worse. */
  get isConstrained() {
    return tierRank(this._tier) <= tierRank(NETWORK_TIERS.G3);
  }

  /** Whether the Network Information API is available. */
  get apiAvailable() {
    return this._connection !== null && typeof this._connection !== 'undefined';
  }

  /** Returns a snapshot of the current connection info. */
  toJSON() {
    return {
      tier: this._tier,
      effectiveType: this._effectiveType,
      downlink: this._downlink,
      rtt: this._rtt,
      saveData: this._saveData,
      apiAvailable: this.apiAvailable,
    };
  }

  _update() {
    const prev = this._tier;
    this._effectiveType = this._connection?.effectiveType ?? null;
    this._downlink = this._connection?.downlink ?? null;
    this._rtt = this._connection?.rtt ?? null;
    this._saveData = this._connection?.saveData === true;
    this._tier = tierFromConnection(this._connection);

    if (this._tier !== prev) {
      this._bus?.emit(EVENTS.NETWORK_TIER_CHANGED, {
        tier: this._tier,
        previousTier: prev,
        effectiveType: this._effectiveType,
        downlink: this._downlink,
        rtt: this._rtt,
        saveData: this._saveData,
      });
    }
  }

  /** Allows tests / non-browser callers to simulate a tier change. */
  simulate(tier, { effectiveType, downlink, rtt, saveData } = {}) {
    const prev = this._tier;
    this._tier = tier;
    this._effectiveType = effectiveType ?? null;
    this._downlink = downlink ?? null;
    this._rtt = rtt ?? null;
    this._saveData = saveData ?? false;
    if (this._tier !== prev) {
      this._bus?.emit(EVENTS.NETWORK_TIER_CHANGED, {
        tier: this._tier,
        previousTier: prev,
        effectiveType: this._effectiveType,
        downlink: this._downlink,
        rtt: this._rtt,
        saveData: this._saveData,
      });
    }
  }
}
