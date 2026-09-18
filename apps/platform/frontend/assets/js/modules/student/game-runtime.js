// modules/student/game-runtime.js — mount educational games in packages/runtime sandbox.
// Falls back to srcdoc if the runtime IIFE is missing or rejects the package.

"use strict";

var CASUYA_RUNTIME_SRC = "/static/pkg/runtime/casuya-runtime.min.js";
var _casuyaRuntimeInstance = null;

function loadCasuyaRuntime() {
  if (window.CasuyaRuntime && window.CasuyaRuntime.Runtime) return Promise.resolve(true);
  var loader = typeof loadCasuyaScript === "function" ? loadCasuyaScript : null;
  if (!loader) return Promise.resolve(false);
  var src = typeof casuyaAssetUrl === "function" ? casuyaAssetUrl(CASUYA_RUNTIME_SRC) : CASUYA_RUNTIME_SRC;
  return loader(src).then(function () {
    return !!(window.CasuyaRuntime && window.CasuyaRuntime.Runtime);
  }).catch(function () { return false; });
}

function htmlToRuntimePackage(html, id, title) {
  var safeId = String(id || "game").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "game";
  var bytes = new TextEncoder().encode(html);
  return {
    manifest: {
      id: safeId,
      version: "1.0.0",
      title: String(title || "Game").slice(0, 200),
      type: "game",
      permissions: ["game", "storage", "canvas"],
      entry: "index.html",
    },
    resources: { "index.html": bytes },
  };
}

function mountGameSrcdoc(container, html) {
  if (!container) return;
  var iframe = document.createElement("iframe");
  iframe.className = "lesson-iframe";
  iframe.style.cssText = "width:100%;border:none;display:block;min-height:300px";
  container.innerHTML = "";
  container.appendChild(iframe);
  iframe.srcdoc = typeof injectNodeBase === "function" ? injectNodeBase(html) : html;
  var heightSet = false;
  var setHeight = function () {
    if (heightSet) return;
    try {
      var doc = iframe.contentWindow && iframe.contentWindow.document;
      if (doc) {
        iframe.style.height = Math.max(
          (doc.documentElement && doc.documentElement.scrollHeight) || 0,
          (doc.body && doc.body.scrollHeight) || 0,
          300
        ) + "px";
        heightSet = true;
      }
    } catch (e) {}
  };
  iframe.addEventListener("load", setHeight);
  var poll = setInterval(function () { setHeight(); if (heightSet) clearInterval(poll); }, 300);
  setTimeout(function () { clearInterval(poll); if (!heightSet) iframe.style.height = "600px"; }, 8000);
}

async function mountGameRuntime(container, html, meta) {
  if (_casuyaRuntimeInstance && typeof _casuyaRuntimeInstance.destroy === "function") {
    try { await _casuyaRuntimeInstance.destroy(); } catch (e) {}
    _casuyaRuntimeInstance = null;
  }
  var prepared = typeof injectNodeBase === "function" ? injectNodeBase(html) : html;
  var ok = await loadCasuyaRuntime();
  if (!ok || !container || !prepared) {
    mountGameSrcdoc(container, prepared || html || "");
    return function () {};
  }
  container.style.minHeight = "300px";
  container.style.height = container.style.height || "600px";
  var Runtime = window.CasuyaRuntime.Runtime;
  var rt = new Runtime({
    container: container,
    permissions: ["game", "storage", "canvas", "media"],
  });
  _casuyaRuntimeInstance = rt;
  try {
    await rt.load(htmlToRuntimePackage(prepared, meta && meta.id, meta && meta.title));
    await rt.start();
    return function () {
      rt.destroy();
      if (_casuyaRuntimeInstance === rt) _casuyaRuntimeInstance = null;
    };
  } catch (e) {
    try { await rt.destroy(); } catch (e2) {}
    if (_casuyaRuntimeInstance === rt) _casuyaRuntimeInstance = null;
    mountGameSrcdoc(container, prepared);
    return function () {};
  }
}
