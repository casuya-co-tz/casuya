// casuya-service-worker.js — conservative offline/performance cache.
//
// Strategy (safe for a multi-page, auth-driven app):
//   - Static assets (/assets/*, /static/*, and known file types): stale-while-revalidate.
//     These are inert (JS/CSS/fonts/KaTeX), so serving a cached copy is always safe and
//     makes repeat loads instant on 2G/3G.
//   - Lesson content (/api/lessons/<id>/content): stale-while-revalidate (same-origin only).
//   - Navigation (HTML) and all other API calls: network-only, so auth and dynamic data
//     are NEVER served from cache (no stale dashboards, no leaked sessions).
//
// Cache is versioned; bump CACHE_VERSION when you change cached assets.

const CACHE_VERSION = "casuya-static-v4";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/assets/css/main.min.css",
  "/assets/css/tailwind.min.css",
  "/assets/js/env.js",
  "/assets/js/config.js",
  "/assets/js/main.min.js",
  "/assets/js/brand.js",
  "/assets/images/casuya-logo.svg",
  "/assets/images/icons/icon-192.png",
  "/assets/images/icons/icon-512.png",
  "/assets/images/icons/apple-touch-icon.png",
  "/static/lib/katex/katex.min.css",
  "/static/lib/katex/katex.min.js",
  "/static/lib/katex/contrib/auto-render.min.js",
];

const STATIC_RE = /\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|mp4|webm|mp3|wav|pdf|webmanifest)(?:[?#]|$)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Resilient: never fail install if one asset is missing.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isLessonContent(url) {
  return url.pathname.match(/^\/api\/lessons\/[^/]+\/content\/?$/i);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (e.g. API host)

  // Lesson content: stale-while-revalidate (same-origin only).
  if (isLessonContent(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Auth-critical files: always network (never stale).
  var AUTH_RE = /\/(?:auth-guard|auth-ui|auth-client)\.js$/;
  if (AUTH_RE.test(url.pathname)) return;

  // Navigation + other API: always network (keep auth/dynamic data fresh).
  if (req.mode === "navigate" || url.pathname.startsWith("/api/")) return;

  // Static assets: stale-while-revalidate.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/static/") || STATIC_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
