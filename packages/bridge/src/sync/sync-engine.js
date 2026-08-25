/** Orchestrates queued-event upload and manifest/package download,
 * with retry + backoff, driven by connectivity changes or a timer. */

import { EVENTS, RETRYABLE_STATUS_CODES } from '../core/constants.js';
import { toBatches } from './batch.js';
import { backoffDelayMs, shouldRetry } from './retry.js';
import { uploadBatch } from './uploads.js';
import { downloadManifests, downloadPackage } from './downloads.js';
import { sleep } from '../utils/helpers.js';

const MAX_DEAD_LETTER_ATTEMPTS = 10;

export class SyncEngine {
  constructor({ bus, queue, manifestStore, packageStore, config, fetchImpl }) {
    this._bus = bus;
    this._queue = queue;
    this._manifestStore = manifestStore;
    this._packageStore = packageStore;
    this._config = config;
    this._fetchImpl = fetchImpl;
    this._syncing = false;
    this._timer = null;
  }

  start() {
    if (this._config.syncIntervalMs > 0) {
      this._timer = setInterval(() => this.syncNow(), this._config.syncIntervalMs);
    }
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async syncNow() {
    if (this._syncing) return { skipped: true };
    this._syncing = true;
    this._bus?.emit(EVENTS.SYNC_STARTED);
    try {
      await this._flushQueue();
      const updated = await this._pullManifests();
      this._bus?.emit(EVENTS.SYNC_SUCCESS, { updated });
      return { skipped: false, updated };
    } catch (err) {
      this._bus?.emit(EVENTS.SYNC_FAILURE, { error: err });
      throw err;
    } finally {
      this._syncing = false;
    }
  }

  async _flushQueue() {
    const records = await this._queue.all();
    if (records.length === 0) return;

    const batches = toBatches(records, this._config.batchSize);
    for (const batch of batches) {
      await this._uploadBatchWithRetry(batch);
    }
  }

  async _uploadBatchWithRetry(batch) {
    let attempt = 0;
    while (true) {
      try {
        const response = await uploadBatch(this._config.apiBaseUrl, batch, {
          fetchImpl: this._fetchImpl,
        });
        if (!response.ok) {
          if (shouldRetry(attempt, this._config.maxRetries, response.status, RETRYABLE_STATUS_CODES)) {
            await sleep(backoffDelayMs(attempt, this._config.retryBaseDelayMs));
            attempt += 1;
            continue;
          }
          await this._deadLetter(batch, attempt, `HTTP ${response.status}`);
          return;
        }
        for (const record of batch) await this._queue.remove(record.id);
        return response;
      } catch (err) {
        if (shouldRetry(attempt, this._config.maxRetries, undefined, RETRYABLE_STATUS_CODES)) {
          await sleep(backoffDelayMs(attempt, this._config.retryBaseDelayMs));
          attempt += 1;
          continue;
        }
        await this._deadLetter(batch, attempt, err.message);
        return;
      }
    }
  }

  async _deadLetter(batch, attemptsMade, reason) {
    for (const record of batch) {
      const totalAttempts = (record.attempts ?? 0) + attemptsMade;
      if (totalAttempts >= MAX_DEAD_LETTER_ATTEMPTS) {
        await this._queue.remove(record.id);
      } else {
        await this._queue.updateAttempts(record.id, totalAttempts);
      }
    }
  }

  async _pullManifests() {
    const remote = await downloadManifests(this._config.apiBaseUrl, { fetchImpl: this._fetchImpl });
    const stale = await this._manifestStore.findStale(remote);
    for (const manifest of stale) {
      const slug = manifest.metadata?.slug ?? manifest.slug;
      const pkg = await downloadPackage(this._config.apiBaseUrl, slug, { fetchImpl: this._fetchImpl });
      await this._packageStore.save(slug, pkg);
      await this._manifestStore.save(slug, manifest);
    }
    return stale.length;
  }
}