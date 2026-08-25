import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../../src/storage/indexeddb.js';
import { STORES } from '../../src/core/constants.js';

test('MemoryStore put/get roundtrip', async () => {
  const store = new MemoryStore();
  await store.put(STORES.PACKAGES, 'slug-1', { body: 'hi' });
  const value = await store.get(STORES.PACKAGES, 'slug-1');
  assert.deepEqual(value, { body: 'hi' });
});

test('MemoryStore get returns null for missing key', async () => {
  const store = new MemoryStore();
  assert.equal(await store.get(STORES.PACKAGES, 'nope'), null);
});

test('MemoryStore keys/values/delete/clear', async () => {
  const store = new MemoryStore();
  await store.put(STORES.ASSETS, 'a', 1);
  await store.put(STORES.ASSETS, 'b', 2);

  assert.deepEqual((await store.keys(STORES.ASSETS)).sort(), ['a', 'b']);
  assert.deepEqual((await store.values(STORES.ASSETS)).sort(), [1, 2]);

  await store.delete(STORES.ASSETS, 'a');
  assert.deepEqual(await store.keys(STORES.ASSETS), ['b']);

  await store.clear(STORES.ASSETS);
  assert.deepEqual(await store.keys(STORES.ASSETS), []);
});
