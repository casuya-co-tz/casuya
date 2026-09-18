// modules/student/game-runtime.js — mount games and lessons in packages/runtime.
// Falls back to srcdoc if the runtime IIFE is missing or rejects the package.

"use strict";

var CASUYA_RUNTIME_SRC = "/static/pkg/runtime/casuya-runtime.min.js";
var _casuyaRuntimeByEl = typeof WeakMap === "function" ? new WeakMap() : null;

function loadCasuyaRuntime() {
  if (window.CasuyaRuntime && window.CasuyaRuntime.Runtime) return Promise.resolve(true);
  var loader = typeof loadCasuyaScript === "function" ? loadCasuyaScript : null;
  if (!loader) return Promise.resolve(false);
  var src = typeof casuyaAssetUrl === "function" ? casuyaAssetUrl(CASUYA_RUNTIME_SRC) : CASUYA_RUNTIME_SRC;
  return loader(src).then(function () {
    return !!(window.CasuyaRuntime && window.CasuyaRuntime.Runtime);
  }).catch(function () { return false; });
}

function htmlToRuntimePackage(html, id, title, type, permissions) {
  var safeId = String(id || type || "content").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "content";
  var bytes = new TextEncoder().encode(html);
  return {
    manifest: {
      id: safeId,
      version: "1.0.0",
      title: String(title || type || "Content").slice(0, 200),
      type: type || "game",
      permissions: permissions || ["game", "storage", "canvas"],
      entry: "index.html",
    },
    resources: { "index.html": bytes },
  };
}

function prepareContentHtml(html, injectBridge) {
  var out = html || "";
  if (injectBridge && typeof injectBridgeScript === "function") out = injectBridgeScript(out);
  if (typeof injectNodeBase === "function") out = injectNodeBase(out);
  return out;
}

function runtimeIframe(container, rt) {
  try {
    if (rt && rt.renderer && typeof rt.renderer.getIframe === "function") {
      var inner = rt.renderer.getIframe();
      if (inner) return inner;
    }
  } catch (e) {}
  return container ? container.querySelector("iframe") : null;
}

function fitRuntimeIframe(container, iframe) {
  if (!iframe) return;
  var heightSet = false;
  var setHeight = function () {
    if (heightSet) return;
    try {
      var doc = iframe.contentWindow && iframe.contentWindow.document;
      if (doc) {
        var h = Math.max(
          (doc.documentElement && doc.documentElement.scrollHeight) || 0,
          (doc.body && doc.body.scrollHeight) || 0,
          300
        );
        iframe.style.height = h + "px";
        if (container) {
          container.style.height = h + "px";
          container.style.overflow = "visible";
        }
        heightSet = true;
      }
    } catch (e) {}
  };
  iframe.addEventListener("load", setHeight);
  var poll = setInterval(function () { setHeight(); if (heightSet) clearInterval(poll); }, 300);
  setTimeout(function () { clearInterval(poll); if (!heightSet) iframe.style.height = "600px"; }, 8000);
}

function mountGameSrcdoc(container, html) {
  if (!container) return { cleanup: function () {}, getIframe: function () { return null; } };
  var iframe = document.createElement("iframe");
  iframe.className = "lesson-iframe-inner";
  iframe.style.cssText = "width:100%;border:none;display:block;min-height:300px";
  container.innerHTML = "";
  container.appendChild(iframe);
  iframe.srcdoc = html;
  fitRuntimeIframe(container, iframe);
  return {
    cleanup: function () { try { container.innerHTML = ""; } catch (e) {} },
    getIframe: function () { return iframe; },
  };
}

async function destroyRuntimeOn(container) {
  if (!_casuyaRuntimeByEl || !container) return;
  var prev = _casuyaRuntimeByEl.get(container);
  if (prev && typeof prev.destroy === "function") {
    try { await prev.destroy(); } catch (e) {}
    _casuyaRuntimeByEl.delete(container);
  }
}

async function mountContentRuntime(container, html, meta) {
  var type = (meta && meta.type) || "game";
  var permissions = (meta && meta.permissions) || (
    type === "lesson"
      ? ["storage", "media", "quiz", "timer", "video", "audio"]
      : ["game", "storage", "canvas", "media"]
  );
  var injectBridge = !!(meta && meta.injectBridge);
  var prepared = prepareContentHtml(html, injectBridge);
  await destroyRuntimeOn(container);
  var empty = { cleanup: function () {}, getIframe: function () { return container ? container.querySelector("iframe") : null; } };
  if (!container || !prepared) {
    return empty;
  }
  var ok = await loadCasuyaRuntime();
  if (!ok) {
    return mountGameSrcdoc(container, prepared);
  }
  container.style.minHeight = "300px";
  container.style.width = "100%";
  if (!container.style.height) container.style.height = type === "lesson" ? "auto" : "600px";
  var Runtime = window.CasuyaRuntime.Runtime;
  // Lessons omit allow-same-origin so srcdoc stays isolated from the parent
  // CSP; the bridge uses postMessage only.
  var sandbox = type === "lesson"
    ? "allow-scripts allow-forms"
    : "allow-scripts allow-same-origin";
  var rt = new Runtime({
    container: container,
    permissions: permissions,
    renderer: {
      iframeAttributes: { sandbox: sandbox, loading: "eager" },
    },
  });
  if (_casuyaRuntimeByEl) _casuyaRuntimeByEl.set(container, rt);
  try {
    await rt.load(htmlToRuntimePackage(prepared, meta && meta.id, meta && meta.title, type, permissions));
    await rt.start();
    var iframe = runtimeIframe(container, rt);
    fitRuntimeIframe(container, iframe);
    return {
      cleanup: function () {
        rt.destroy();
        if (_casuyaRuntimeByEl && _casuyaRuntimeByEl.get(container) === rt) {
          _casuyaRuntimeByEl.delete(container);
        }
      },
      getIframe: function () { return runtimeIframe(container, rt); },
    };
  } catch (e) {
    try { await rt.destroy(); } catch (e2) {}
    if (_casuyaRuntimeByEl && _casuyaRuntimeByEl.get(container) === rt) {
      _casuyaRuntimeByEl.delete(container);
    }
    return mountGameSrcdoc(container, prepared);
  }
}

async function mountGameRuntime(container, html, meta) {
  var handle = await mountContentRuntime(container, html, {
    id: meta && meta.id,
    title: meta && meta.title,
    type: "game",
    permissions: ["game", "storage", "canvas", "media"],
    injectBridge: false,
  });
  return handle && handle.cleanup ? handle.cleanup : function () {};
}

async function mountLessonRuntime(container, html, meta) {
  return mountContentRuntime(container, html, {
    id: meta && meta.id,
    title: meta && meta.title,
    type: "lesson",
    permissions: ["storage", "media", "quiz", "timer", "video", "audio"],
    injectBridge: true,
  });
}
