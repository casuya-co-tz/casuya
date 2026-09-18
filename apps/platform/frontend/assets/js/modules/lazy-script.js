// modules/lazy-script.js — one-shot classic-script loader (shared global scope).
// Used to fetch route chunks and the speech bundle after first paint.

var _casuyaScriptLoads = Object.create(null);

function casuyaAssetUrl(src) {
  if (!src) return src;
  var path = String(src).split("?")[0];
  var map = window.CASUYA_ASSETS;
  var v = map && map[path];
  return v ? path + "?v=" + v : src;
}

function loadCasuyaScript(src) {
  src = casuyaAssetUrl(src);
  if (_casuyaScriptLoads[src]) return _casuyaScriptLoads[src];
  _casuyaScriptLoads[src] = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing && existing.getAttribute("data-casuya-loaded") === "1") {
      resolve();
      return;
    }
    var s = existing || document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = function () {
      s.setAttribute("data-casuya-loaded", "1");
      resolve();
    };
    s.onerror = function () {
      delete _casuyaScriptLoads[src];
      reject(new Error("Failed to load " + src));
    };
    if (!existing) document.head.appendChild(s);
  });
  return _casuyaScriptLoads[src];
}

function ensureSpeechBundle() {
  if (typeof casuyaSpeakText === "function") return Promise.resolve();
  return loadCasuyaScript("/assets/js/speech.bundle.js");
}

document.addEventListener("click", function (e) {
  var el = e.target && e.target.closest && e.target.closest(".casuya-listen, .casuya-record");
  if (!el) return;
  if (typeof casuyaSpeakText === "function") return;
  e.preventDefault();
  e.stopImmediatePropagation();
  ensureSpeechBundle().then(function () {
    el.click();
  }).catch(function () {});
}, true);

window.loadCasuyaScript = loadCasuyaScript;
window.ensureSpeechBundle = ensureSpeechBundle;
window.casuyaAssetUrl = casuyaAssetUrl;
