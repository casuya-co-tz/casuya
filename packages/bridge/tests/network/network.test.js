import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectivityMonitor } from '../../src/network/connectivity.js';
import { EventBus } from '../../src/core/events.js';
import { EVENTS } from '../../src/core/constants.js';
import { fetchWithTimeout } from '../../src/network/fetcher.js';
import { NetworkError } from '../../src/core/errors.js';

test('ConnectivityMonitor emits events on simulated changes', () => {
  const bus = new EventBus();
  const monitor = new ConnectivityMonitor(bus);

  let lastEvent = null;
  bus.on(EVENTS.CONNECTIVITY_OFFLINE, () => (lastEvent = 'offline'));
  bus.on(EVENTS.CONNECTIVITY_ONLINE, () => (lastEvent = 'online'));

  monitor.simulate(false);
  assert.equal(lastEvent, 'offline');
  assert.equal(monitor.isOnline, false);

  monitor.simulate(true);
  assert.equal(lastEvent, 'online');
});

test('fetchWithTimeout normalizes a successful JSON response', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ hello: 'world' }),
  });
  const result = await fetchWithTimeout({ url: 'https://x', method: 'GET', headers: {} }, { fetchImpl });
  assert.deepEqual(result, { ok: true, status: 200, body: { hello: 'world' } });
});

test('fetchWithTimeout wraps a rejected fetch in NetworkError', async () => {
  const fetchImpl = async () => {
    throw new Error('DNS failure');
  };
  await assert.rejects(
    () => fetchWithTimeout({ url: 'https://x', method: 'GET', headers: {} }, { fetchImpl }),
    NetworkError
  );
});
