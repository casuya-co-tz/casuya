(function(){
// brand.js — Dynamic site branding (favicon + logo).

var API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
  : (window.location.port === "8000" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
    ? window.location.origin
    : window.location.protocol + "//" + window.location.hostname + ":8000";

var DEFAULT_LOGO_SVG = "/assets/images/casuya-logo.svg";

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
  try {
    var res = await fetch(API_BASE + "/branding/favicon");
    if (res.ok) {
      _applyFavicon(API_BASE + "/branding/favicon?t=" + Date.now());
      return;
    }
  } catch(e) {}
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
  try {
    var res = await fetch(API_BASE + "/branding/logo");
    if (res.ok) {
      _applyLogo(API_BASE + "/branding/logo?t=" + Date.now());
      return;
    }
  } catch(e) {}
}

// ── Init ─────────────────────────────────────────────────────────────────
loadFavicon();
loadLogo();
})();
