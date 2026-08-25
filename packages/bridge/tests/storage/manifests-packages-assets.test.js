import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../../src/storage/indexeddb.js';
import { ManifestStore } from '../../src/storage/manifests.js';
import { PackageStore } from '../../src/storage/packages.js';
import { AssetStore } from '../../src/storage/assets.js';

test('ManifestStore save/get/has/list/remove', async () => {
  const store = new ManifestStore(new MemoryStore());
  await store.save('mole-concept', { content_hash: 'abc' });
  assert.equal(await store.has('mole-concept'), true);
  assert.deepEqual(await store.get('mole-concept'), { content_hash: 'abc' });
  assert.equal((await store.list()).length, 1);
  await store.remove('mole-concept');
  assert.equal(await store.has('mole-concept'), false);
});

test('ManifestStore.findStale detects new and changed manifests', async () => {
  const store = new ManifestStore(new MemoryStore());
  await store.save('lesson-a', { content_hash: 'v1' });

  const remote = [
    { slug: 'lesson-a', content_hash: 'v2' }, // changed
    { slug: 'lesson-b', content_hash: 'v1' }, // new
  ];
  const stale = await store.findStale(remote);
  assert.equal(stale.length, 2);
});

test('PackageStore save/get/sizeEstimateBytes', async () => {
  const store = new PackageStore(new MemoryStore());
  await store.save('lesson-a', { body_html: 'hello world' });
  const size = await store.sizeEstimateBytes();
  assert.equal(size, Buffer.byteLength('hello world'));
});

test('AssetStore save/get/has/evictOlderThan', async () => {
  const store = new AssetStore(new MemoryStore());
  await store.save('img.png', 'binary-data');
  assert.equal(await store.has('img.png'), true);
  assert.equal(await store.get('img.png'), 'binary-data');

  const evicted = await store.evictOlderThan(-1); // everything is "older" than -1ms
  assert.equal(evicted, 1);
  assert.equal(await store.has('img.png'), false);
});
