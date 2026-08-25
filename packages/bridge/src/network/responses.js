/** Normalizes fetch Response-like objects into a consistent shape. */

export async function normalizeResponse(response) {
  const contentType = response.headers?.get?.('content-type') ?? '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}
