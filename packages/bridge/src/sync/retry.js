/** Exponential backoff with jitter for retrying failed sync batches. */

export function backoffDelayMs(attempt, baseDelayMs = 1000, maxDelayMs = 60_000) {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.random() * exponential * 0.2;
  return Math.round(exponential - exponential * 0.1 + jitter);
}

export function shouldRetry(attempt, maxRetries, statusCode, retryableStatusCodes) {
  if (attempt >= maxRetries) return false;
  if (statusCode === undefined) return true; // network error, not an HTTP status
  return retryableStatusCodes.has(statusCode);
}
