import { Logger } from '../utilities/logger';

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000,
  maxEntries: 10000,
  cleanupInterval: 60 * 1000,
};

export class CacheManager {
  private store: Map<string, CacheEntry<unknown>>;
  private config: CacheConfig;
  private logger: Logger;
  private cleanupTimer: ReturnType<typeof setInterval> | null;

  constructor(config?: Partial<CacheConfig>, logger?: Logger) {
    this.store = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger ?? new Logger({ prefix: '[CacheManager]' });
    this.cleanupTimer = null;
    this.startCleanup();
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (this.store.size >= this.config.maxEntries) {
      this.evict();
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttl ?? this.config.defaultTTL),
      createdAt: Date.now(),
      hits: 0,
    });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.logger.debug('Cache cleared');
  }

  get size(): number {
    return this.store.size;
  }

  getStats(): CacheStats {
    let totalHits = 0;
    let expired = 0;

    for (const entry of this.store.values()) {
      totalHits += entry.hits;
      if (Date.now() >= entry.expiresAt) expired++;
    }

    return {
      totalEntries: this.store.size,
      expiredEntries: expired,
      totalHits,
      maxEntries: this.config.maxEntries,
      usagePercent: (this.store.size / this.config.maxEntries) * 100,
    };
  }

  keys(): string[] {
    const valid: string[] = [];
    for (const [key, entry] of this.store) {
      if (Date.now() < entry.expiresAt) {
        valid.push(key);
      } else {
        this.store.delete(key);
      }
    }
    return valid;
  }

  private evict(): void {
    const entries = [...this.store.entries()]
      .filter(([, entry]) => Date.now() < entry.expiresAt)
      .sort((a, b) => a[1].hits - b[1].hits);

    const toRemove = Math.ceil(this.config.maxEntries * 0.2);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.store.delete(entries[i][0]);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let removed = 0;
      for (const [key, entry] of this.store) {
        if (now >= entry.expiresAt) {
          this.store.delete(key);
          removed++;
        }
      }
      if (removed > 0) {
        this.logger.debug(`Cleaned up ${removed} expired entries`);
      }
    }, this.config.cleanupInterval);

    if (this.cleanupTimer && typeof this.cleanupTimer === 'object') {
      this.cleanupTimer.unref();
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

export interface CacheStats {
  totalEntries: number;
  expiredEntries: number;
  totalHits: number;
  maxEntries: number;
  usagePercent: number;
}
