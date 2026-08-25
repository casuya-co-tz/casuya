import { PackageLoader } from '../../src/package-loader/loader.js';
import { PackageValidator } from '../../src/package-loader/validator.js';
import { PackageParser } from '../../src/package-loader/parser.js';

if (typeof globalThis.TextEncoder === 'undefined') {
  const util = await import('node:util');
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}

describe('PackageParser', () => {
  let parser;

  beforeEach(() => {
    parser = new PackageParser();
  });

  test('should parse valid package objects', async () => {
    const obj = {
      manifest: { id: 'test', version: '1.0.0', title: 'Test Lesson' }
    };
    const pkg = await parser.parseFromObject(obj);
    expect(pkg.id).toBe('test');
    expect(pkg.version).toBe('1.0.0');
  });

  test('should parse JSON string manifest', async () => {
    const buffer = new TextEncoder().encode(JSON.stringify({
      manifest: { id: 'json-test', version: '2.0.0', title: 'JSON Test' }
    })).buffer;
    const pkg = await parser.parse(buffer);
    expect(pkg.manifest.title).toBe('JSON Test');
  });

  test('should reject objects without manifest', async () => {
    await expect(parser.parseFromObject({})).rejects.toThrow();
  });

  test('should parse manifest with full fields', async () => {
    const obj = {
      manifest: {
        id: 'full-test',
        version: '1.5.0',
        title: 'Full Test',
        description: 'A full test package',
        author: 'Test Author',
        language: 'en',
        type: 'quiz',
        permissions: ['storage'],
        slides: [{ id: 's1', content: '<p>Hello</p>' }],
        quizzes: [{ id: 'q1', questions: [] }],
        assets: [{ src: 'style.css', type: 'css' }]
      }
    };
    const pkg = await parser.parseFromObject(obj);
    expect(pkg.manifest.type).toBe('quiz');
    expect(pkg.manifest.slides).toHaveLength(1);
  });
});

describe('PackageValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new PackageValidator();
  });

  test('should validate a correct package', async () => {
    const pkg = {
      manifest: { id: 'valid', version: '1.0.0', title: 'Valid', type: 'lesson' }
    };
    await expect(validator.validate(pkg)).resolves.toBe(true);
  });

  test('should reject null package', async () => {
    await expect(validator.validate(null)).rejects.toThrow();
  });

  test('should reject missing manifest', async () => {
    await expect(validator.validate({})).rejects.toThrow();
  });

  test('should reject missing id', async () => {
    await expect(validator.validate({ manifest: { version: '1.0.0', title: 'No ID' } })).rejects.toThrow();
  });

  test('should reject invalid id characters', async () => {
    await expect(validator.validate({ manifest: { id: 'bad id!', version: '1.0.0', title: 'Bad ID' } })).rejects.toThrow();
  });

  test('should reject invalid version', async () => {
    await expect(validator.validate({ manifest: { id: 'test', version: 'not-semver', title: 'Bad Version' } })).rejects.toThrow();
  });

  test('should reject invalid type', async () => {
    await expect(validator.validate({ manifest: { id: 'test', version: '1.0.0', title: 'Bad Type', type: 'invalid' } })).rejects.toThrow();
  });

  test('should reject too many slides', async () => {
    const slides = Array.from({ length: 501 }, (_, i) => ({ id: `s${i}` }));
    await expect(validator.validate({ manifest: { id: 'test', version: '1.0.0', title: 'Too Many Slides', slides } })).rejects.toThrow();
  });

  test('should validate slides with content field', async () => {
    const pkg = { manifest: { id: 'test', version: '1.0.0', title: 'Test', slides: [{ content: '<p>Hi</p>' }] } };
    await expect(validator.validate(pkg)).resolves.toBe(true);
  });

  test('should reject duplicate slide IDs', async () => {
    const pkg = { manifest: { id: 'test', version: '1.0.0', title: 'Test', slides: [{ id: 'dup' }, { id: 'dup' }] } };
    await expect(validator.validate(pkg)).rejects.toThrow();
  });
});

describe('PackageLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new PackageLoader();
  });

  test('should load from object source', async () => {
    const source = {
      manifest: { id: 'loader-test', version: '1.0.0', title: 'Loader Test' }
    };
    const pkg = await loader.load(source);
    expect(pkg.manifest.id).toBe('loader-test');
  });

  test('should track loaded packages', async () => {
    await loader.load({
      manifest: { id: 'tracked', version: '1.0.0', title: 'Tracked' }
    });
    expect(loader.getLoadedPackage('tracked')).toBeDefined();
    expect(loader.getLoadedPackages()).toHaveLength(1);
  });

  test('should unload packages', async () => {
    await loader.load({
      manifest: { id: 'unload', version: '1.0.0', title: 'Unload' }
    });
    loader.unload('unload');
    expect(loader.getLoadedPackage('unload')).toBeNull();
  });

  test('should clear all packages', async () => {
    await loader.load({
      manifest: { id: 'clear-a', version: '1.0.0', title: 'A' }
    });
    await loader.load({
      manifest: { id: 'clear-b', version: '1.0.0', title: 'B' }
    });
    loader.clear();
    expect(loader.getLoadedPackages()).toHaveLength(0);
  });

  test('should handle unknown source types', async () => {
    await expect(loader.load(42)).rejects.toThrow();
  });
});
