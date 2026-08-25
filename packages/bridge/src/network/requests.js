/** Builds standardized request descriptors for the sync engine. */

export function buildJsonRequest(url, { method = 'POST', body, headers = {} } = {}) {
  return {
    url,
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}
