import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectivityMonitor } from '../../src/network/connectivity.js';
import { NetworkRecovery } from '../../src/network/recovery.js';
import { EventBus } from '../../src/core/events.js';
import { EVENTS } from '../../src/core/constants.js';
import { fetchWithTimeout } from '../../src/network/fetcher.js';
import { NetworkError } from '../../src/core/errors.js';
import { resolveConfig } from '../../src/core/config.js';

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

test('NetworkRecovery terminates instead of looping forever', async () => {
  const bus = new EventBus();
  const config = resolveConfig({ retryBaseDelayMs: 1 });
  const recovery = new NetworkRecovery({ bus, config });

  let onlineEvents = 0;
  const started = (async () => {
    for (let i = 0; i < 3; i += 1) {
      bus.emit(EVENTS.CONNECTIVITY_ONLINE);
      onlineEvents += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  })();

  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))]);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(recovery.isRecovering, false);
  assert.equal(onlineEvents, 3);
});
