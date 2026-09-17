# Caching

## Storage backend

`storage/indexeddb.js` provides a promise-based wrapper around IndexedDB.
When `indexedDB` isn't available (Node, some older WebViews), it
transparently falls back to an in-memory `MemoryStore` with the same
interface, so the rest of the codebase never branches on environment.

## Stores

- **PackageStore** — full compiled lesson packages (`body.html` + parsed manifest)
- **ManifestStore** — lightweight manifest records used to detect staleness
  (`findStale` compares `content_hash` against what the server reports)
- **AssetStore** — binary media (images/audio/video), with `evictOlderThan`
  for simple TTL-based cleanup

## Cache-first reads

`CacheFirstReader` composes any store + a network fetcher: it checks the
store first, and only calls the fetcher (then writes the result back to the
store) on a miss — the same strategy used by the Casuya PWA service worker.

## Media caching

`media/images.js` and `media/audio.js` cache assets as `Blob`s and return
`URL.createObjectURL()` references. `media/video.js` adds a size cutoff
(`maxCacheableBytes`, default 25MB) so large videos stream directly instead
of exhausting device storage. `media/preloader.js` fetches a batch of URLs
with bounded concurrency, useful right after a manifest sync.

### Speech WAV cache (TTS)

`media/audio.js` exports `TtsAudioCache` — IndexedDB-backed storage for
synthesized TTS WAV blobs keyed by `lang|speed|text`. The platform frontend
mirrors this in `speech-storage.js` (same DB name `casuya-speech`).

| Setting | Default |
|---|---|
| Max cache size | 50 MB |
| Max age | 7 days |
| Eviction | LRU by `cachedAt` |

On cache hit the student hears audio without a network round-trip — critical
on 2G/3G. Prefetch (`casuyaPrefetchTts`) populates the cache in the
background after a lesson renders.

### STT offline outbox

`media/stt-outbox.js` queues failed STT uploads (`wav` blob + target selector
+ optional `language` hint). `drain()` replays when connectivity returns.
Platform equivalent: `speech-storage.js` + `drainPendingStt()` in `speech.js`.
