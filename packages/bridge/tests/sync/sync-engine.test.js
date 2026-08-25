import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../../src/storage/indexeddb.js';
import { ManifestStore } from '../../src/storage/manifests.js';
import { PackageStore } from '../../src/storage/packages.js';
import { SyncQueue } from '../../src/sync/queue.js';
import { SyncEngine } from '../../src/sync/sync-engine.js';
import { EventBus } from '../../src/core/events.js';
import { resolveConfig } from '../../src/core/config.js';
import { EVENTS } from '../../src/core/constants.js';

function fakeFetch(routes) {
  return async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`no fake route for ${key}`);
    return handler(init);
  };
}

test('SyncEngine flushes the queue and pulls new manifests', async () => {
  const db = new MemoryStore();
  const bus = new EventBus();
  const queue = new SyncQueue(db);
  const manifestStore = new ManifestStore(db);
  const packageStore = new PackageStore(db);
  const config = resolveConfig({ apiBaseUrl: 'https://api.casuya.co.tz', syncIntervalMs: 0 });

  await queue.enqueue({ type: 'progress', payload: { ok: true } });

  const fetchImpl = fakeFetch({
    'POST https://api.casuya.co.tz/sync/events': async () => ({
      ok: true,
      status: 200,
      json: async () => ({ received: 1 }),
      headers: { get: () => 'application/json' },
    }),
    'GET https://api.casuya.co.tz/lessons/manifests': async () => ({
      ok: true,
      status: 200,
      json: async () => [{ slug: 'lesson-a', content_hash: 'v1' }],
      headers: { get: () => 'application/json' },
    }),
    'GET https://api.casuya.co.tz/lessons/lesson-a/package': async () => ({
      ok: true,
      status: 200,
      json: async () => ({ body_html: '<p>hi</p>' }),
      headers: { get: () => 'application/json' },
    }),
  });

  const engine = new SyncEngine({ bus, queue, manifestStore, packageStore, config, fetchImpl });

  let successPayload = null;
  bus.on(EVENTS.SYNC_SUCCESS, (payload) => (successPayload = payload));

  await engine.syncNow();

  assert.equal(await queue.size(), 0);
  assert.equal(successPayload.updated, 1);
  assert.deepEqual(await packageStore.get('lesson-a'), { body_html: '<p>hi</p>' });
});
