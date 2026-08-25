/** Micro-benchmark for the sync queue's batch/backoff logic, useful for
 * sanity-checking behavior on low-end devices without a real network. */

import { toBatches } from '../src/sync/batch.js';
import { backoffDelayMs } from '../src/sync/retry.js';

function benchmarkBatching(n = 10_000, batchSize = 20) {
  const records = Array.from({ length: n }, (_, i) => ({ id: i }));
  const start = performance.now();
  const batches = toBatches(records, batchSize);
  const elapsed = performance.now() - start;
  console.log(`toBatches(${n} records, size ${batchSize}) -> ${batches.length} batches in ${elapsed.toFixed(2)}ms`);
}

function printBackoffCurve(maxRetries = 6) {
  console.log('Backoff curve (ms):');
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`  attempt ${attempt}: ~${backoffDelayMs(attempt)}ms`);
  }
}

benchmarkBatching();
printBackoffCurve();
