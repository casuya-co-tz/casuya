/** Groups queued events into fixed-size batches for network-efficient sync. */

export function toBatches(records, batchSize) {
  if (batchSize <= 0) throw new Error('batchSize must be > 0');
  const batches = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }
  return batches;
}
