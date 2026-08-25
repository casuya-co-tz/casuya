/** Downloads updated lesson manifests/packages from the server API. */

import { NetworkError } from '../core/errors.js';
import { fetchWithTimeout } from '../network/fetcher.js';

export async function downloadManifests(apiBaseUrl, { fetchImpl } = {}) {
  const response = await fetchWithTimeout(
    { url: `${apiBaseUrl}/lessons/manifests`, method: 'GET', headers: {} },
    { fetchImpl }
  );
  if (!response.ok) {
    throw new NetworkError(`Failed to download manifests: HTTP ${response.status}`);
  }
  return Array.isArray(response.body) ? response.body : [];
}

export async function downloadPackage(apiBaseUrl, slug, { fetchImpl } = {}) {
  const response = await fetchWithTimeout(
    { url: `${apiBaseUrl}/lessons/${slug}/package`, method: 'GET', headers: {} },
    { fetchImpl }
  );
  if (!response.ok) {
    throw new NetworkError(`Failed to download package '${slug}': HTTP ${response.status}`);
  }
  return response.body;
}