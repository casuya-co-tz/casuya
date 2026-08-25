import { CacheManager } from '../../src/cache/cache-manager.js';
import { LRUCache } from '../../src/cache/lru-cache.js';

describe('CacheManager', () => {
  let cm;

  beforeEach(() => {
    cm = new CacheManager({ maxSize: 1024 * 1024 });
  });

  afterEach(() => {
    cm.destroy();
  });

  test('should set and get values', () => {
    cm.set('test', 'key1', 'value1');
    expect(cm.getValue('test', 'key1')).toBe('value1');
  });

  test('should return undefined for missing keys', () => {
    expect(cm.getValue('test', 'nonexistent')).toBeUndefined();
  });

  test('should check key existence', () => {
    cm.set('test', 'exists', 'yes');
    expect(cm.has('test', 'exists')).toBe(true);
    expect(cm.has('test', 'no')).toBe(false);
  });

  test('should delete values', () => {
    cm.set('test', 'delete-me', 'value');
    cm.delete('test', 'delete-me');
    expect(cm.getValue('test', 'delete-me')).toBeUndefined();
  });

  test('should clear namespaces', () => {
    cm.set('ns1', 'a', 1);
    cm.set('ns2', 'b', 2);
    cm.clearNamespace('ns1');
    expect(cm.getValue('ns1', 'a')).toBeUndefined();
    expect(cm.getValue('ns2', 'b')).toBe(2);
  });

  test('should clear everything', () => {
    cm.set('ns1', 'a', 1);
    cm.set('ns2', 'b', 2);
    cm.clear();
    expect(cm.size).toBe(0);
  });

  test('should create different caches per namespace', () => {
    cm.set('ns1', 'key', 'val1');
    cm.set('ns2', 'key', 'val2');
    expect(cm.getValue('ns1', 'key')).toBe('val1');
    expect(cm.getValue('ns2', 'key')).toBe('val2');
  });
});

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({ maxSize: 1000, ttl: 5000 });
  });

  test('should store and retrieve values', () => {
    cache.set('key', 'value', 10);
    expect(cache.get('key')).toBe('value');
  });

  test('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  test('should evict oldest entries when full', () => {
    cache._options.maxSize = 150;
    cache.set('a', 'x', 60);
    cache.set('b', 'y', 60);
    cache.set('c', 'z', 60);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  test('should delete entries', () => {
    cache.set('key', 'value', 10);
    cache.delete('key');
    expect(cache.get('key')).toBeUndefined();
  });

  test('should clear all entries', () => {
    cache.set('a', 1, 10);
    cache.set('b', 2, 10);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  test('should return keys', () => {
    cache.set('a', 1, 10);
    cache.set('b', 2, 10);
    expect(cache.keys()).toContain('a');
    expect(cache.keys()).toContain('b');
  });
});
