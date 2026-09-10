// modules/api-cache.js — Request caching layer

const requestCache = new Map();

const inFlight = new Map();

function clearRequestCaches() {
  requestCache.clear();
  inFlight.clear();
}
window.clearRequestCaches = clearRequestCaches;

const CACHE_TTL = 30000;
