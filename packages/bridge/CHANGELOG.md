# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-07-02

### Added
- Initial release of `casuya-bridge`.
- Offline-first rendering of Casuya HTML lesson packages via sandboxed
  `<iframe>` or shadow-DOM, selectable per deployment.
- IndexedDB-backed storage for packages, assets, and manifests, with an
  automatic in-memory fallback for non-browser environments.
- Sync engine with queued events, batching, exponential backoff retry, and
  Background Sync API integration (falling back to interval polling).
- Progress tracking: sessions, timers, quiz scoring, completion percentage,
  and lightweight analytics aggregation.
- Media caching for images/audio/video with lazy loading and a size-aware
  preloader.
- Security layer: HMAC-SHA256 signature verification and SHA-256 content-hash
  integrity checks compatible with `casuya-core`'s packager output.
- Accessibility helpers: keyboard navigation, theming, zoom, and an ARIA
  live region for screen-reader announcements.
- Full test suite (Node's built-in test runner) and an esbuild-based build
  producing ESM, IIFE, and minified IIFE bundles.
