// modules/api-client/core/dom.js — DOM render/escape helpers (shared global scope)

let _globalAbort = null;

function render(container, html) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) return;
  if (_globalAbort) {
    const old = _globalAbort;
    Promise.resolve().then(() => old.abort());
  }
  _globalAbort = new AbortController();
  el.innerHTML = html;
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

// Inject <base href> into pasted/uploaded HTML before it is shown through
// iframe.srcdoc so absolute asset paths (/static/lib/...) and relative links
// resolve against the backend origin regardless of where the frontend is
// served from or how the document is written (head present or not).
function injectNodeBase(html) {
  if (!html) return html;
  const base = API_BASE + "/";
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    return html.slice(0, headMatch.index + headMatch[0].length)
      + `<base href="${base}">`
      + html.slice(headMatch.index + headMatch[0].length);
  }
  const htmlMatch = /<html[^>]*>/i.exec(html);
  if (htmlMatch) {
    return html.slice(0, htmlMatch.index + htmlMatch[0].length)
      + `<head><base href="${base}"></head>`
      + html.slice(htmlMatch.index + htmlMatch[0].length);
  }
  const doctypeMatch = /^\s*<!DOCTYPE html[^>]*>/i.exec(html);
  if (doctypeMatch) {
    return html.slice(0, doctypeMatch[0].length)
      + `<head><base href="${base}"></head>`
      + html.slice(doctypeMatch[0].length);
  }
  return `<head><base href="${base}"></head>` + html;
}
window.injectNodeBase = injectNodeBase;

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(timestamp).toLocaleDateString();
}