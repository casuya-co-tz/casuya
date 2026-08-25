# Rendering

`casuya-bridge` renders a cached lesson package into the DOM using one of
two sandbox strategies, chosen via `config.sandboxMode`:

## `iframe` (default)

The lesson body is written into a sandboxed `<iframe sandbox="allow-scripts
allow-same-origin allow-forms">`. This gives the strongest isolation: lesson
JS cannot reach the host page's DOM, cookies, or global scope directly.

## `shadow-dom`

The lesson body is rendered into a shadow root attached to a plain `<div>`.
Style isolation is preserved, but there is no JS sandboxing — use this only
for trusted, first-party lesson content where the postMessage overhead of
an iframe isn't worth it.

## Dependency resolution

Before rendering, `rendering/dependencies.js` resolves each stylesheet/script
path declared in the lesson's manifest against `config.apiBaseUrl` (relative
paths only — absolute URLs pass through unchanged).

## Render lifecycle

`RenderStateManager` tracks `idle -> loading -> ready | error` and emits
`render:<state>` events on the shared event bus, in addition to the
higher-level `lesson:loaded` / `lesson:ready` / `lesson:error` events.
