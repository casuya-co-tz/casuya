/** Network-tier-aware package downloader.
 *
 * Wraps the base download functions with adaptive timeouts, retry logic,
 * and optional quality negotiation based on the current network tier.
 */

import { NetworkError } from '../core/errors.js';
import { fetchWithTimeout } from './fetcher.js';

const TIER_TIMEOUTS = Object.freeze({
  'slow-2g': 90_000,
  '2g': 60_000,
  '3g': 35_000,
  '4g': 15_000,
  unknown: 20_000,
});

const TIER_QUALITY_PARAMS = Object.freeze({
  'slow-2g': { q: 40, w: 320, essential: '1' },
  '2g': { q: 55, w: 480, essential: '1' },
  '3g': { q: 70, w: 720 },
  '4g': { q: 85, w: 1280 },
  unknown: { q: 70, w: 720 },
});

/**
 * Download a lesson manifest with tier-appropriate timeout.
 */
export async function downloadManifestsTiered(apiBaseUrl, tierDetector, { fetchImpl } = {}) {
  const tier = tierDetector?.tier ?? 'unknown';
  const timeoutMs = TIER_TIMEOUTS[tier] ?? TIER_TIMEOUTS.unknown;

  const response = await fetchWithTimeout(
    { url: `${apiBaseUrl}/lessons/manifests`, method: 'GET', headers: {} },
    { timeoutMs, fetchImpl }
  );
  if (!response.ok) {
    throw new NetworkError(`Failed to download manifests: HTTP ${response.status}`);
  }
  return Array.isArray(response.body) ? response.body : [];
}

/**
 * Download a lesson package with tier-appropriate timeout and quality params.
 *
 * On slow connections (2G / slow-2G), the request includes quality query
 * parameters so the server can return a compressed/lightweight variant.
 */
export async function downloadPackageTiered(apiBaseUrl, slug, tierDetector, { fetchImpl } = {}) {
  const tier = tierDetector?.tier ?? 'unknown';
  const timeoutMs = TIER_TIMEOUTS[tier] ?? TIER_TIMEOUTS.unknown;
  const quality = TIER_QUALITY_PARAMS[tier] ?? TIER_QUALITY_PARAMS.unknown;

  const url = new URL(`${apiBaseUrl}/lessons/${slug}/package`);
  if (quality.q) url.searchParams.set('q', String(quality.q));
  if (quality.w) url.searchParams.set('w', String(quality.w));
  if (quality.essential) url.searchParams.set('essential', quality.essential);

  const response = await fetchWithTimeout(
    { url: url.pathname + url.search, method: 'GET', headers: {} },
    { timeoutMs, fetchImpl }
  );
  if (!response.ok) {
    throw new NetworkError(`Failed to download package '${slug}': HTTP ${response.status}`);
  }
  return response.body;
}

/**
 * Download an asset with tier-appropriate timeout.
 */
export async function downloadAssetTiered(url, tierDetector, { fetchImpl, headers = {} } = {}) {
  const tier = tierDetector?.tier ?? 'unknown';
  const timeoutMs = TIER_TIMEOUTS[tier] ?? TIER_TIMEOUTS.unknown;

  const response = await fetchWithTimeout(
    { url, method: 'GET', headers },
    { timeoutMs, fetchImpl }
  );
  if (!response.ok) {
    throw new NetworkError(`Failed to download asset: HTTP ${response.status}`);
  }
  return response.body;
}
