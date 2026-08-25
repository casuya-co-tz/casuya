/** Adjusts fetch timeouts, concurrency, and content-quality preferences
 * based on the current network tier detected by NetworkTierDetector.
 *
 * Usage:
 *   const loader = new AdaptiveLoader({ tierDetector, bus });
 *   const opts = loader.fetchOptions();       // { timeoutMs, concurrency, quality }
 *   const url  = loader.selectVariant(variants); // pick best URL for current tier
 */

import { NETWORK_TIERS } from './network-tier.js';
import { EVENTS } from '../core/constants.js';

/** Per-tier fetch configuration. */
const TIER_PRESETS = Object.freeze({
  [NETWORK_TIERS.SLOW_2G]: {
    timeoutMs: 60_000,
    concurrency: 1,
    quality: 'low',
    imageMaxWidth: 320,
    imageQuality: 40,
    skipNonEssential: true,
    retryMultiplier: 3,
  },
  [NETWORK_TIERS.G2]: {
    timeoutMs: 45_000,
    concurrency: 2,
    quality: 'low',
    imageMaxWidth: 480,
    imageQuality: 55,
    skipNonEssential: true,
    retryMultiplier: 2,
  },
  [NETWORK_TIERS.G3]: {
    timeoutMs: 30_000,
    concurrency: 3,
    quality: 'medium',
    imageMaxWidth: 720,
    imageQuality: 70,
    skipNonEssential: false,
    retryMultiplier: 1.5,
  },
  [NETWORK_TIERS.G4]: {
    timeoutMs: 15_000,
    concurrency: 6,
    quality: 'high',
    imageMaxWidth: 1280,
    imageQuality: 85,
    skipNonEssential: false,
    retryMultiplier: 1,
  },
  [NETWORK_TIERS.UNKNOWN]: {
    timeoutMs: 20_000,
    concurrency: 4,
    quality: 'medium',
    imageMaxWidth: 720,
    imageQuality: 70,
    skipNonEssential: false,
    retryMultiplier: 1,
  },
});

export class AdaptiveLoader {
  /**
   * @param {object}             opts
   * @param {NetworkTierDetector} opts.tierDetector
   * @param {object}             [opts.bus]           - EventBus instance
   * @param {object}             [opts.overrides]     - Override specific tier presets
   */
  constructor({ tierDetector, bus, overrides } = {}) {
    this._tierDetector = tierDetector;
    this._bus = bus;
    this._presets = deepMerge(TIER_PRESETS, overrides ?? {});
  }

  /** Return fetch options tuned for the current network tier. */
  fetchOptions() {
    return { ...this._preset() };
  }

  /** Return timeout in ms for the current tier. */
  get timeoutMs() {
    return this._preset().timeoutMs;
  }

  /** Return max concurrent requests for the current tier. */
  get concurrency() {
    return this._preset().concurrency;
  }

  /** Return quality label ('low', 'medium', 'high') for the current tier. */
  get quality() {
    return this._preset().quality;
  }

  /** Whether to skip non-essential assets (decorative images, background audio). */
  get skipNonEssential() {
    return this._preset().skipNonEssential;
  }

  /** Max image width in px for the current tier. */
  get imageMaxWidth() {
    return this._preset().imageMaxWidth;
  }

  /** Image compression quality (0-100) for the current tier. */
  get imageQuality() {
    return this._preset().imageQuality;
  }

  /**
   * Given a map of { quality: url }, pick the best URL for the current tier.
   * Falls back to the highest available quality if no match found.
   */
  selectVariant(variants) {
    if (!variants || typeof variants !== 'object') return null;

    const tier = this._tierDetector?.tier ?? NETWORK_TIERS.UNKNOWN;

    // Preferred order: try to match quality to tier
    const preference = {
      [NETWORK_TIERS.SLOW_2G]: ['low', 'medium', 'high'],
      [NETWORK_TIERS.G2]: ['low', 'medium', 'high'],
      [NETWORK_TIERS.G3]: ['medium', 'low', 'high'],
      [NETWORK_TIERS.G4]: ['high', 'medium', 'low'],
      [NETWORK_TIERS.UNKNOWN]: ['medium', 'low', 'high'],
    };

    const order = preference[tier] ?? preference[NETWORK_TIERS.UNKNOWN];
    for (const q of order) {
      if (variants[q]) return variants[q];
    }
    return null;
  }

  /** Build a URL with quality query params for the server to honor. */
  qualityAwareUrl(baseUrl, { format, width } = {}) {
    const url = new URL(baseUrl, typeof location !== 'undefined' ? location.origin : 'http://localhost');
    const preset = this._preset();
    if (format) url.searchParams.set('fmt', format);
    if (width) url.searchParams.set('w', String(Math.min(width, preset.imageMaxWidth)));
    else url.searchParams.set('w', String(preset.imageMaxWidth));
    url.searchParams.set('q', String(preset.imageQuality));
    if (preset.skipNonEssential) url.searchParams.set('essential', '1');
    return url.pathname + url.search;
  }

  /** Returns true if the current tier should defer non-essential downloads. */
  shouldDeferNonEssential() {
    return this._preset().skipNonEssential;
  }

  /** Returns retry delay multiplier for the current tier. */
  get retryMultiplier() {
    return this._preset().retryMultiplier;
  }

  _preset() {
    const tier = this._tierDetector?.tier ?? NETWORK_TIERS.UNKNOWN;
    return this._presets[tier] ?? this._presets[NETWORK_TIERS.UNKNOWN];
  }
}

/** Shallow-merge nested objects (one level deep). */
function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = { ...(base[key] ?? {}), ...override[key] };
    } else {
      result[key] = override[key];
    }
  }
  return result;
}
