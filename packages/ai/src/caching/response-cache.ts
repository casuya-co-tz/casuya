import { CacheManager, CacheConfig } from './cache-manager';
import { Logger } from '../utilities/logger';

export interface ResponseCacheConfig {
  cache: CacheConfig;
  enableForStreaming: boolean;
  maxResponseSize: number;
}

function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  return `${prefix}:${JSON.stringify(sorted)}`;
}

export class ResponseCache {
  private cache: CacheManager;
  private config: ResponseCacheConfig;

  constructor(config?: Partial<ResponseCacheConfig>, logger?: Logger) {
    this.config = {
      cache: { defaultTTL: 5 * 60 * 1000, maxEntries: 5000, cleanupInterval: 120 * 1000 },
      enableForStreaming: false,
      maxResponseSize: 100 * 1024,
      ...config,
    };
    this.cache = new CacheManager(this.config.cache, logger);
  }

  get(prefix: string, params: Record<string, unknown>): string | undefined {
    const key = generateCacheKey(prefix, params);
    return this.cache.get<string>(key);
  }

  set(prefix: string, params: Record<string, unknown>, response: string, ttl?: number): void {
    if (response.length > this.config.maxResponseSize) {
      return;
    }
    const key = generateCacheKey(prefix, params);
    this.cache.set(key, response, ttl);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return this.cache.getStats();
  }
}
