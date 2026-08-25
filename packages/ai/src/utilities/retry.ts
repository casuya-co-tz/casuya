export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  retryableErrors: Array<{ new (message: string): Error }>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBackoff: true,
  retryableErrors: [],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === cfg.maxRetries) {
        throw lastError;
      }

      if (!isRetryable(lastError, cfg.retryableErrors)) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, cfg);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Retry failed');
}

function isRetryable(error: Error, retryableErrors: Array<{ new (message: string): Error }>): boolean {
  if (retryableErrors.length === 0) return true;
  return retryableErrors.some((ErrType) => error instanceof ErrType);
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  if (config.exponentialBackoff) {
    const delay = Math.min(
      config.baseDelay * Math.pow(2, attempt),
      config.maxDelay,
    );
    return delay + Math.random() * delay * 0.1;
  }
  return config.baseDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
