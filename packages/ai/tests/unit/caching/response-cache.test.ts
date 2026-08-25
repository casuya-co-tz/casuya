import { ResponseCache } from '../../../src/caching/response-cache';

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ cache: { defaultTTL: 1000, maxEntries: 100, cleanupInterval: 5000 } });
  });

  it('should cache and retrieve responses', () => {
    cache.set('chat', { prompt: 'hello' }, 'Hello!');
    expect(cache.get('chat', { prompt: 'hello' })).toBe('Hello!');
  });

  it('should return undefined for cache miss', () => {
    expect(cache.get('chat', { prompt: 'unknown' })).toBeUndefined();
  });

  it('should skip caching large responses', () => {
    const large = 'x'.repeat(200 * 1024);
    cache.set('chat', { prompt: 'large' }, large);
    expect(cache.get('chat', { prompt: 'large' })).toBeUndefined();
  });

  it('should clear all cached entries', () => {
    cache.set('chat', { a: 1 }, 'one');
    cache.set('embed', { b: 2 }, 'two');
    cache.clear();
    expect(cache.get('chat', { a: 1 })).toBeUndefined();
    expect(cache.get('embed', { b: 2 })).toBeUndefined();
  });
});
