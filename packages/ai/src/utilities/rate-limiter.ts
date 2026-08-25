export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  onExceeded?: () => void;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private windows: Map<string, WindowEntry>;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.windows = new Map();
  }

  async acquire(key: string = 'default'): Promise<boolean> {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return true;
    }

    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return true;
    }

    this.config.onExceeded?.();
    return false;
  }

  async waitAndAcquire(key: string = 'default'): Promise<void> {
    while (!(await this.acquire(key))) {
      const entry = this.windows.get(key);
      if (entry) {
        const waitTime = entry.resetAt - Date.now();
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 100)));
      }
    }
  }

  getRemaining(key: string = 'default'): number {
    const entry = this.windows.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  reset(key: string = 'default'): void {
    this.windows.delete(key);
  }

  resetAll(): void {
    this.windows.clear();
  }
}
