/** Thin fetch wrapper with timeout support and normalized error handling. */

import { NetworkError } from '../core/errors.js';
import { normalizeResponse } from './responses.js';

export async function fetchWithTimeout(requestDescriptor, { timeoutMs = 15_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(requestDescriptor.url, {
      method: requestDescriptor.method,
      headers: requestDescriptor.headers,
      body: requestDescriptor.body,
      signal: controller.signal,
    });
    return await normalizeResponse(response);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new NetworkError(`Request to ${requestDescriptor.url} timed out after ${timeoutMs}ms`);
    }
    throw new NetworkError(`Request to ${requestDescriptor.url} failed: ${err.message}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}
