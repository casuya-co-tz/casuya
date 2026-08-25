# Getting started

## Install

```bash
npm install casuya-bridge
```

## Create a bridge instance

```js
import { CasuyaBridge } from 'casuya-bridge';

const bridge = new CasuyaBridge({
  apiBaseUrl: 'https://api.casuya.co.tz',
});

bridge.start(); // begins connectivity monitoring + periodic sync
```

`start()` wires up:
- connectivity monitoring (`online`/`offline` browser events)
- the sync engine's timer (if `syncIntervalMs > 0`)
- Background Sync API registration (best-effort, falls back to the timer)

Call `bridge.stop()` to tear all of that down (e.g. on page unload in an SPA).

## Rendering a lesson

`renderLesson` expects the lesson package to already be cached locally
(via `syncNow()` or a prior sync). It does **not** fetch over the network
itself — that separation keeps rendering fast and offline-safe.

```js
await bridge.renderLesson('mole-concept', document.getElementById('mount'));
```

## Next steps

- [rendering.md](rendering.md) — sandbox modes and dependency injection
- [caching.md](caching.md) — storage layers and cache-first strategy
- [synchronization.md](synchronization.md) — queue, batching, retry, background sync
- [progress.md](progress.md) — sessions, scoring, completion, analytics
- [security.md](security.md) — signature and integrity verification
- [api-reference.md](api-reference.md) — full public API
