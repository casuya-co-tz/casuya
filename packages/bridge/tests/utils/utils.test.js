import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunk, deepMerge, isPlainObject, sleep } from '../../src/utils/helpers.js';
import { parseLessonMeta, parseQueryParams } from '../../src/utils/parser.js';
import { serialize, deserialize, clone } from '../../src/utils/serializer.js';
import { uuid } from '../../src/utils/uuid.js';

test('chunk splits arrays correctly', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('chunk throws on invalid size', () => {
  assert.throws(() => chunk([1], 0));
});

test('deepMerge merges nested plain objects', () => {
  const result = deepMerge({ a: { x: 1, y: 1 } }, { a: { y: 2, z: 3 } });
  assert.deepEqual(result, { a: { x: 1, y: 2, z: 3 } });
});

test('isPlainObject distinguishes plain objects from arrays/null', () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
});

test('sleep resolves after roughly the given delay', async () => {
  const start = Date.now();
  await sleep(20);
  assert.ok(Date.now() - start >= 15);
});

test('parseLessonMeta extracts title and meta tags', () => {
  const html = `<title>Balancing Equations</title><meta name="subject" content="chemistry">`;
  const meta = parseLessonMeta(html);
  assert.equal(meta.title, 'Balancing Equations');
  assert.equal(meta.subject, 'chemistry');
});

test('parseQueryParams decodes key/value pairs', () => {
  const params = parseQueryParams('https://x/y?a=1&b=hello%20world');
  assert.deepEqual(params, { a: '1', b: 'hello world' });
});

test('serialize/deserialize/clone roundtrip', () => {
  const value = { a: 1, b: [1, 2, 3] };
  const text = serialize(value);
  assert.deepEqual(deserialize(text), value);
  assert.deepEqual(clone(value), value);
});

test('deserialize returns fallback on invalid JSON', () => {
  assert.equal(deserialize('{not json', 'fallback'), 'fallback');
});

test('uuid produces well-formed v4-shaped strings', () => {
  const id = uuid();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
