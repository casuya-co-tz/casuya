(function () {
  // casuya-config.js — central API base resolution for the static frontend.
  //
  // In production, point the frontend at your Render backend by setting the
  // global CASUYA_API_URL (e.g. https://casuya-platform-production.up.railway.app) in a small
  // inline <script> that runs BEFORE this file, or via Vercel env substitution.
  //
  // In development it targets the local API on port 8765 (same-origin when the
  // frontend is served from the API host).

  function resolveBase() {
    if (window.CASUYA_API_URL) {
      return String(window.CASUYA_API_URL).replace(/\/+$/, "");
    }
    var hostname = window.location.hostname || "localhost";
    var protocol = (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? window.location.protocol
      : "http:";
    var port = window.location.port;
    var isSameOrigin = port === "8765" || port === "" || port === "443" || port === "80";
    return isSameOrigin ? window.location.origin : protocol + "//" + hostname + ":8765";
  }

  window.casuyaApiBase = function () {
    return resolveBase();
  };

  window.casuyaOAuthUrl = function (provider) {
    return resolveBase() + "/auth/oauth/" + encodeURIComponent(provider);
  };

  // Register the offline/performance service worker ONLY after auth is established.
  // On the login/register pages (no token), skip SW registration to avoid caching
  // auth-critical requests before the session is established.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      var path = window.location.pathname;
      var isAuthPage = /\/(?:login|register|forgot-password|reset-password|index)\.html?$/.test(path) || path === "/";
      var hasToken = !!localStorage.getItem("casuya_token");

      // Register SW only on authenticated portal pages (student/teacher/admin)
      // OR on public pages where the user already has a token
      if (!isAuthPage || hasToken) {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
      }
    });
  }
})();
