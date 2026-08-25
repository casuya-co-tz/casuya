/** Uploads batched analytics data to the server API. */

import { fetchWithTimeout } from '../../network/fetcher.js';
import { buildJsonRequest } from '../../network/requests.js';

export async function uploadAnalytics(apiBaseUrl, batch, { fetchImpl } = {}) {
  const request = buildJsonRequest(`${apiBaseUrl}/analytics/events`, {
    body: { events: batch },
  });
  const response = await fetchWithTimeout(request, { fetchImpl });
  return response.ok;
}