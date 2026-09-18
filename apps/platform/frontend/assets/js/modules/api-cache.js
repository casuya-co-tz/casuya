// modules/api-cache.js — GET cache + in-flight dedupe for the static frontend.
// Wired from modules/api-client/core/fetch.js. Classic script (globals).

const requestCache = new Map();
const inFlight = new Map();
const CACHE_TTL = 30000;

function clearRequestCaches() {
  requestCache.clear();
  inFlight.clear();
}
window.clearRequestCaches = clearRequestCaches;

function requestCacheKey(path, method) {
  return String(method || "GET").toUpperCase() + " " + path;
}

function isCacheableRequest(path, options) {
  if (!options) options = {};
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "GET") return false;
  if (options.skipCache || options._retry) return false;
  // Auth, live progress, notifications, and AI must always hit the network.
  if (/^\/(?:auth|progress|notifications|ai)\b/i.test(path)) return false;
  return true;
}

function getCachedRequest(path, options) {
  if (!isCacheableRequest(path, options)) return null;
  const key = requestCacheKey(path, options && options.method);
  const hit = requestCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) {
    requestCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedRequest(path, options, value) {
  if (!isCacheableRequest(path, options)) return;
  requestCache.set(requestCacheKey(path, options && options.method), {
    at: Date.now(),
    value: value,
  });
}

function getInFlightRequest(path, options) {
  if (!isCacheableRequest(path, options)) return null;
  return inFlight.get(requestCacheKey(path, options && options.method)) || null;
}

function setInFlightRequest(path, options, promise) {
  if (!isCacheableRequest(path, options)) return;
  inFlight.set(requestCacheKey(path, options && options.method), promise);
}

function clearInFlightRequest(path, options) {
  inFlight.delete(requestCacheKey(path, options && options.method));
}
