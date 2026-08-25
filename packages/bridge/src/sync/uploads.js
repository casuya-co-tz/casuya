/** Uploads a batch of queued events to the server API. */

import { buildJsonRequest } from '../network/requests.js';
import { fetchWithTimeout } from '../network/fetcher.js';
import { DEFAULT_CONFIG } from '../core/constants.js';

export async function uploadBatch(apiBaseUrl, batch, { fetchImpl, bridgeKey } = {}) {
  const key = bridgeKey || DEFAULT_CONFIG.bridgeSharedKey;
  const headers = key ? { 'X-Bridge-Key': key } : {};
  const request = buildJsonRequest(`${apiBaseUrl}/sync/events`, {
    body: { events: batch.map((record) => record.event) },
    headers,
  });
  return fetchWithTimeout(request, { fetchImpl });
}
