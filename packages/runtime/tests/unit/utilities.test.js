import { IdGenerator } from '../../src/utilities/id-generator.js';
import { Timer } from '../../src/utilities/timer.js';
import { deepFreeze, deepClone, deepMerge } from '../../src/utilities/object-utils.js';
import { byteSize, formatBytes, truncate } from '../../src/utilities/string-utils.js';
import { isLowEndDevice } from '../../src/utilities/device-detect.js';
import { semverCompare, satisfies } from '../../src/utilities/semver.js';
import { urlResolver } from '../../src/utilities/url-resolver.js';

describe('IdGenerator', () => {
  test('should generate unique IDs', () => {
    const id1 = IdGenerator.generate();
    const id2 = IdGenerator.generate();
    expect(id1).not.toBe(id2);
  });

  test('should generate short IDs', () => {
    const id = IdGenerator.short();
    expect(id.length).toBe(8);
  });

  test('should generate UUIDs', () => {
    const uuid = IdGenerator.uuid();
    expect(uuid.length).toBe(36);
    expect(uuid.split('-').length).toBe(5);
  });

  test('should accept custom prefix', () => {
    const id = IdGenerator.generate('custom');
    expect(id.startsWith('custom_')).toBe(true);
  });

  test('should reset counter', () => {
    IdGenerator.reset();
    const id1 = IdGenerator.generate();
    const id2 = IdGenerator.generate();
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
  });
});

describe('Timer', () => {
  test('should measure elapsed time', () => {
    const t = new Timer();
    t.start();
    const elapsed = t.stop();
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  test('should track running state', () => {
    const t = new Timer();
    expect(t.running).toBe(false);
    t.start();
    expect(t.running).toBe(true);
    t.stop();
    expect(t.running).toBe(false);
  });

  test('should accumulate elapsed time across start/stop', () => {
    const t = new Timer();
    t.start();
    t.stop();
    const first = t.elapsed;
    t.start();
    t.stop();
    expect(t.elapsed).toBeGreaterThanOrEqual(first);
  });

  test('should reset', () => {
    const t = new Timer();
    t.start();
    t.stop();
    t.reset();
    expect(t.elapsed).toBe(0);
  });

  test('should measure synchronous functions', () => {
    const elapsed = Timer.measure(() => {
      let x = 0;
      for (let i = 0; i < 1000; i++) x += i;
    });
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  test('should measure async functions', async () => {
    const elapsed = await Timer.measureAsync(async () => {
      await new Promise(r => setTimeout(r, 10));
    });
    expect(elapsed).toBeGreaterThanOrEqual(5);
  });
});

describe('Object Utils', () => {
  test('deepFreeze should freeze objects', () => {
    const obj = { a: 1, b: { c: 2 } };
    const frozen = deepFreeze(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.b)).toBe(true);
  });

  test('deepFreeze should handle null', () => {
    expect(deepFreeze(null)).toBeNull();
  });

  test('deepClone should create independent copy', () => {
    const original = { a: 1, b: { c: [1, 2, 3] } };
    const cloned = deepClone(original);
    cloned.b.c.push(4);
    expect(original.b.c).toHaveLength(3);
    expect(cloned.b.c).toHaveLength(4);
  });

  test('deepMerge should merge objects', () => {
    const target = { a: 1, b: { c: 2 } };
    const source = { b: { d: 3 }, e: 4 };
    const merged = deepMerge(target, source);
    expect(merged.a).toBe(1);
    expect(merged.b.c).toBe(2);
    expect(merged.b.d).toBe(3);
    expect(merged.e).toBe(4);
  });
});

describe('String Utils', () => {
  test('byteSize should calculate correct size', () => {
    expect(byteSize('hello')).toBe(5);
    expect(byteSize('')).toBe(0);
  });

  test('formatBytes should format correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  test('truncate should limit string length', () => {
    expect(truncate('hello world', 5)).toBe('he...');
    expect(truncate('short', 10)).toBe('short');
    expect(truncate(null, 5)).toBe('');
  });
});

describe('Device Detection', () => {
  test('should detect low-end device', () => {
    expect(typeof isLowEndDevice()).toBe('boolean');
  });
});

describe('Semver', () => {
  test('should compare versions', () => {
    expect(semverCompare('1.0.0', '1.0.0')).toBe(0);
    expect(semverCompare('2.0.0', '1.0.0')).toBe(1);
    expect(semverCompare('1.0.0', '2.0.0')).toBe(-1);
  });

  test('should satisfy version ranges', () => {
    expect(satisfies('1.0.0', '1.0.0')).toBe(true);
    expect(satisfies('1.5.0', '>=1.0.0')).toBe(true);
    expect(satisfies('0.9.0', '>=1.0.0')).toBe(false);
    expect(satisfies('1.5.0', '^1.0.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.0.0')).toBe(false);
    expect(satisfies('1.5.0', '~1.0.0')).toBe(false);
    expect(satisfies('1.0.5', '~1.0.0')).toBe(true);
    expect(satisfies('2.0.0', '*')).toBe(true);
  });
});

describe('URL Resolver', () => {
  test('should resolve absolute URLs', () => {
    const resolved = urlResolver('http://example.com/base/', 'sub/file.js');
    expect(resolved).toBe('http://example.com/base/sub/file.js');
  });

  test('should handle relative paths with ..', () => {
    const resolved = urlResolver('http://example.com/a/b/', '../c/file.js');
    expect(resolved).toBe('http://example.com/a/c/file.js');
  });

  test('should not modify full URLs', () => {
    const resolved = urlResolver('http://example.com/', 'https://other.com/file.js');
    expect(resolved).toBe('https://other.com/file.js');
  });

  test('should handle empty relative path', () => {
    const resolved = urlResolver('http://example.com/file.html', '');
    expect(resolved).toBe('http://example.com/file.html');
  });
});
