import { CacheManager } from '../../../src/caching/cache-manager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ defaultTTL: 1000, maxEntries: 100, cleanupInterval: 5000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should respect TTL', async () => {
    cache.set('key2', 'value2', 50);
    expect(cache.get('key2')).toBe('value2');
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('key2')).toBeUndefined();
  });

  it('should check existence with has()', () => {
    cache.set('key3', 'value3');
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('should delete entries', () => {
    cache.set('key4', 'value4');
    expect(cache.delete('key4')).toBe(true);
    expect(cache.get('key4')).toBeUndefined();
  });

  it('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('should provide stats', () => {
    cache.set('x', 'test');
    cache.get('x');
    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.totalHits).toBe(1);
  });
});
