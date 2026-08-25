// casuya-env.js — environment-aware API URL resolution.
//
// In production (Vercel / custom domain) we point the frontend at the Render
// backend. On localhost we intentionally leave CASUYA_API_URL UNSET so that
// config.js falls back to the local API (http://localhost:8000), keeping
// local development fully local and free of production coupling.
(function () {
  var host = window.location.hostname || "";
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1";
  if (!isLocal) {
    window.CASUYA_API_URL = "https://casuya-backend.onrender.com";
  }
})();
