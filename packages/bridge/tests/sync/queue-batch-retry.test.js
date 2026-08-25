import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../../src/storage/indexeddb.js';
import { SyncQueue } from '../../src/sync/queue.js';
import { toBatches } from '../../src/sync/batch.js';
import { backoffDelayMs, shouldRetry } from '../../src/sync/retry.js';
import { RETRYABLE_STATUS_CODES } from '../../src/core/constants.js';

test('SyncQueue enqueue/all/remove/size', async () => {
  const queue = new SyncQueue(new MemoryStore());
  await queue.enqueue({ type: 'progress' });
  await queue.enqueue({ type: 'progress' });
  assert.equal(await queue.size(), 2);

  const all = await queue.all();
  await queue.remove(all[0].id);
  assert.equal(await queue.size(), 1);
});

test('toBatches splits records into fixed-size groups', () => {
  const records = Array.from({ length: 45 }, (_, i) => i);
  const batches = toBatches(records, 20);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].length, 20);
  assert.equal(batches[2].length, 5);
});

test('toBatches throws on invalid size', () => {
  assert.throws(() => toBatches([1, 2], 0));
});

test('backoffDelayMs grows with attempt number', () => {
  const d0 = backoffDelayMs(0, 1000, 60_000);
  const d3 = backoffDelayMs(3, 1000, 60_000);
  assert.ok(d3 > d0);
});

test('shouldRetry respects maxRetries and retryable status codes', () => {
  assert.equal(shouldRetry(0, 5, 500, RETRYABLE_STATUS_CODES), true);
  assert.equal(shouldRetry(0, 5, 404, RETRYABLE_STATUS_CODES), false);
  assert.equal(shouldRetry(5, 5, 500, RETRYABLE_STATUS_CODES), false);
  assert.equal(shouldRetry(0, 5, undefined, RETRYABLE_STATUS_CODES), true);
});
