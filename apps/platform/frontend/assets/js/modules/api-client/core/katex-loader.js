// modules/api-client/core/katex-loader.js — on-demand KaTeX loader.
//
// katex.min.js (~265KB) + auto-render + katex.min.css no longer ship in the
// portal <head> for every user. They are injected lazily, only when something
// actually renders math (quiz/lesson math, admin previews, AI tutor answers,
// blackboard replays). The service worker caches them once fetched, so repeat
// usage is instant and offline-safe.
//
// Always resolves (never rejects) so callers can fire-and-forget safely:
// non-tech users on slow links get gracefully unrendered math instead of breakage.

window.ensureKaTeX = function () {
  if (window.ensureKaTeX.__promise) return window.ensureKaTeX.__promise;

  window.ensureKaTeX.__promise = new Promise(function (resolve) {
    function loadScript(src, timeout) {
      return new Promise(function (res) {
        var s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = res;
        s.onerror = res;
        if (timeout) setTimeout(res, timeout);
        document.head.appendChild(s);
      });
    }

    // katex.min.css is required for proper math layout, inject it first.
    if (!document.querySelector('link[href$="katex.min.css"]')) {
      var css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/static/lib/katex/katex.min.css";
      document.head.appendChild(css);
    }

    if (window.katex && typeof window.renderMathInElement === "function") {
      resolve(true);
      return;
    }

    loadScript("/static/lib/katex/katex.min.js", 8000).then(function () {
      if (typeof window.renderMathInElement === "function") {
        resolve(true);
        return;
      }
      return loadScript("/static/lib/katex/contrib/auto-render.min.js", 8000);
    }).then(function () {
      resolve(!!(window.katex && typeof window.renderMathInElement === "function"));
    });
  });

  return window.ensureKaTeX.__promise;
};