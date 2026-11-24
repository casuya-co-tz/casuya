import { PackageLoader } from '../../src/package-loader/loader.js';
import { PackageValidator } from '../../src/package-loader/validator.js';
import { PackageParser } from '../../src/package-loader/parser.js';
import { readZipDirectory } from '../../src/package-loader/zip-reader.js';

if (typeof globalThis.TextEncoder === 'undefined') {
  const util = await import('node:util');
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}

/** Build an uncompressed (stored) ZIP archive in memory. */
function makeStoredZip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const chunk of [...locals, ...centrals, eocd]) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
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

  test('should extract manifest and resources from a real ZIP archive', async () => {
    const zip = makeStoredZip({
      'manifest.json': JSON.stringify({ id: 'zip-test', version: '1.0.0', title: 'Zip Test' }),
      'style.css': 'body{color:red}',
      'lesson.html': '<h1>Hello</h1>'
    });

    const pkg = await parser.parse(zip.buffer);
    expect(pkg.id).toBe('zip-test');
    expect(pkg.manifest.title).toBe('Zip Test');
    expect(new TextDecoder().decode(pkg.resources['style.css'])).toBe('body{color:red}');
    expect(new TextDecoder().decode(pkg.resources['lesson.html'])).toBe('<h1>Hello</h1>');
  });

  test('should ignore path-traversal entries in ZIP archives', async () => {
    const zip = makeStoredZip({
      'manifest.json': JSON.stringify({ id: 'safe-zip', version: '1.0.0', title: 'Safe Zip' }),
      '../escape.txt': 'nope'
    });

    const pkg = await parser.parse(zip.buffer);
    expect(pkg.id).toBe('safe-zip');
    expect(pkg.resources['../escape.txt']).toBeUndefined();
    expect(readZipDirectory(zip).map((e) => e.filename)).not.toContain('../escape.txt');
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
