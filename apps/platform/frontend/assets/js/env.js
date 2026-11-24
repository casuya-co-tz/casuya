// casuya-env.js — environment-aware API URL resolution.
//
// Resolution order:
//   1. window.CASUYA_API_BASE_URL — injected at build time from the
//      CASUYA_API_URL environment variable (see build-js.mjs). Use this to
//      target staging, a custom domain, or a local backend without editing
//      source.
//   2. The production default below — only for non-local hosts when no build
//      override was supplied.
//
// On localhost we intentionally leave CASUYA_API_URL UNSET so config.js falls
// back to the local API (http://localhost:8765). The canonical base resolver
// lives in config.js; this file only supplies the production default.
(function () {
  var host = window.location.hostname || "";
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1";
  if (isLocal) return;
  if (window.CASUYA_API_BASE_URL) {
    window.CASUYA_API_URL = String(window.CASUYA_API_BASE_URL).replace(/\/+$/, "");
    return;
  }
  window.CASUYA_API_URL = "https://casuya-platform-production.up.railway.app";
})();
