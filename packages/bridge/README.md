# casuya-bridge

Offline-first student runtime and synchronization engine for **Casuya**'s
compiled HTML lessons (produced by [`casuya-core`](https://github.com/yakoboI/casuya-core)).

Since Casuya lessons are complete, self-contained HTML packages, this
library focuses on **rendering, caching, progress tracking, and
synchronization** — not compilation.

## Install

```bash
npm install casuya-bridge
```

## Quick start

```js
import { CasuyaBridge } from 'casuya-bridge';

const bridge = new CasuyaBridge({
  apiBaseUrl: 'https://api.casuya.co.tz',
  syncIntervalMs: 30_000,
  sandboxMode: 'iframe', // or 'shadow-dom'
});

bridge.start();

// Render a previously-synced lesson package into the DOM
await bridge.renderLesson('balancing-chemical-equations', document.getElementById('lesson-mount'));

// Track a student session
const session = bridge.startSession({
  lessonSlug: 'balancing-chemical-equations',
  studentId: 'student-123',
  totalSections: 4,
});

bridge.visitSection(session.id, 0);
bridge.recordAnswer(session.id, { questionId: 'q1', isCorrect: true });

const record = await bridge.endSession(session.id);
console.log(record.completionPercentage, record.scorePercentage);

// Force an immediate sync (otherwise runs on the configured interval and
// automatically when connectivity returns)
await bridge.syncNow();
```

## Main flow

```
Student Opens Lesson
        |
        v
   renderer.js
        |
        v
    sandbox.js
        |
        v
     cache.js
        |
        v
    tracker.js
        |
        v
     queue.js
        |
        v
  sync-engine.js
        |
        v
   Server API
```

## Module map

| Area             | Responsibility                                              |
|-------------------|---------------------------------------------------------------|
| `core/`          | Bridge facade, runtime wiring, config, events, hooks, errors  |
| `rendering/`     | Sandboxed iframe/shadow-DOM rendering of lesson packages       |
| `storage/`       | IndexedDB (with in-memory fallback), packages, assets, manifests |
| `sync/`          | Queue, batching, retry/backoff, background sync, up/download   |
| `progress/`      | Sessions, timers, scoring, completion, analytics               |
| `media/`         | Image/audio/video caching, lazy loading, preloading             |
| `network/`       | Connectivity monitoring, fetch wrapper, heartbeat                |
| `security/`      | HMAC signature + content-hash verification, sanitization        |
| `accessibility/` | Keyboard nav, theming, zoom, screen-reader live region          |
| `utils/`         | Generic helpers (uuid, logger, serializer, parser)               |

See [docs/](docs/) for details on each area, and [examples/](examples/) for
runnable demos (simple lesson, chemistry lab, quiz game, offline demo, PWA demo).

## Configuration

```js
new CasuyaBridge({
  apiBaseUrl: '',            // required for sync/download to work
  dbName: 'casuya-bridge',
  dbVersion: 1,
  syncIntervalMs: 30000,     // 0 disables the timer (rely on connectivity events only)
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  batchSize: 20,
  sandboxMode: 'iframe',     // 'iframe' | 'shadow-dom'
  theme: 'light',
});
```

## Security model

Packages produced by `casuya-core` include a `manifest.json` (with a
`content_hash`) and a `signature.sig` (HMAC-SHA256 over body + manifest).
`casuya-bridge` exposes `verifyContentHashOrThrow` and `verifyOrThrow` so a
consuming app can check integrity before rendering an untrusted or
long-cached package:

```js
import { verifyContentHashOrThrow, verifyOrThrow } from 'casuya-bridge';

await verifyContentHashOrThrow(bodyHtml, manifest.content_hash);
await verifyOrThrow(bodyHtml + manifestJson, signature, sharedSigningKey);
```

Rendering itself always happens inside a sandboxed `<iframe>` (default) or
an isolated shadow root — lesson script never runs with access to the host
page's DOM by default.

## Development

```bash
npm install
npm test              # Node's built-in test runner
npm run test:coverage # with coverage
npm run build          # esbuild -> dist/casuya-bridge.{js,esm.js,min.js}
```

## Publishing

```bash
npm run build
npm publish
```

The included `.github/workflows/publish.yml` publishes automatically on a
tagged GitHub release, given an `NPM_TOKEN` repository secret.

## License

MIT — see [LICENSE](LICENSE).
