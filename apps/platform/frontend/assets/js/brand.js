(function(){
// brand.js — Dynamic site branding (favicon + logo).
// Caches existence checks in localStorage to avoid redundant fetches on every page load.

var API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
  : (window.location.port === "8000" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
    ? window.location.origin
    : window.location.protocol + "//" + window.location.hostname + ":8000";

var DEFAULT_LOGO_SVG = "/assets/images/casuya-logo.svg";
var CACHE_KEY_PREFIX = "casuya_brand_";
var CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Helpers ──────────────────────────────────────────────────────────────
function _getCached(kind) {
  try {
    var raw = localStorage.getItem(CACHE_KEY_PREFIX + kind);
    if (!raw) return null;
    var entry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY_PREFIX + kind); return null; }
    return entry.exists;
  } catch(e) { return null; }
}

function _setCached(kind, exists) {
  try { localStorage.setItem(CACHE_KEY_PREFIX + kind, JSON.stringify({ exists: exists, ts: Date.now() })); } catch(e) {}
}

// ── Favicon ──────────────────────────────────────────────────────────────
function _applyFavicon(url) {
  var link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

_applyFavicon(API_BASE + "/branding/favicon.ico");

async function loadFavicon() {
  var cached = _getCached("favicon");
  if (cached === true) { _applyFavicon(API_BASE + "/branding/favicon"); return; }
  if (cached === false) { _applyFavicon(DEFAULT_LOGO_SVG); return; }
  try {
    var res = await fetch(API_BASE + "/branding/favicon");
    if (res.ok) {
      _setCached("favicon", true);
      _applyFavicon(API_BASE + "/branding/favicon");
      return;
    }
  } catch(e) {}
  _setCached("favicon", false);
  _applyFavicon(DEFAULT_LOGO_SVG);
}

// ── Logo ─────────────────────────────────────────────────────────────────
function _applyLogo(url) {
  document.querySelectorAll("[data-brand-logo]").forEach(function(el) {
    if (el.querySelector("img[data-brand-img]")) return;
    el.innerHTML = "";
    var img = document.createElement("img");
    img.src = url;
    img.alt = "Casuya";
    img.dataset.brandImg = "";
    img.className = el.dataset.brandLogoClass || "w-9 h-9 rounded-xl object-contain";
    el.appendChild(img);
  });
}

async function loadLogo() {
  var cached = _getCached("logo");
  if (cached === true) { _applyLogo(API_BASE + "/branding/logo"); return; }
  if (cached === false) { return; }
  try {
    var res = await fetch(API_BASE + "/branding/logo");
    if (res.ok) {
      _setCached("logo", true);
      _applyLogo(API_BASE + "/branding/logo");
      return;
    }
  } catch(e) {}
  _setCached("logo", false);
}

// ── Init ─────────────────────────────────────────────────────────────────
loadFavicon();
loadLogo();
})();
