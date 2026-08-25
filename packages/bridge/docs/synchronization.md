# Synchronization

## Queue

`sync/queue.js` persists pending events (progress records, quiz answers,
etc.) to the `sync-queue` store so nothing is lost if the tab closes before
a sync completes.

## Batching

`sync/batch.js` groups queued events into fixed-size batches
(`config.batchSize`, default 20) before upload, to bound request size on
slow 2G/3G links.

## Retry & backoff

`sync/retry.js` implements exponential backoff with jitter
(`backoffDelayMs`) and a `shouldRetry` predicate that retries network
errors and a fixed set of retryable HTTP status codes (408, 425, 429, 500,
502, 503, 504), up to `config.maxRetries`.

## SyncEngine

`sync/sync-engine.js` orchestrates the full cycle:

1. Flush the local queue (upload batches, remove on success)
2. Pull the remote manifest list, diff against local manifests
   (`ManifestStore.findStale`)
3. Download and store any stale/new packages

It emits `sync:started`, `sync:success` (with an `updated` count), and
`sync:failure` on the shared event bus.

## Background Sync

`sync/background-sync.js` triggers an immediate sync whenever the
`connectivity:online` event fires, and registers the browser's Background
Sync API when available (`swRegistration.sync`) as an additional trigger —
this is best-effort and always has the interval timer as a fallback.
