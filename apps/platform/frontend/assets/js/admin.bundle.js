// casuya-env.js — environment-aware API URL resolution.
//
// In production (Vercel / custom domain) we point the frontend at the Render
// backend. On localhost we intentionally leave CASUYA_API_URL UNSET so that
// config.js falls back to the local API (http://localhost:8765), keeping
// local development fully local and free of production coupling.
(function () {
  var host = window.location.hostname || "";
  var isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1";
  if (!isLocal) {
    window.CASUYA_API_URL = "https://casuya-platform-production.up.railway.app";
  }
})();

;
(function () {
  // casuya-config.js — central API base resolution for the static frontend.
  //
  // In production, point the frontend at your Render backend by setting the
  // global CASUYA_API_URL (e.g. https://casuya-platform-production.up.railway.app) in a small
  // inline <script> that runs BEFORE this file, or via Vercel env substitution.
  //
  // In development it targets the local API on port 8765 (same-origin when the
  // frontend is served from the API host).

  function resolveBase() {
    if (window.CASUYA_API_URL) {
      return String(window.CASUYA_API_URL).replace(/\/+$/, "");
    }
    var hostname = window.location.hostname || "localhost";
    var protocol = (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? window.location.protocol
      : "http:";
    var port = window.location.port;
    var isSameOrigin = port === "8765" || port === "" || port === "443" || port === "80";
    return isSameOrigin ? window.location.origin : protocol + "//" + hostname + ":8765";
  }

  window.casuyaApiBase = function () {
    return resolveBase();
  };

  window.casuyaOAuthUrl = function (provider) {
    return resolveBase() + "/auth/oauth/" + encodeURIComponent(provider);
  };

  // Register the offline/performance service worker ONLY after auth is established.
  // On the login/register pages (no token), skip SW registration to avoid caching
  // auth-critical requests before the session is established.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      var path = window.location.pathname;
      var isAuthPage = /\/(?:login|register|forgot-password|reset-password|index)\.html?$/.test(path) || path === "/";
      var hasToken = !!localStorage.getItem("casuya_token");

      // Register SW only on authenticated portal pages (student/teacher/admin)
      // OR on public pages where the user already has a token
      if (!isAuthPage || hasToken) {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
      }
    });
  }
})();

;
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

;
// modules/api-auth.js — Token management, auth headers, decode JWT

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

let _refreshPromise = null;

function tokenNeedsRefresh(token, skewSeconds = 60) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp !== "number") return false;
    return Date.now() >= payload.exp * 1000 - skewSeconds * 1000;
  } catch {
    return false;
  }
}

async function refreshAuthToken() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function _doRefresh() {
  const refreshToken = localStorage.getItem("casuya_refresh_token");
  if (!refreshToken) throw new Error("No refresh token");
  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) throw new Error("Refresh failed");
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid response from refresh endpoint");
  }
  if (data.access_token) localStorage.setItem("casuya_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("casuya_refresh_token", data.refresh_token);
  return data.access_token;
}

;
// modules/api-client/core/host.js — API host/protocol/base constants

const API_HOST = window.location.hostname || "localhost";

const API_PROTOCOL = (window.location.protocol === "http:" || window.location.protocol === "https:")
  ? window.location.protocol
  : "http:";

const API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
  : (window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
    ? window.location.origin
    : `${API_PROTOCOL}//${API_HOST}:8765`;

// Expose on window so ES modules (auth-guard.js loaded via <script type="module">)
// can also reach these when they import functions from auth-client.js.
window.API_HOST = API_HOST;
window.API_PROTOCOL = API_PROTOCOL;
window.API_BASE = API_BASE;
;
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
;
// modules/api-client/core/errors.js — toast/confirm/delete helpers (shared global scope)

function showToast(msg) {
  let t = document.getElementById("global-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "global-toast";
    t.style.cssText = "position:fixed;bottom:1.5rem;right:1.5rem;padding:0.6rem 1.2rem;background:var(--color-success);color:#fff;border-radius:var(--radius);font-size:0.85rem;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._hide);
  t._hide = setTimeout(() => { t.style.opacity = "0"; }, 2500);
}

function confirmDelete(label) {
  return confirm(`Delete "${label}"? This cannot be undone.`);
}

function deleteBtn(id, label, endpoint, onDone) {
  return `<button class="btn btn-danger btn-sm" data-delete="${id}" data-label="${escapeHtml(label)}" data-endpoint="${endpoint}">Delete</button>`;
}

function initDeleteButtons() {
  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      const label = btn.dataset.label;
      const endpoint = btn.dataset.endpoint;
      if (!confirmDelete(label)) return;
      try {
        await request(`${endpoint}/${id}`, { method: "DELETE" });
        showToast("Deleted!");
        btn.closest(".card")?.remove();
      } catch(err) { showToast(err.message || "Delete failed"); }
    });
  });
}
;
// modules/api-client/core/markdown.js — tutoring markdown renderer (shared global scope)

function renderTutorMarkdown(raw) {
  if (!raw) return "";
  let text = raw;

  text = text.replace(/ thinking[\s\S]*?<\/think>/gi, "").trim();

  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<div class="tutor-code-block"><pre><code>${escapeHtml(code.trimEnd())}</code></pre></div>`;
  });

  text = text.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm, (_, headerRow, _sep, bodyRows) => {
    const headers = headerRow.split("|").filter(c => c.trim());
    const rows = bodyRows.trim().split("\n").map(r => r.split("|").filter(c => c.trim()));
    let html = "<table>";
    html += "<thead><tr>" + headers.map(h => `<th>${escapeHtml(h.trim())}</th>`).join("") + "</tr></thead>";
    html += "<tbody>" + rows.map(r =>
      "<tr>" + r.map((c, i) => `<td data-label="${escapeHtml(headers[i] || "")}">${escapeHtml(c.trim())}</td>`).join("") + "</tr>"
    ).join("") + "</tbody></table>";
    return html;
  });

  text = text.replace(/^(.*💡\s*(?:NECTA\s+(?:Examination\s+)?Tip|Mtihani).*)\n((?:(?!\*\*\*).+\n?)*)/gim, (_, tipLine, body) => {
    const cleanBody = escapeHtml(body.trim()).replace(/\n/g, "<br>");
    return `<div class="tutor-necta-tip"><div class="tutor-necta-tip-label">💡 NECTA Examination Tip</div><p>${cleanBody}</p></div>`;
  });

  text = text.replace(/^>\s*(.+)$/gm, (_, content) => {
    const isLocal = /tanzan|serengeti|kilimanjaro|lake victoria|dodoma|dar|kenya|uganda|east africa|africa|mwanza|arusha|mbeya|ruaha|rufiji/i.test(content);
    const badge = isLocal ? "🌍 Tanzania Context" : "📖 Context";
    return `<div class="tutor-context-blockquote"><div class="tutor-context-badge">${badge}</div><p>${escapeHtml(content)}</p></div>`;
  });
  text = text.replace(/(<div class="tutor-context-blockquote">[\s\S]*?<\/div>\n?)+/g, (match) => {
    return match;
  });

  text = text.replace(
    /(\*\*Review Question[^*]*\*\*[^\n]*)\n([\s\S]*?)(?=\n\n(?!\*)|$)/gi,
    (_, titleLine, body) => {
      const rawBody = body.trim();
      const markingSplit = rawBody.split(/\n(?=\*?\*?(?:Model Answer|Marking Scheme|Jibu))/i);
      const preview = markingSplit[0] || "";
      const marking = markingSplit.slice(1).join("\n").trim();
      let html = `<div class="tutor-review-card"><div class="tutor-review-title">${escapeHtml(titleLine.trim())}</div>`;
      if (preview) {
        html += `<div class="tutor-review-body">${escapeHtml(preview).replace(/\n/g, "<br>")}</div>`;
      }
      if (marking) {
        html += `<button type="button" class="tutor-marking-toggle">Show Marking Scheme</button>`;
        html += `<div class="tutor-marking-scheme" hidden>${escapeHtml(marking).replace(/\n/g, "<br>")}</div>`;
      }
      html += "</div>";
      return html;
    }
  );

  text = text.replace(/^\*\*\*\s*$/gm, "<hr>");

  text = text.replace(/^#### (.+)$/gm, (_, t) => `<h4>${escapeHtml(t)}</h4>`);
  text = text.replace(/^### (.+)$/gm, (_, t) => `<h3>${escapeHtml(t)}</h3>`);
  text = text.replace(/^## (.+)$/gm, (_, t) => `<h2>${escapeHtml(t)}</h2>`);
  text = text.replace(/^# (.+)$/gm, (_, t) => `<h1>${escapeHtml(t)}</h1>`);

  text = text.replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => `<strong><em>${escapeHtml(t)}</em></strong>`);
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
  text = text.replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`);

  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);

  text = text.replace(/^(?:- (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${escapeHtml(l.replace(/^- /, ""))}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  text = text.replace(/^(?:\d+\. (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${escapeHtml(l.replace(/^\d+\. /, ""))}</li>`).join("");
    return `<ol>${items}</ol>`;
  });

  text = text.replace(/\n{2,}/g, "\n\n");
  const paragraphs = text.split("\n\n");
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    if (/^<(div|table|ul|ol|h[1-6]|hr|pre)/.test(p)) return p;
    return `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return text;
}
;
// modules/api-client/core/quiz.js — quiz questions renderer (shared global scope)

function renderQuizQuestions(questions, meta = {}) {
  if (!Array.isArray(questions) || !questions.length) {
    return '<p style="color:var(--color-text-muted)">No questions generated.</p>';
  }
  const subject = meta.subject || "General";
  const formLevel = meta.formLevel || "";
  const topic = meta.topic || "";
  const subjectLabels = { mathematics:"Mathematics", chemistry:"Chemistry", physics:"Physics" };
  const subjectLabel = subjectLabels[subject] || subject;
  const formLabel = formLevel ? `Form ${["I","II","III","IV","V","VI"][Number(formLevel)-1] || formLevel}` : "";
  const badgeParts = [subjectLabel, formLabel].filter(Boolean).join(" \u2022 ");
  const quizId = "quiz-" + Date.now();

  const lessonAttr = meta.lessonId ? ` data-lesson-id="${escapeHtml(meta.lessonId)}"` : "";
  let html = `<div class="quiz-container" id="${quizId}"${lessonAttr}>`;

  html += `<div class="quiz-header">
    <span class="quiz-badge">${escapeHtml(badgeParts)}</span>
    <span class="quiz-counter">Question 1 of ${questions.length}</span>
    ${topic ? `<div class="quiz-topic">Topic: ${escapeHtml(topic)}</div>` : ""}
  </div>`;

  html += '<div class="quiz-card">';
  questions.forEach((q, i) => {
    const letters = ["A","B","C","D"];
    const options = q.options || [];
    const correctAnswer = (q.correctAnswer || "").trim().toUpperCase();
    const explanation = q.explanation || "";

    html += `<div class="quiz-question" data-index="${i}" data-correct="${escapeHtml(correctAnswer)}">`;
    html += `<div class="quiz-question-num">Question ${i+1}</div>`;
    html += `<div class="quiz-question-text">${escapeHtml(q.text || "")}</div>`;
    html += `<button type="button" class="casuya-listen" data-lang="auto" data-speak="${escapeHtml(String(q.text || "").slice(0, 600))}" title="Listen to question" aria-label="Listen to question">🔊 Listen</button>`;
    html += '<div class="quiz-options">';
    options.forEach((opt, j) => {
      const letter = letters[j] || String.fromCharCode(65+j);
      const optText = typeof opt === "string" ? opt : (opt.text || String(opt));
      html += `<label class="quiz-option" data-letter="${letter}">
        <input type="radio" name="${quizId}-q${i}" value="${letter}">
        <span class="quiz-option-label">${letter}.</span>
        <span>${escapeHtml(optText)}</span>
      </label>`;
    });
    html += '</div>';

    if (explanation) {
      html += `<div class="quiz-explanation" id="${quizId}-exp-${i}">
        <strong>Explanation:</strong> ${escapeHtml(explanation)}
      </div>`;
    }
    html += '</div>';
  });

  html += `<div class="quiz-btn-row">
    <button class="btn btn-primary quiz-submit-all" onclick="window._quizSubmit('${quizId}', ${questions.length})">Submit Answers</button>
    <button class="btn quiz-download-btn" onclick="window._quizDownloadWord('${quizId}')">📄 Word</button>
    <button class="btn quiz-download-btn" onclick="window._quizDownloadPdf('${quizId}')">📋 PDF</button>
  </div>`;

  html += `<div class="quiz-score" id="${quizId}-score">
    <div class="quiz-score-num" id="${quizId}-score-num"></div>
    <div class="quiz-score-label" id="${quizId}-score-label"></div>
  </div>`;

  html += '</div></div>';
  return html;
}
;
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
;
// modules/api-client/core/fetch.js — request + SSE streaming helpers (shared global scope)

function asProgressItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/* ── Request Function ──────────────────────────────────────────────────── */
async function request(path, options = {}) {
  const cached = typeof getCachedRequest === "function" ? getCachedRequest(path, options) : null;
  if (cached !== null && cached !== undefined) return cached;

  const pending = typeof getInFlightRequest === "function" ? getInFlightRequest(path, options) : null;
  if (pending) return pending;

  let token = localStorage.getItem("casuya_token");

  if (token && !options._retry && typeof tokenNeedsRefresh === "function" && tokenNeedsRefresh(token) && localStorage.getItem("casuya_refresh_token")) {
    try {
      token = await refreshAuthToken();
    } catch (err) {
      localStorage.removeItem("casuya_token");
      localStorage.removeItem("casuya_refresh_token");
      window.location.replace("/login.html");
      throw err;
    }
  }

  const method = (options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;

  const url = API_BASE + path;
  const fetchOptions = { method, headers };
  if (options.body) fetchOptions.body = options.body;

  const run = (async () => {
    let response = await fetch(url, fetchOptions);

    if (!response.ok) {
      if (response.status === 401 && !options._retry) {
        if (typeof refreshAuthToken === "function" && localStorage.getItem("casuya_refresh_token")) {
          try {
            await refreshAuthToken();
            options._retry = true;
            return await request(path, options);
          } catch (err) {
            localStorage.removeItem("casuya_token");
            window.location.replace("/login.html");
            throw err;
          }
        } else {
          localStorage.removeItem("casuya_token");
          window.location.replace("/login.html");
        }
      }

      const error = new Error(response.statusText || "Request failed");
      error.status = response.status;
      try {
        const body = await response.json();
        if (body && typeof body.detail === "string" && body.detail) {
          error.message = body.detail;
        }
      } catch (e) {}
      throw error;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    if (typeof setCachedRequest === "function") setCachedRequest(path, options, parsed);
    return parsed;
  })();

  if (typeof setInFlightRequest === "function") setInFlightRequest(path, options, run);
  try {
    return await run;
  } finally {
    if (typeof clearInFlightRequest === "function") clearInFlightRequest(path, options);
  }
}

/* ── SSE Streaming Helper (P3-4) ─────────────────────────────────────── */
function streamTutorResponse(payload, onChunk, onDone, onError) {
  var token = localStorage.getItem("casuya_token");
  var headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  var controller = new AbortController();

  fetch(API_BASE + "/ai/tutoring/stream", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).then(function(resp) {
    if (!resp.ok) throw new Error("Stream failed");
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    function read() {
      reader.read().then(function(result) {
        if (result.done) {
          if (onDone) onDone();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith("data: ")) continue;
          try {
            var data = JSON.parse(line.substring(6));
            if (data.chunk) onChunk(data.chunk);
            if (data.done) { if (onDone) onDone(data); return; }
          } catch (e) {}
        }
        read();
      }).catch(function(err) {
        if (err.name !== "AbortError" && onError) onError(err);
      });
    }
    read();
  }).catch(function(err) {
    if (err.name !== "AbortError" && onError) onError(err);
  });

  return controller;
}

function streamTranslateResponse(payload, onChunk, onDone, onError) {
  var token = localStorage.getItem("casuya_token");
  var headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  fetch(API_BASE + "/ai/content/translate/stream", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  }).then(function(resp) {
    if (!resp.ok) throw new Error("Stream failed");
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    function read() {
      reader.read().then(function(result) {
        if (result.done) {
          if (onDone) onDone();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith("data: ")) continue;
          try {
            var data = JSON.parse(line.substring(6));
            if (data.chunk) onChunk(data.chunk);
            if (data.done) { if (onDone) onDone(data); return; }
          } catch (e) {}
        }
        read();
      }).catch(function(err) {
        if (onError) onError(err);
      });
    }
    read();
  }).catch(function(err) {
    if (onError) onError(err);
  });
}
;
// ai-source-badge.js — show whether a response came from casuya-ai or offline fallback.

function renderAiSourceBadge(source) {
  if (!source) return "";
  var label = source === "casuya-ai"
    ? "Powered by AI"
    : (source === "local-cache"
      ? "Saved on device"
      : (source === "cached"
        ? "Cached answer"
        : (source === "kb-fallback" ? "Syllabus notes (offline)" : "Offline mode")));
  var tone = source === "casuya-ai" ? "var(--color-primary, #2563eb)" : "var(--color-text-muted, #64748b)";
  return (
    '<span class="ai-source-badge" style="display:inline-block;margin-top:0.5rem;font-size:0.75rem;' +
    "color:" + tone + ';font-weight:600;" title="Response source: ' + escapeHtml(String(source)) + '">' +
    escapeHtml(label) +
    "</span>"
  );
}

;
// modules/ai/tutor-qa-idb.js — client-side tutor Q&A cache (Phase 3C, last 20).

var _tutorQaIdb = null;
var TUTOR_QA_IDB_NAME = "casuya-tutor-qa";
var TUTOR_QA_STORE = "answers";
var TUTOR_QUEUE_STORE = "queue";
var TUTOR_QA_MAX = 20;
var TUTOR_QA_IDB_VERSION = 2;

function tutorQaCacheKey(payload) {
  var parts = [
    String((payload && payload.question) || "").trim().toLowerCase(),
    String((payload && payload.lesson_id) || ""),
    String((payload && payload.subject_slug) || ""),
    String((payload && payload.form_level) || ""),
  ];
  return parts.join("|");
}

function openTutorQaIdb() {
  if (_tutorQaIdb) return _tutorQaIdb;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  _tutorQaIdb = new Promise(function (resolve) {
    try {
      var req = indexedDB.open(TUTOR_QA_IDB_NAME, TUTOR_QA_IDB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(TUTOR_QA_STORE)) {
          db.createObjectStore(TUTOR_QA_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) {
          db.createObjectStore(TUTOR_QUEUE_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    } catch (e) {
      resolve(null);
    }
  });
  return _tutorQaIdb;
}

function getTutorQaCache(key) {
  if (!key) return Promise.resolve(null);
  return openTutorQaIdb().then(function (db) {
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QA_STORE, "readonly");
        var req = tx.objectStore(TUTOR_QA_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function putTutorQaCache(key, row) {
  if (!key || !row || !row.response) return Promise.resolve();
  return openTutorQaIdb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QA_STORE, "readwrite");
        var store = tx.objectStore(TUTOR_QA_STORE);
        store.put({
          id: key,
          response: row.response,
          kbHits: row.kbHits || [],
          formatComplete: !!row.formatComplete,
          formatLevel: row.formatLevel || "none",
          source: row.source || "casuya-ai",
          ts: Date.now(),
        });
        store.getAll().onsuccess = function (ev) {
          var rows = ev.target.result || [];
          if (rows.length <= TUTOR_QA_MAX) return;
          rows.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
          var extra = rows.length - TUTOR_QA_MAX;
          for (var i = 0; i < extra; i++) {
            store.delete(rows[i].id);
          }
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

window.tutorQaCacheKey = tutorQaCacheKey;
window.getTutorQaCache = getTutorQaCache;
window.putTutorQaCache = putTutorQaCache;

;
// modules/ai/tutor-qa-queue.js — offline tutor question queue (Phase 4).

var TUTOR_QUEUE_STORE = "queue";
var _tutorQueueSyncing = false;

function openTutorQueueDb() {
  return typeof openTutorQaIdb === "function" ? openTutorQaIdb() : Promise.resolve(null);
}

function enqueueTutorQuestion(payload, callbacks) {
  callbacks = callbacks || {};
  return openTutorQueueDb().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction([TUTOR_QUEUE_STORE, "answers"], "readwrite");
        var store = tx.objectStore(TUTOR_QUEUE_STORE);
        if (!db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) {
          resolve(false);
          return;
        }
        var row = {
          id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          payload: payload,
          callbacksMeta: {
            loadingLabel: callbacks.loadingLabel || "",
          },
          ts: Date.now(),
          attempts: 0,
        };
        store.put(row);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (e) {
        resolve(false);
      }
    });
  });
}

function listTutorQueue() {
  return openTutorQueueDb().then(function (db) {
    if (!db || !db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) return [];
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QUEUE_STORE, "readonly");
        var req = tx.objectStore(TUTOR_QUEUE_STORE).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          rows.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
          resolve(rows);
        };
        req.onerror = function () { resolve([]); };
      } catch (e) {
        resolve([]);
      }
    });
  });
}

function removeTutorQueueItem(id) {
  return openTutorQueueDb().then(function (db) {
    if (!db || !db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QUEUE_STORE, "readwrite");
        tx.objectStore(TUTOR_QUEUE_STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

function syncTutorQueue() {
  if (_tutorQueueSyncing || typeof navigator !== "undefined" && !navigator.onLine) {
    return Promise.resolve(0);
  }
  if (typeof runTutorQuery !== "function") return Promise.resolve(0);
  _tutorQueueSyncing = true;
  return listTutorQueue().then(function (rows) {
    if (!rows.length) {
      _tutorQueueSyncing = false;
      return 0;
    }
    var chain = Promise.resolve(0);
    rows.forEach(function (row) {
      chain = chain.then(function (count) {
        return new Promise(function (resolve) {
          var container = document.createElement("div");
          container.hidden = true;
          document.body.appendChild(container);
          runTutorQuery(row.payload, {
            container: container,
            loadingLabel: (row.callbacksMeta && row.callbacksMeta.loadingLabel) || "Syncing…",
            onComplete: function () {
              removeTutorQueueItem(row.id).finally(function () {
                container.remove();
                resolve(count + 1);
              });
            },
            onError: function () {
              container.remove();
              resolve(count);
            },
          });
        });
      });
    });
    return chain.finally(function () {
      _tutorQueueSyncing = false;
    });
  }).catch(function () {
    _tutorQueueSyncing = false;
    return 0;
  });
}

if (typeof window !== "undefined") {
  window.enqueueTutorQuestion = enqueueTutorQuestion;
  window.syncTutorQueue = syncTutorQueue;
  window.addEventListener("online", function () {
    syncTutorQueue();
  });
}

;
// modules/ai/tutor-panel.js — shared AI tutor streaming, markdown render, source chips.

function renderTutorThinking(label) {
  var text = label || "Thinking...";
  return (
    '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>'
    + escapeHtml(text) + "</div>"
  );
}

function renderTutorStreamingSkeleton() {
  return (
    '<div class="tutor-streaming-skeleton" aria-hidden="true">'
    + '<div class="tutor-skeleton-line tutor-skeleton-line-lg"></div>'
    + '<div class="tutor-skeleton-line"></div>'
    + '<div class="tutor-skeleton-line tutor-skeleton-line-sm"></div>'
    + '<div class="tutor-skeleton-block"></div>'
    + "</div>"
  );
}

function renderTutorFollowUpChips() {
  var chips = [
    { label: "Eleza kwa urahisi", prompt: "Eleza kwa Kiswahili rahisi zaidi." },
    { label: "NECTA huuliza vipi?", prompt: "NECTA huuliza vipi kuhusu hili?" },
    { label: "Toa mfano", prompt: "Toa mfano wa Tanzania." },
    { label: "Explain simpler", prompt: "Explain this in simpler English." },
  ];
  return (
    '<div class="tutor-followup-chips">'
    + chips.map(function (c) {
      return (
        '<button type="button" class="tutor-followup-chip" data-followup="'
        + escapeHtml(c.prompt) + '">' + escapeHtml(c.label) + "</button>"
      );
    }).join("")
    + "</div>"
  );
}

function attachTutorFollowUp(container, askFn) {
  if (!container || typeof askFn !== "function") return;
  var wrap = document.createElement("div");
  wrap.className = "tutor-followup-wrap";
  wrap.innerHTML = renderTutorFollowUpChips();
  wrap.addEventListener("click", function (e) {
    var chip = e.target && e.target.closest && e.target.closest("[data-followup]");
    if (!chip) return;
    askFn(chip.getAttribute("data-followup") || "");
  });
  container.appendChild(wrap);
}

function renderTutorHelpfulRating() {
  return (
    '<div class="tutor-helpful" data-tutor-helpful>'
    + '<span class="tutor-helpful-label">Was this helpful?</span>'
    + '<button type="button" class="tutor-helpful-btn" data-helpful="yes" aria-label="Helpful">👍</button>'
    + '<button type="button" class="tutor-helpful-btn" data-helpful="no" aria-label="Not helpful">👎</button>'
    + '<span class="tutor-helpful-thanks" hidden>Asante — feedback saved.</span>'
    + "</div>"
  );
}

function attachTutorHelpful(container, meta) {
  if (!container) return;
  var wrap = document.createElement("div");
  wrap.innerHTML = renderTutorHelpfulRating();
  var root = wrap.firstElementChild;
  if (!root) return;
  root.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-helpful]");
    if (!btn || root.dataset.answered) return;
    root.dataset.answered = "1";
    try {
      var key = "casuya_ai_feedback";
      var log = JSON.parse(sessionStorage.getItem(key) || "[]");
      log.push({
        helpful: btn.getAttribute("data-helpful") === "yes",
        source: (meta && meta.source) || "unknown",
        at: Date.now(),
      });
      sessionStorage.setItem(key, JSON.stringify(log.slice(-50)));
    } catch (err) {}
    root.querySelectorAll(".tutor-helpful-btn").forEach(function (b) { b.disabled = true; });
    var thanks = root.querySelector(".tutor-helpful-thanks");
    if (thanks) thanks.hidden = false;
  });
  container.appendChild(root);
}

function buildTutorMessagesArray(priorMessages) {
  return (priorMessages || []).slice(-8).map(function (m) {
    return {
      role: m.role === "user" ? "user" : "tutor",
      text: String(m.text || "").trim(),
    };
  }).filter(function (m) { return m.text; });
}

function tutorHitLabel(hit) {
  if (!hit) return "Reference";
  if (hit.title) return String(hit.title);
  if (hit.code) return String(hit.code);
  if (hit.kind) return String(hit.kind);
  return "Reference";
}

function renderTutorSourceChips(kbHits) {
  if (!kbHits || !kbHits.length) return "";
  var chips = kbHits.slice(0, 4).map(function (hit) {
    var title = tutorHitLabel(hit);
    var kind = String(hit.kind || hit.doc_type || "");
    var icon = /exam|necta|marking/i.test(kind + title) ? "📄" : "📘";
    return (
      '<span class="tutor-source-chip" title="' + escapeHtml(title) + '">'
      + icon + " " + escapeHtml(title.slice(0, 56)) + "</span>"
    );
  }).join("");
  return '<div class="tutor-source-chips">' + chips + "</div>";
}

function scoreNectaFormat(text) {
  text = String(text || "");
  var hasContext = /🌍|Context|Muktadha/i.test(text);
  var hasNecta = /NECTA|Exam(?:ination)? Tip|Kidokezo cha NECTA|uchaguzi/i.test(text);
  var hasStructure = /^#{1,3}\s|^\*\*|^>\s/m.test(text);
  var score = (hasContext ? 1 : 0) + (hasNecta ? 1 : 0) + (hasStructure ? 1 : 0);
  if (score >= 2) return "complete";
  if (score >= 1) return "partial";
  return "none";
}

function renderFormatQualityChip(text) {
  var level = scoreNectaFormat(text);
  if (level === "complete") {
    return (
      '<span class="tutor-format-chip tutor-format-complete" title="Answer follows NECTA tutor format">'
      + "✓ Exam-ready format</span>"
    );
  }
  if (level === "partial") {
    return (
      '<span class="tutor-format-chip tutor-format-partial" title="Partial NECTA structure">'
      + "~ Partial format</span>"
    );
  }
  return "";
}

function renderTutorFooter(result, responseText) {
  result = result || {};
  var formatChip = responseText ? renderFormatQualityChip(responseText) : "";
  return renderTutorSourceChips(result.kbHits)
    + formatChip
    + renderAiSourceBadge(result.source);
}

function buildTutorThreadQuestion(priorMessages, latestQuestion) {
  latestQuestion = String(latestQuestion || "").trim();
  var turns = [];
  (priorMessages || []).forEach(function (m) {
    if (m.role === "user" && m.text) {
      turns.push({ q: m.text, a: "" });
    } else if (m.role === "tutor" && m.text && turns.length) {
      turns[turns.length - 1].a = String(m.text).slice(0, 600);
    }
  });
  turns = turns.slice(-4);
  if (!turns.length) return latestQuestion;
  var block = turns.map(function (t, idx) {
    return (
      "PREVIOUS Q" + (idx + 1) + ": " + t.q
      + (t.a ? "\nPREVIOUS A" + (idx + 1) + ": " + t.a : "")
    );
  }).join("\n\n");
  return (
    block
    + "\n\nFOLLOW-UP QUESTION:\n"
    + latestQuestion
    + "\n\n[Continue the tutoring conversation. Reference prior answers when helpful.]"
  );
}

function attachTutorListen(slotOrContainer, opts) {
  opts = opts || {};
  if (!slotOrContainer) return;
  function attach() {
    if (typeof casuyaAttachListen !== "function") return;
    var slot = typeof slotOrContainer === "string"
      ? document.querySelector(slotOrContainer)
      : slotOrContainer;
    if (!slot) return;
    casuyaAttachListen(slot, {
      title: opts.title || "Listen",
      textProvider: opts.textProvider || function () { return ""; },
    });
  }
  if (typeof ensureSpeechBundle === "function") {
    ensureSpeechBundle().then(attach).catch(function () {});
  } else {
    attach();
  }
}

function runAiGenerateTask(opts) {
  opts = opts || {};
  var container = opts.container;
  if (!container) return Promise.reject(new Error("no container"));
  container.innerHTML = renderTutorThinking(opts.loadingLabel || "Working...");
  return request(opts.path, {
    method: "POST",
    body: JSON.stringify(opts.body || {}),
  }).then(function (result) {
    var html = typeof opts.render === "function" ? opts.render(result) : "";
    var footer = "";
    if (!opts.skipAutoFooter && typeof renderAiResultFooter === "function") {
      footer = renderAiResultFooter(result);
    }
    container.innerHTML = html + (footer ? '<div class="tutor-response-footer">' + footer + "</div>" : "");
    scheduleTutorMath(container);
    if (opts.listenTitle) {
      var listenSlot = document.createElement("span");
      listenSlot.className = "casuya-ai-listen-slot";
      container.appendChild(listenSlot);
      attachTutorListen(listenSlot, {
        title: opts.listenTitle,
        textProvider: function () { return container.innerText; },
      });
    }
    if (typeof opts.onComplete === "function") opts.onComplete(result);
    return result;
  }).catch(function (err) {
    container.innerHTML = '<p style="color:var(--color-danger)">Error: '
      + escapeHtml(err.message || "Failed") + "</p>";
    if (typeof opts.onError === "function") opts.onError(err);
    throw err;
  });
}

function stripHtmlForContext(html, maxLen) {
  maxLen = maxLen || 2000;
  if (!html) return "";
  var text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen) + "…";
  return text;
}

function inferSubjectSlug(text) {
  var lower = String(text || "").toLowerCase();
  if (/chem|acid|molecule|element|compound|reaction|atom/.test(lower)) return "chemistry";
  if (/phys|force|energy|velocity|electric|wave|motion|newton/.test(lower)) return "physics";
  if (/math|equation|algebra|geometry|number|fraction|graph|calculus/.test(lower)) return "mathematics";
  return "";
}

function inferFormLevel(text) {
  var m = String(text || "").match(/form\s*([ivx]+|\d+)/i);
  if (!m) return null;
  var token = m[1].toUpperCase();
  var roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  if (roman[token]) return roman[token];
  var n = parseInt(token, 10);
  return n >= 1 && n <= 6 ? n : null;
}

function studentFormLevelNumber() {
  try {
    var raw = localStorage.getItem("casuya_form_filter") || "";
    if (!raw || raw === "all") {
      var dash = window.__casuyaStudentPayload;
      if (dash && dash.form_level) raw = dash.form_level;
    }
    return inferFormLevel(raw) || 2;
  } catch (e) {
    return 2;
  }
}

function tutorThreadStorageKey(ctx) {
  ctx = ctx || {};
  var lesson = ctx.lesson || {};
  var id = lesson.id || lesson.slug || ctx.lessonId || "lesson";
  return "casuya_ai_thread_" + String(id);
}

function loadTutorThread(key) {
  try {
    var raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTutorThread(key, messages) {
  var trimmed = (messages || []).slice(-8);
  try {
    sessionStorage.setItem(key, JSON.stringify(trimmed));
  } catch (e) {}
  var lessonId = String(key || "").replace("casuya_ai_thread_", "");
  if (lessonId && typeof request === "function") {
    request("/ai/tutor/thread/" + encodeURIComponent(lessonId), {
      method: "PUT",
      body: JSON.stringify({ messages: trimmed }),
    }).catch(function () {});
  }
}

function loadTutorThreadFromServer(lessonId, key, onLoaded) {
  if (!lessonId || typeof request !== "function") {
    if (typeof onLoaded === "function") onLoaded(loadTutorThread(key));
    return;
  }
  request("/ai/tutor/thread/" + encodeURIComponent(lessonId)).then(function (data) {
    var server = (data && data.messages) || [];
    var local = loadTutorThread(key);
    var merged = server.length >= local.length ? server : local;
    try {
      sessionStorage.setItem(key, JSON.stringify(merged.slice(-8)));
    } catch (e) {}
    if (typeof onLoaded === "function") onLoaded(merged);
  }).catch(function () {
    if (typeof onLoaded === "function") onLoaded(loadTutorThread(key));
  });
}

function buildQuizLessonContent(questions) {
  return (questions || []).map(function (q, idx) {
    var text = q.text || q.prompt || "";
    var opts = (q.options || []).map(function (o) {
      return (o.letter || "") + ") " + (o.text || "");
    }).join("; ");
    return "Q" + (idx + 1) + ": " + text + (opts ? " Options: " + opts : "");
  }).join("\n");
}

function finishTutorSurface(container, result, responseText, callbacks) {
  callbacks = callbacks || {};
  if (typeof callbacks.onComplete === "function") {
    callbacks.onComplete(result || {}, responseText || "");
  }
  if (callbacks.listenTitle || callbacks.listenSlot) {
    var slot = callbacks.listenSlot;
    if (!slot || !slot.parentNode) {
      slot = document.createElement("span");
      slot.className = "casuya-ai-listen-slot";
      if (container) container.appendChild(slot);
    }
    attachTutorListen(slot, {
      title: callbacks.listenTitle || "Listen",
      textProvider: function () { return container ? container.innerText : ""; },
    });
  }
}

function buildLessonTutorPayload(opts) {
  opts = opts || {};
  var question = String(opts.question || "").trim();
  var lesson = opts.lesson || {};
  var html = opts.lessonContent || "";
  var iframeText = opts.iframeText || "";
  var plain = stripHtmlForContext(html || iframeText, 2000);
  var title = lesson.title || "Lesson";
  var parts = ["Lesson: " + title];
  if (opts.subtopic) parts.push("Subtopic: " + opts.subtopic);
  if (opts.topic) parts.push("Topic: " + opts.topic);
  if (plain) parts.push("Content excerpt: " + plain);
  var lang = opts.language || localStorage.getItem("casuya_tutor_lang") || "both";
  if (lang === "sw") {
    question = "[Respond in Kiswahili using TIE syllabus terminology.]\n\n" + question;
  } else if (lang === "en") {
    question = "[Respond in English using TIE syllabus terminology.]\n\n" + question;
  }
  var subject = opts.subject_slug
    || inferSubjectSlug(title + " " + plain)
    || undefined;
  var form = opts.form_level
    || inferFormLevel(title + " " + (opts.subtopic || ""))
    || studentFormLevelNumber();
  if (opts.lessonId) parts.unshift("Lesson ID: " + opts.lessonId);
  var ctx = parts.join("\n");
  if (ctx.length > 4000) ctx = ctx.slice(0, 4000) + "…";
  return {
    question: question,
    lesson_context: ctx,
    lesson_id: opts.lessonId || lesson.id || undefined,
    subject_slug: subject,
    form_level: form,
    messages: opts.messages || undefined,
    language: lang,
    mode: opts.mode || undefined,
  };
}

function bindTutorMarkdownInteractions(container) {
  if (!container) return;
  container.querySelectorAll(".tutor-marking-toggle").forEach(function (btn) {
    if (btn._tutorBound) return;
    btn._tutorBound = true;
    btn.addEventListener("click", function () {
      var panel = btn.nextElementSibling;
      if (!panel) return;
      panel.hidden = !panel.hidden;
      btn.textContent = panel.hidden ? "Show Marking Scheme" : "Hide Marking Scheme";
    });
  });
}

function scheduleTutorMath(el) {
  if (!el || typeof window.renderMath !== "function") return;
  if (el._tutorMathTimer) clearTimeout(el._tutorMathTimer);
  el._tutorMathTimer = setTimeout(function () {
    window.renderMath(el);
  }, 180);
}

function runTutorQuery(payload, callbacks) {
  callbacks = callbacks || {};
  var container = callbacks.container;
  if (!container) return null;

  var accumulated = "";

  function renderPartial() {
    container.innerHTML = '<div class="tutor-response">' + renderTutorMarkdown(accumulated) + "</div>";
    bindTutorMarkdownInteractions(container);
    scheduleTutorMath(container);
  }

  function showResult(result, responseText) {
    container.innerHTML =
      '<div class="tutor-response">' + renderTutorMarkdown(responseText || "") + "</div>"
      + '<div class="tutor-response-footer">' + renderTutorFooter(result || {}, responseText || "") + "</div>";
    bindTutorMarkdownInteractions(container);
    scheduleTutorMath(container);
    finishTutorSurface(container, result, responseText, callbacks);
  }

  if (typeof window.ensureKaTeX === "function") {
    window.ensureKaTeX().catch(function () {});
  }

  container.innerHTML = renderTutorStreamingSkeleton()
    + renderTutorThinking(callbacks.loadingLabel || "Thinking...");

  function maybeCacheResult(meta, text) {
    if (typeof putTutorQaCache !== "function" || typeof tutorQaCacheKey !== "function") return;
    var src = meta && meta.source;
    if (src !== "casuya-ai" && src !== "cached") return;
    if (!text || !String(text).trim()) return;
    putTutorQaCache(tutorQaCacheKey(payload), {
      response: text,
      kbHits: (meta && meta.kbHits) || [],
      formatComplete: meta && meta.formatComplete,
      formatLevel: meta && meta.formatLevel,
      source: src,
    });
  }

  function startNetwork() {
    if (typeof streamTutorResponse !== "function") {
      return request("/ai/tutoring/explain", {
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (result) {
        var response = (result && result.response) ? result.response : "";
        if (!response) throw new Error("empty");
        maybeCacheResult(result, response);
        showResult(result, response);
      }).catch(function () {
        if (typeof enqueueTutorQuestion === "function" && typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueTutorQuestion(payload, callbacks).then(function (queued) {
            container.innerHTML = queued
              ? '<div class="tutor-fallback">Saved offline — will sync when you are back online.</div>'
              : '<div class="tutor-fallback">' + escapeHtml(callbacks.errorMessage || "The AI tutor is temporarily unavailable.") + "</div>";
          });
        } else {
          container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
            callbacks.errorMessage || "The AI tutor is temporarily unavailable."
          ) + "</div>";
        }
        if (typeof callbacks.onError === "function") callbacks.onError();
      });
    }

    return streamTutorResponse(
      payload,
      function (chunk) {
        accumulated += chunk;
        renderPartial();
      },
      function (meta) {
        var footer = document.createElement("div");
        footer.className = "tutor-response-footer";
        footer.innerHTML = renderTutorFooter(meta || {}, accumulated);
        container.appendChild(footer);
        scheduleTutorMath(container);
        maybeCacheResult(meta, accumulated);
        finishTutorSurface(container, meta, accumulated, callbacks);
      },
      function () {
        request("/ai/tutoring/explain", {
          method: "POST",
          body: JSON.stringify(payload),
        }).then(function (result) {
          var response = (result && result.response) ? result.response : "";
          if (!response) throw new Error("empty");
          maybeCacheResult(result, response);
          showResult(result, response);
        }).catch(function () {
          if (typeof enqueueTutorQuestion === "function" && typeof navigator !== "undefined" && !navigator.onLine) {
            enqueueTutorQuestion(payload, callbacks).then(function (queued) {
              container.innerHTML = queued
                ? '<div class="tutor-fallback">Saved offline — will sync when you are back online.</div>'
                : '<div class="tutor-fallback">' + escapeHtml(callbacks.errorMessage || "The AI tutor could not be reached.") + "</div>";
            });
          } else {
            container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
              callbacks.errorMessage || "The AI tutor could not be reached."
            ) + "</div>";
          }
          if (typeof callbacks.onError === "function") callbacks.onError();
        });
      }
    );
  }

  if (typeof getTutorQaCache === "function" && typeof tutorQaCacheKey === "function") {
    getTutorQaCache(tutorQaCacheKey(payload)).then(function (row) {
      if (row && row.response) {
        showResult({
          source: "local-cache",
          kbHits: row.kbHits || [],
          formatComplete: row.formatComplete,
          formatLevel: row.formatLevel || "none",
        }, row.response);
        return;
      }
      startNetwork();
    }).catch(function () { startNetwork(); });
    return null;
  }

  if (typeof streamTutorResponse !== "function") {
    request("/ai/tutoring/explain", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(function (result) {
      var response = (result && result.response) ? result.response : "";
      if (!response) throw new Error("empty");
      showResult(result, response);
    }).catch(function () {
      container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
        callbacks.errorMessage || "The AI tutor is temporarily unavailable."
      ) + "</div>";
      if (typeof callbacks.onError === "function") callbacks.onError();
    });
    return null;
  }

  return startNetwork();
}

function buildLessonQuizTutorQuestion(wrongQuestions) {
  var parts = [];
  (wrongQuestions || []).forEach(function (wq, idx) {
    parts.push(
      "QUESTION " + (idx + 1) + ": " + (wq.prompt || "")
      + "\n- Student answered: " + (wq.chosen_text || "(unanswered)")
      + "\n- Correct answer: " + (wq.correct_text || "")
    );
  });
  return (
    "A student answered the following lesson quiz questions incorrectly. "
    + "Explain in simple step-by-step language how to reach the correct answer for each one. "
    + "Do not just repeat the correct option — show the method and encourage the student.\n\n"
    + parts.join("\n\n")
  );
}

function mountLessonQuizTutor(mountAfterEl, wrongQuestions, ctx) {
  if (!mountAfterEl || !wrongQuestions || !wrongQuestions.length) return;
  var existing = mountAfterEl.parentNode && mountAfterEl.parentNode.querySelector(".quiz-tutor");
  if (existing) existing.remove();
  var tutorId = "lesson-quiz-tutor-" + Date.now();
  var countLabel = wrongQuestions.length + " question" + (wrongQuestions.length > 1 ? "s" : "");
  var tutorHtml = (
    '<div class="quiz-tutor" id="' + tutorId + '">'
    + '<div class="quiz-tutor-header"><span class="quiz-tutor-icon">🎓</span>'
    + '<div><div class="quiz-tutor-title">Let\u2019s Learn: Step-by-Step</div>'
    + '<div class="quiz-tutor-sub">The AI tutor will explain the ' + countLabel + ' you got wrong.</div></div></div>'
    + '<div class="quiz-tutor-body"></div></div>'
  );
  if (mountAfterEl.insertAdjacentHTML) {
    mountAfterEl.insertAdjacentHTML("afterend", tutorHtml);
  } else if (mountAfterEl.parentNode) {
    var tmp = document.createElement("div");
    tmp.innerHTML = tutorHtml;
    while (tmp.firstChild) mountAfterEl.parentNode.insertBefore(tmp.firstChild, mountAfterEl.nextSibling);
  }
  var body = document.getElementById(tutorId)?.querySelector(".quiz-tutor-body");
  if (!body) return;
  var lesson = (ctx && ctx.lesson) || { title: (ctx && ctx.lessonTitle) || "Lesson quiz" };
  if (ctx && ctx.lessonId && !lesson.id) lesson.id = ctx.lessonId;
  var payload = buildLessonTutorPayload({
    question: buildLessonQuizTutorQuestion(wrongQuestions),
    lesson: lesson,
    lessonId: (ctx && ctx.lessonId) || lesson.id,
    lessonContent: ctx && ctx.lessonContent,
    iframeText: ctx && ctx.iframeText,
    subject_slug: (ctx && ctx.subject_slug) || lesson.subject_slug,
    form_level: (ctx && ctx.form_level) || lesson.form_level,
  });
  runTutorQuery(payload, {
    container: body,
    loadingLabel: "Explaining the correct method\u2026",
    errorMessage: "The AI tutor is temporarily unavailable. Review the lesson or ask your teacher.",
    listenTitle: "Listen to explanation",
  });
}

function renderAiResultFooter(result, responseText) {
  return renderTutorFooter(result || {}, responseText);
}

window.renderTutorThinking = renderTutorThinking;
window.renderTutorSourceChips = renderTutorSourceChips;
window.renderTutorFooter = renderTutorFooter;
window.renderFormatQualityChip = renderFormatQualityChip;
window.renderAiResultFooter = renderAiResultFooter;
window.buildLessonTutorPayload = buildLessonTutorPayload;
window.buildQuizLessonContent = buildQuizLessonContent;
window.buildTutorThreadQuestion = buildTutorThreadQuestion;
window.buildTutorMessagesArray = buildTutorMessagesArray;
window.attachTutorFollowUp = attachTutorFollowUp;
window.attachTutorHelpful = attachTutorHelpful;
window.renderTutorStreamingSkeleton = renderTutorStreamingSkeleton;
window.tutorThreadStorageKey = tutorThreadStorageKey;
window.loadTutorThread = loadTutorThread;
window.loadTutorThreadFromServer = loadTutorThreadFromServer;
window.saveTutorThread = saveTutorThread;
window.buildLessonQuizTutorQuestion = buildLessonQuizTutorQuestion;
window.mountLessonQuizTutor = mountLessonQuizTutor;
window.runTutorQuery = runTutorQuery;
window.runAiGenerateTask = runAiGenerateTask;
window.attachTutorListen = attachTutorListen;

;
// modules/api-quiz.js — Quiz rendering, tutor, downloads

/* ── Math (KaTeX) Rendering ───────────────────────────────────────── */
window.renderMath = function (el) {
  if (!el) return;
  // KaTeX is lazy-loaded on demand (see api-client/core/katex-loader.js).
  window.ensureKaTeX().then(function () {
    if (typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    } catch (e) {
      // Never let a math failure break the page.
    }
  });
};

window._quizSubmit = function(quizId, total) {
  var correct = 0;
  var i, container, correctAnswer, selected, selectedVal, exp;
  var scoreEl, scoreNum, scoreLabel, pct, msg, btn;
  var wrong = [];

  for (i = 0; i < total; i++) {
    container = document.querySelector("#" + quizId + " .quiz-question[data-index=\"" + i + "\"]");
    if (!container) continue;
    correctAnswer = container.getAttribute("data-correct");
    selected = document.querySelector("input[name=\"" + quizId + "-q" + i + "\"]:checked");
    selectedVal = selected ? selected.value : null;

    var options = container.querySelectorAll(".quiz-option");
    var j, opt, letter;
    for (j = 0; j < options.length; j++) {
      opt = options[j];
      letter = opt.getAttribute("data-letter");
      opt.style.pointerEvents = "none";
      if (letter === correctAnswer) {
        opt.classList.add("correct");
      } else if (letter === selectedVal && letter !== correctAnswer) {
        opt.classList.add("incorrect");
      }
    }

    if (selectedVal === correctAnswer) correct++;
    if (selectedVal !== correctAnswer) wrong.push(i);

    exp = document.getElementById(quizId + "-exp-" + i);
    if (exp) exp.classList.add("visible");
  }

  scoreEl = document.getElementById(quizId + "-score");
  scoreNum = document.getElementById(quizId + "-score-num");
  scoreLabel = document.getElementById(quizId + "-score-label");
  if (scoreEl && scoreNum && scoreLabel) {
    scoreNum.textContent = correct + " / " + total;
    pct = Math.round((correct / total) * 100);
    msg = pct >= 80 ? "Excellent! Keep it up!" : pct >= 50 ? "Good effort! Review the explanations." : "Keep practicing. Review the explanations below.";
    scoreLabel.textContent = pct + "% \u2014 " + msg;
    scoreEl.classList.add("visible");
  }

  btn = document.querySelector("#" + quizId + " .quiz-submit-all");
  if (btn) btn.style.display = "none";

  if (wrong.length) {
    _tutorWrongQuestions(quizId, total, wrong);
  }
};

function _tutorWrongQuestions(quizId, total, wrongIndexes) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions || !wrongIndexes.length) return;

  var subjectSlug = "";
  var formLevel = "";
  var slugMap = { mathematics:"mathematics", math:"mathematics", chemistry:"chemistry", physics:"physics" };
  var m = (data.meta || "").match(/^([A-Za-z ]+)\s*(\u2022)?\s*Form\s*([IVX]+)/i);
  if (m) {
    var label = slugMap[m[1].trim().toLowerCase()];
    if (label) subjectSlug = label;
    var roman = m[3];
    formLevel = (roman === "I") ? "1" : (roman === "II") ? "2" : (roman === "III") ? "3" : "4";
  }

  var parts = [];
  wrongIndexes.forEach(function(idx) {
    var q = data.questions[idx];
    if (!q) return;
    var chosen = null;
    if (q.options) {
      q.options.forEach(function(o) { if (o.letter === q.correct) chosen = o.text; });
    }
    var chosenText = chosen ? chosen : "(question left unanswered)";
    parts.push(
      "QUESTION " + (idx + 1) + ": " + (q.text || "")
      + "\n- Options: " + (q.options || []).map(function(o){ return o.letter + ") " + o.text; }).join("; ")
      + "\n- The student answered: " + chosenText
      + "\n- The correct answer is: " + q.correct
    );
  });

  var question = "A student answered the following questions incorrectly. Please explain, "
    + "in simple step-by-step language a secondary school student will understand, EXACTLY how to arrive at the correct answer for each one. "
    + "Do not just repeat the correct letter \u2014 show the working/method step by step, call out any common mistake the student likely made, and keep the tone encouraging.\n\n"
    + parts.join("\n\n");

  var wrap = document.getElementById(quizId + "-score");
  if (!wrap) return;
  var tutorHtml = '<div class="quiz-tutor" id="' + quizId + '-tutor">'
    + '<div class="quiz-tutor-header"><span class="quiz-tutor-icon">\uD83C\uDF93</span>'
    + '<div><div class="quiz-tutor-title">Let\u2019s Learn: Step-by-Step</div>'
    + '<div class="quiz-tutor-sub">The AI tutor will show you exactly how to solve the ' + wrongIndexes.length + ' question'
    + (wrongIndexes.length > 1 ? "s" : "") + ' you got wrong.</div></div></div>'
    + '<div class="quiz-tutor-body"><div class="tutor-loading"><span class="spinner"></span> Explaining the correct method\u2026</div></div>'
    + '</div>';
  if (wrap.insertAdjacentHTML) {
    wrap.insertAdjacentHTML("afterend", tutorHtml);
  } else if (wrap.parentNode) {
    var tmp = document.createElement("div");
    tmp.innerHTML = tutorHtml;
    while (tmp.firstChild) wrap.parentNode.insertBefore(tmp.firstChild, wrap.nextSibling);
  }

  var body = document.getElementById(quizId + "-tutor").querySelector(".quiz-tutor-body");

  var quizEl = document.getElementById(quizId);
  var lessonId = quizEl && quizEl.getAttribute("data-lesson-id");
  var meta = window.__casuyaQuizLessonMeta || {};
  var payload = buildLessonTutorPayload({
    question: question,
    lesson: { title: data.topic || data.meta || meta.title || "Quiz", id: lessonId || meta.lessonId },
    lessonId: lessonId || meta.lessonId,
    lessonContent: typeof buildQuizLessonContent === "function"
      ? buildQuizLessonContent(data.questions)
      : "",
    subject_slug: subjectSlug || meta.subject_slug || undefined,
    form_level: formLevel ? Number(formLevel) : (meta.form_level || undefined),
    topic: data.topic || meta.topic || "",
    subtopic: meta.subtopic || "",
  });

  runTutorQuery(payload, {
    container: body,
    loadingLabel: "Explaining the correct method…",
    errorMessage: "The AI tutor is temporarily unavailable. Please review the explanations above or ask your teacher for help.",
    listenTitle: "Listen to explanation",
  });
}

function _quizExtractData(quizId) {
  var container = document.getElementById(quizId);
  if (!container) return null;
  var badge = container.querySelector(".quiz-badge");
  var topic = container.querySelector(".quiz-topic");
  var meta = badge ? badge.textContent.trim() : "";
  var topicText = topic ? topic.textContent.replace("Topic:", "").trim() : "";
  var questions = [];
  var qEls = container.querySelectorAll(".quiz-question");
  var i, qEl, qText, opts, j, optEl, letter, optText;
  for (i = 0; i < qEls.length; i++) {
    qEl = qEls[i];
    qText = qEl.querySelector(".quiz-question-text");
    opts = qEl.querySelectorAll(".quiz-option");
    var options = [];
    for (j = 0; j < opts.length; j++) {
      optEl = opts[j];
      letter = optEl.getAttribute("data-letter");
      optText = optEl.querySelector("span:last-child");
      options.push({ letter: letter, text: optText ? optText.textContent.trim() : "" });
    }
    var expEl = qEl.querySelector(".quiz-explanation");
    var expText = expEl ? expEl.textContent.replace("Explanation:", "").trim() : "";
    questions.push({
      num: i + 1,
      text: qText ? qText.textContent.trim() : "",
      options: options,
      correct: qEl.getAttribute("data-correct") || "",
      explanation: expText
    });
  }
  return { meta: meta, topic: topicText, questions: questions };
}

window._quizDownloadWord = function(quizId) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions.length) return;
  var html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>";
  html += "<head><meta charset='utf-8'><title>Quiz</title>";
  html += "<style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}h1{color:#1e3a8a;font-size:20px}h2{color:#333;font-size:15px;margin-top:24px}.q{margin-bottom:16px}.q-text{font-weight:bold;font-size:13px}.opt{margin:4px 0 4px 20px;font-size:12px}.correct{color:#16a34a;font-weight:bold}.exp{color:#555;font-size:11px;margin-left:20px;border-left:3px solid #16a34a;padding-left:8px;margin-top:4px}.meta{color:#666;font-size:12px;margin-bottom:16px}</style></head><body>";
  html += "<h1>Quiz Questions</h1>";
  html += "<div class='meta'>" + data.meta;
  if (data.topic) html += " &bull; Topic: " + data.topic;
  html += "</div>";
  var i, q, j, opt;
  for (i = 0; i < data.questions.length; i++) {
    q = data.questions[i];
    html += "<div class='q'>";
    html += "<div class='q-text'>" + q.num + ". " + q.text + "</div>";
    for (j = 0; j < q.options.length; j++) {
      opt = q.options[j];
      html += "<div class='opt'>" + opt.letter + ". " + opt.text + "</div>";
    }
    html += "<div class='exp'><strong>Answer:</strong> " + q.correct + "</div>";
    if (q.explanation) html += "<div class='exp'>" + q.explanation + "</div>";
    html += "</div>";
  }
  html += "</body></html>";
  var blob = new Blob(["\ufeff" + html], { type: "application/msword" });
  _quizTriggerDownload(blob, "quiz-questions.doc");
};

window._quizDownloadPdf = function(quizId) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions.length) return;
  var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Quiz</title>";
  html += "<style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.5;color:#111}h1{color:#1e3a8a;font-size:22px;border-bottom:2px solid #1e3a8a;padding-bottom:8px}h2{color:#333;font-size:14px;margin-top:20px}.meta{color:#555;font-size:12px;margin-bottom:16px;padding:8px;background:#f3f4f6;border-radius:6px}.q{margin-bottom:20px;page-break-inside:avoid}.q-text{font-weight:bold;font-size:13px;margin-bottom:4px}.opt{margin:3px 0 3px 24px;font-size:12px}.correct{color:#16a34a;font-weight:bold}.exp{color:#444;font-size:11px;margin-left:24px;border-left:3px solid #16a34a;padding-left:8px;margin-top:4px}@media print{body{margin:20px}.q{page-break-inside:avoid}}</style></head><body>";
  html += "<h1>Quiz Questions</h1>";
  html += "<div class='meta'>" + data.meta;
  if (data.topic) html += " &bull; Topic: " + data.topic;
  html += "</div>";
  var i, q, j, opt;
  for (i = 0; i < data.questions.length; i++) {
    q = data.questions[i];
    html += "<div class='q'>";
    html += "<div class='q-text'>" + q.num + ". " + q.text + "</div>";
    for (j = 0; j < q.options.length; j++) {
      opt = q.options[j];
      html += "<div class='opt'>" + opt.letter + ". " + opt.text + "</div>";
    }
    html += "<div class='exp'><strong>Answer:</strong> " + q.correct + "</div>";
    if (q.explanation) html += "<div class='exp'>" + q.explanation + "</div>";
    html += "</div>";
  }
  html += "</body></html>";
  var win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(function() { win.print(); }, 400);
  }
};

function _quizTriggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

;
// modules/api.js — Facade that re-exports everything from the split modules.
// All symbols are globals after build-js.mjs strips ESM keywords.

// Re-api-cache globals (already on window from api-cache.js)
// clearRequestCaches, requestCache, inFlight, CACHE_TTL

// Re-api-auth globals (already on window from api-auth.js)
// decodeToken, tokenNeedsRefresh, refreshAuthToken

// Re-api-client globals (already on window from api-client.js)
// API_HOST, API_PROTOCOL, API_BASE, render, escapeHtml, injectNodeBase,
// timeAgo, showToast, confirmDelete, deleteBtn, initDeleteButtons,
// renderTutorMarkdown, renderQuizQuestions, renderMath,
// _quizSubmit, _tutorWrongQuestions, _quizExtractData,
// _quizDownloadWord, _quizDownloadPdf, _quizTriggerDownload,
// streamTutorResponse, request

;
// modules/auth.js — extracted from main.js (classic script, shared global scope)
function renderLogin() {
  render("#app", `
    <div class="page login-page">
      <div class="login-card">
        <h1>Casuya Platform</h1>
        <p>Sign in to continue</p>
        <form id="login-form">
          <input type="text" id="email" placeholder="Email" required />
          <input type="password" id="password" placeholder="Password" required />
          <button type="submit">Sign In</button>
          <p class="error" id="login-error" style="display:none"></p>
        </form>
      </div>
    </div>
  `);
  document.getElementById("login-form").addEventListener("submit", handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.style.display = "none";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (data && data.access_token) {
      localStorage.setItem("casuya_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("casuya_refresh_token", data.refresh_token);
      if (data.role) localStorage.setItem("casuya_role", data.role);
      renderApp();
    } else {
      errorEl.textContent = data?.detail || "Login failed";
      errorEl.style.display = "block";
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  }
}

function handleLogout() {
  if (typeof clearRequestCaches === "function") clearRequestCaches();
  localStorage.removeItem("casuya_token");
  window.location.href = "/index.html#features";
}

;
// modules/appearance.js — extracted from main.js (classic script, shared global scope)
const THEME_KEY = "casuya_theme";

const FONT_KEY = "casuya_font_scale";

function applyAppearance() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  const scale = (parseFloat(localStorage.getItem(FONT_KEY) || "100") / 100) || 1;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.setProperty("--app-font-scale", String(scale));
}

function appearancePanelHTML() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  const scale = parseInt(localStorage.getItem(FONT_KEY) || "100", 10);
  const themeBtn = (val, label) =>
    `<button type="button" class="btn appearance-theme-btn" data-theme-val="${val}" style="flex:1${theme === val ? ";background:var(--color-primary);color:#fff" : ""}">${label}</button>`;
  return `
    <div class="card" style="padding:1.5rem">
      <h3 style="margin-bottom:0.75rem">Appearance</h3>
      <div style="display:flex;flex-direction:column;gap:1.25rem">
        <div>
          <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.5rem">Theme</label>
          <div style="display:flex;gap:0.5rem">
            ${themeBtn("light", "☀️ Light")}
            ${themeBtn("dark", "🌙 Dark")}
            ${themeBtn("black", "⚫ Black")}
          </div>
        </div>
        <div>
          <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.5rem">Font Size: <span id="font-scale-val">${scale}%</span></label>
          <input id="font-scale-slider" type="range" min="80" max="150" step="5" value="${scale}" style="width:100%">
          <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.4rem">Drag to make text larger or smaller across the app.</p>
        </div>
      </div>
      <p id="appearance-msg" style="font-size:0.85rem;margin-top:1rem;display:none"></p>
    </div>
  `;
}

function setupAppearanceControls() {
  const msg = document.getElementById("appearance-msg");
  document.querySelectorAll(".appearance-theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.themeVal;
      localStorage.setItem(THEME_KEY, val);
      applyAppearance();
      document.querySelectorAll(".appearance-theme-btn").forEach(b => { b.style.background = ""; b.style.color = ""; });
      btn.style.background = "var(--color-primary)";
      btn.style.color = "#fff";
      if (msg) { msg.textContent = "✅ Theme updated"; msg.style.color = "var(--color-success)"; msg.style.display = "block"; setTimeout(() => msg.style.display = "none", 2000); }
    });
  });
  const slider = document.getElementById("font-scale-slider");
  const valLabel = document.getElementById("font-scale-val");
  if (slider) {
    slider.addEventListener("input", () => {
      const v = slider.value;
      localStorage.setItem(FONT_KEY, v);
      applyAppearance();
      if (valLabel) valLabel.textContent = v + "%";
    });
    slider.addEventListener("change", () => {
      if (msg) { msg.textContent = "✅ Font size saved"; msg.style.color = "var(--color-success)"; msg.style.display = "block"; setTimeout(() => msg.style.display = "none", 2000); }
    });
  }
}

;
// modules/lesson/lesson-content.js — lesson content builders (classic script, shared global scope).
// Extracted from modules/lesson.js: the bridge script injected into each lesson iframe
// and the quiz / games section renderers used by lesson-viewer.js.

// Injected just before </body> of every lesson so the sandboxed lesson iframe can report
// quiz scores, progress and video milestones back to the parent page.
const LESSON_BRIDGE_SCRIPT = `
<script>
(function(){
  var scoreReported = false;
  window.casuya = window.casuya || {};
  window.casuya.reportScore = function(score, total) {
    parent.postMessage({type:'casuya-quiz', score:score, total:total}, '*');
    scoreReported = true;
  };
  window.casuya.reportProgress = function(pct) {
    parent.postMessage({type:'casuya-progress', percent:pct}, '*');
  };
  function detectScore() {
    if (scoreReported) return;
    var candidates = document.querySelectorAll('.score-big, .quiz-score, .final-score, .result-score, [class*=score]');
    for (var i = 0; i < candidates.length; i++) {
      var text = (candidates[i].textContent || '').trim();
      var m = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        var s = parseInt(m[1]), t = parseInt(m[2]);
        if (t > 0 && s <= t) {
          parent.postMessage({type:'casuya-quiz', score:s, total:t}, '*');
          scoreReported = true;
          return;
        }
      }
    }
  }
  function upgradeAdaptiveVideos(root) {
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      (function (v) {
        var src = v.getAttribute('src') || '';
        // Only act on HLS manifests; plain mp4/webm stay as-is (P1-5).
        if (!/\.m3u8(\?|$)/.test(src)) return;
        if (v.dataset.casuyaHls) return;
        v.dataset.casuyaHls = '1';
        v.setAttribute('preload', v.getAttribute('preload') || 'none');
        // Native HLS (Safari / iOS) needs no library.
        if (v.canPlayType('application/vnd.apple.mpegurl')) return;
        function attach(Hls) {
          if (!Hls || !Hls.isSupported()) return;
          var hls = new Hls({ maxBufferLength: 10, capLevelToPlayerSize: true, startLevel: -1 });
          hls.loadSource(src);
          hls.attachMedia(v);
        }
        if (window.Hls) { attach(window.Hls); return; }
        // Lazy-load the vendored hls.js only when actually needed (no-op if absent).
        var s = document.createElement('script');
        s.src = '/static/lib/hls.min.js';
        s.onload = function () { attach(window.Hls); };
        document.head.appendChild(s);
      })(videos[i]);
    }
  }
  function trackVideos(root) {
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      (function(v) {
        if (v.dataset.casuyaTracked) return;
        v.dataset.casuyaTracked = '1';
        var maxPct = 0;
        v.addEventListener('timeupdate', function() {
          if (v.duration) { var pct = Math.round((v.currentTime / v.duration) * 100); if (pct > maxPct) maxPct = pct; }
        });
        v.addEventListener('ended', function() { parent.postMessage({type:'casuya-video', percent:100}, '*'); });
        var _iv = setInterval(function() { if (maxPct > 0) parent.postMessage({type:'casuya-progress', percent:Math.min(maxPct + 10, 100)}, '*'); }, 5000);
        window.casuya._intervals = window.casuya._intervals || [];
        window.casuya._intervals.push(_iv);
      })(videos[i]);
    }
  }
  function postSelectionExplain() {
    var sel = window.getSelection();
    var text = sel ? String(sel.toString() || '').trim() : '';
    if (text.length < 8 || text.length > 500) return;
    var anchor = sel && sel.anchorNode;
    var el = anchor && anchor.nodeType === 3 ? anchor.parentElement : anchor;
    var block = el && el.closest ? el.closest('p, li, h1, h2, h3, h4, td, blockquote, section, article') : null;
    var surrounding = block ? String(block.textContent || '').trim().slice(0, 800) : '';
    parent.postMessage({
      type: 'casuya-selection',
      selected: text,
      context: surrounding
    }, '*');
  }
  function initBridge() {
    if (!document.body) { setTimeout(initBridge, 100); return; }
    upgradeAdaptiveVideos(document.body);
    trackVideos(document.body);
    detectScore();
    document.addEventListener('mouseup', function() { setTimeout(postSelectionExplain, 120); });
    document.addEventListener('keyup', function(e) {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') {
        setTimeout(postSelectionExplain, 120);
      }
    });
    var obs = new MutationObserver(function() { detectScore(); upgradeAdaptiveVideos(document.body); trackVideos(document.body); });
    obs.observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBridge);
  else initBridge();
})();
<\/script>`;

// Quiz section rendered below the lesson iframe for students. Returns "" when there
// is no quiz to show. `lessonId` is embedded so each question's "Show your work"
// blackboard gets a unique board id.
function renderLessonQuiz(quizData, lessonId, lessonLang) {
  if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
  const lang = lessonLang || "sw";
  return `
    <div class="card question-block" data-lesson-lang="${escapeHtml(lang)}" style="margin-top:1rem;padding:1rem">
      <h3 style="margin:0 0 0.75rem">${escapeHtml(quizData.title || "Quiz")}</h3>
      <form id="quiz-form">
        ${quizData.questions.map((q, qi) => `
          <div class="quiz-item" data-question style="margin-bottom:1rem">
            <p style="font-weight:600;margin:0 0 0.5rem">${qi + 1}. ${escapeHtml(q.prompt)} <button type="button" class="casuya-listen" data-lang="${escapeHtml(lang)}" data-speak="${escapeHtml(String(q.prompt || "").slice(0, 600))}" title="Listen to question" aria-label="Listen to question" style="vertical-align:middle">🔊 Listen</button></p>
            ${q.options.map(o => `
              <label style="display:block;padding:0.3rem 0.5rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.25rem">
                <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required> ${escapeHtml(o.text)}
              </label>
            `).join("")}
            <details style="margin-top:0.5rem">
              <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
              <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}-${escapeHtml(q.id)}" data-quiz-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
            </details>
          </div>
        `).join("")}
        <button type="submit" class="btn btn-primary" id="quiz-submit-btn">Submit Quiz</button>
      </form>
      <div id="quiz-result" style="display:none;margin-top:0.75rem"></div>
    </div>
  `;
}

// Games & Activities section rendered below the quiz for students. Returns "" when
// there are no games to show.
function renderLessonGames(gamesData) {
  if (!Array.isArray(gamesData) || gamesData.length === 0) return "";
  return `
    <div class="card" style="margin-top:1rem;padding:1rem">
      <h3 style="margin:0 0 0.5rem">Games & Activities</h3>
      ${gamesData.map(g => `
        <div class="game-item" data-game-id="${escapeHtml(g.id)}" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);cursor:pointer">
          <span style="color:var(--color-primary)">${escapeHtml(g.title || "Game")}</span>
          <span style="color:var(--color-text-muted);font-size:0.8rem;margin-left:0.5rem">${escapeHtml(g.status || "draft")}</span>
        </div>
      `).join("")}
      <div id="game-content-area" style="margin-top:1rem"></div>
    </div>
  `;
}
;
// modules/lesson/lesson-idb.js — durable lesson HTML cache for cross-origin APIs.
// Service workers cannot intercept Vercel → Railway fetches; IndexedDB can.
// Explicit Downloads pin rows so LRU eviction cannot drop them.

var _casuyaLessonIdb = null;
var LESSON_IDB_NAME = "casuya-lessons";
var LESSON_IDB_STORE = "html";
var LESSON_IDB_MAX = 30;
var LESSON_IDB_MAX_BYTES = 1500000;

function openLessonIdb() {
  if (_casuyaLessonIdb) return _casuyaLessonIdb;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  _casuyaLessonIdb = new Promise(function (resolve) {
    try {
      var req = indexedDB.open(LESSON_IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(LESSON_IDB_STORE)) {
          db.createObjectStore(LESSON_IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    } catch (e) {
      resolve(null);
    }
  });
  return _casuyaLessonIdb;
}

function getIdbLessonContent(lessonId) {
  if (!lessonId) return Promise.resolve(null);
  return openLessonIdb().then(function (db) {
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readonly");
        var req = tx.objectStore(LESSON_IDB_STORE).get(lessonId);
        req.onsuccess = function () {
          var row = req.result;
          resolve(row && row.html ? row.html : null);
        };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function putIdbLessonContent(lessonId, html, pinned) {
  if (!lessonId || !html || html.length > LESSON_IDB_MAX_BYTES) return Promise.resolve();
  return openLessonIdb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readwrite");
        var store = tx.objectStore(LESSON_IDB_STORE);
        var getReq = store.get(lessonId);
        getReq.onsuccess = function () {
          var prev = getReq.result;
          var isPinned = !!(pinned || (prev && prev.pinned));
          store.put({ id: lessonId, html: html, ts: Date.now(), pinned: isPinned });
          store.getAll().onsuccess = function (ev) {
            var rows = ev.target.result || [];
            if (rows.length <= LESSON_IDB_MAX) return;
            var unpinned = rows.filter(function (r) { return !r.pinned; })
              .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
            var extra = rows.length - LESSON_IDB_MAX;
            for (var i = 0; i < extra && i < unpinned.length; i++) {
              store.delete(unpinned[i].id);
            }
          };
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

function deleteIdbLessonContent(lessonId) {
  if (!lessonId) return Promise.resolve();
  return openLessonIdb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readwrite");
        tx.objectStore(LESSON_IDB_STORE).delete(lessonId);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

function listIdbLessonIds(pinnedOnly) {
  return openLessonIdb().then(function (db) {
    if (!db) return [];
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readonly");
        var req = tx.objectStore(LESSON_IDB_STORE).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          if (pinnedOnly) rows = rows.filter(function (r) { return r && r.pinned; });
          resolve(rows.map(function (r) { return r.id; }).filter(Boolean));
        };
        req.onerror = function () { resolve([]); };
      } catch (e) {
        resolve([]);
      }
    });
  });
}

;
// modules/lesson/lesson-viewer/cache.js — in-memory lesson content cache (LRU-ish).

const lessonContentCache = new Map();

function getCachedLessonContent(lessonId) {
  return lessonContentCache.get(lessonId) || null;
}

function lessonContentQuery(forceFull) {
  if (forceFull) return "";
  try {
    var t = navigator.connection && navigator.connection.effectiveType;
    if (t === "slow-2g" || t === "2g") return "?essential=1";
  } catch (e) {}
  return "";
}

function cacheLessonContent(lessonId, html) {
  lessonContentCache.set(lessonId, html);
  if (lessonContentCache.size > 50) {
    const key = lessonContentCache.keys().next().value;
    lessonContentCache.delete(key);
  }
  if (html && typeof putIdbLessonContent === "function") {
    putIdbLessonContent(lessonId, html);
  }
}

function dropCachedLessonContent(lessonId) {
  lessonContentCache.delete(lessonId);
}

function loadGameHtml(gameId) {
  if (!gameId) return Promise.resolve("");
  var key = "g:" + gameId;
  var mem = getCachedLessonContent(key);
  if (mem) return Promise.resolve(mem);
  var fromIdb = typeof getIdbLessonContent === "function"
    ? getIdbLessonContent(key)
    : Promise.resolve(null);
  return fromIdb.then(function (html) {
    if (html) {
      lessonContentCache.set(key, html);
      return html;
    }
    return fetch(`${API_BASE}/games/${gameId}/content`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
    }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (fetched) {
      if (fetched) cacheLessonContent(key, fetched);
      return fetched;
    }).catch(function () { return ""; });
  });
}

function loadLessonHtml(lessonId, forceFull) {
  const mem = getCachedLessonContent(lessonId);
  if (mem && !forceFull) return Promise.resolve(mem);
  const fromIdb = (!forceFull && typeof getIdbLessonContent === "function")
    ? getIdbLessonContent(lessonId)
    : Promise.resolve(null);
  return fromIdb.then(function (html) {
    if (html) {
      lessonContentCache.set(lessonId, html);
      return html;
    }
    return fetch(`${API_BASE}/lessons/${lessonId}/content${typeof lessonContentQuery === "function" ? lessonContentQuery(forceFull) : ""}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
    }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (fetched) {
      if (fetched) cacheLessonContent(lessonId, fetched);
      return fetched;
    }).catch(function () { return ""; });
  });
}
;
// modules/lesson/lesson-viewer/bridge.js — inject the lesson bridge script into lesson HTML.

function injectBridgeScript(html) {
  const bridgeScript = LESSON_BRIDGE_SCRIPT;
  const bodyIdx = html.lastIndexOf("</body>");
  if (bodyIdx !== -1) {
    return html.slice(0, bodyIdx) + bridgeScript + html.slice(bodyIdx);
  }
  return html.replace("</html>", bridgeScript + "</html>");
}
;
// modules/exams.js — shared NECTA / internal-exam format paper renderer.
//
// Renders the canonical assignment "paper_json" (see
// backend/services/exam_paper_service.py) exactly like a printed NECTA /
// internal examination: cover, instructions, sections, numbered questions
// with marks and options. Used by the teacher dashboard for the
// "Generate with AI -> preview -> assign" flow and by the student dashboard
// for an answerable paper (multiple-choice auto-check).
//
// Both role bundles load this from the shared core, so these helpers are
// intentionally plain global functions (no imports/exports).

"use strict";

(function injectExamStyles() {
  if (document.getElementById("exam-paper-styles")) return;
  const style = document.createElement("style");
  style.id = "exam-paper-styles";
  style.textContent = [
    ".exam-paper{background:#fff;color:#1f2937;border:1px solid #d1d5db;border-radius:8px;padding:1.25rem 1.25rem 0.75rem;font-size:0.9rem;line-height:1.5}",
    ".exam-cover{text-align:center;padding:0.75rem 0 0.9rem;border-bottom:2px solid #e5e7eb;margin-bottom:0.75rem}",
    ".exam-country{letter-spacing:0.18em;font-weight:700;font-size:0.7rem;color:#374151}",
    ".exam-label{font-size:1.05rem;font-weight:800;margin:0.25rem 0 0.15rem;text-decoration:underline}",
    ".exam-subject{font-size:1.15rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.15rem}",
    ".exam-meta{display:flex;flex-wrap:wrap;gap:0.5rem 1.5rem;justify-content:center;margin-top:0.45rem;font-size:0.85rem;color:#374151}",
    ".exam-topic{margin-top:0.3rem;font-style:italic;font-size:0.85rem;color:#4b5563}",
    ".exam-instr{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:0.6rem 1rem 0.6rem 0.6rem;margin-bottom:1rem}",
    ".exam-instr-title{font-weight:800;font-size:0.78rem;letter-spacing:0.12em;margin-bottom:0.25rem}",
    ".exam-instr ol{margin:0 0 0 1.1rem;padding:0;font-size:0.85rem}",
    ".exam-section{margin-bottom:1.1rem}",
    ".exam-sec-head{display:flex;align-items:center;gap:0.65rem;border-bottom:2px solid #e5e7eb;padding-bottom:0.3rem;margin-bottom:0.4rem}",
    ".exam-sec-id{color:#fff;font-weight:800;font-size:0.7rem;letter-spacing:0.08em;padding:0.15rem 0.6rem;border-radius:4px;white-space:nowrap}",
    ".exam-sec-title{font-weight:800;font-size:0.85rem;letter-spacing:0.05em;flex:1}",
    ".exam-sec-marks{font-size:0.78rem;color:#4b5563;white-space:nowrap}",
    ".exam-sec-instr{font-size:0.82rem;color:#4b5563;margin-bottom:0.45rem;font-style:italic}",
    ".exam-q{margin-bottom:0.7rem}",
    ".exam-q-head{display:flex;gap:0.4rem;align-items:baseline}",
    ".exam-q-no{font-weight:700;min-width:1.4rem}",
    ".exam-q-text{flex:1;font-weight:500}",
    ".exam-q-marks{color:#6b7280;font-size:0.8rem;white-space:nowrap}",
    ".exam-opts{margin:0.3rem 0 0 1.8rem;display:flex;flex-direction:column;gap:0.15rem}",
    ".exam-opts-static .exam-opt::before{content:'\\25CB';color:#6b7280;margin-right:0.45rem}",
    ".exam-opt{display:flex;gap:0.45rem;align-items:flex-start;cursor:pointer;font-size:0.85rem;font-variant-numeric:tabular-nums}",
    ".exam-opt input{margin-top:0.18rem}",
    ".exam-answer-line{border-bottom:1px dotted #9ca3af;height:2.2rem;margin:0.25rem 0 0 1.8rem}",
    ".exam-check{margin-top:0.6rem;border-top:1px dashed #d1d5db;padding-top:0.6rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap}",
    ".exam-score{font-size:0.85rem}",
    ".exam-score-good{color:#15803d;font-weight:600}",
  ].join("");
  document.head.appendChild(style);
})();

const EXAM_PAPER_COLORS = { necta: "#0b3d91", internal: "#14532d", exercise: "#7c2d12" };

function examKindLabel(paper) {
  const k = paper && paper.kind;
  if (paper && paper.format_label) return paper.format_label;
  if (k === "necta") return "NECTA-STYLE EXAMINATION";
  if (k === "exercise") return "CLASS EXERCISE";
  return "INTERNAL EXAMINATION";
}

function examPaperMetaLine(psummary) {
  if (!psummary) return "";
  const parts = [];
  if (psummary.subject) parts.push(escapeHtml(psummary.subject));
  if (psummary.form_label) parts.push(escapeHtml(psummary.form_label));
  const secs = Array.isArray(psummary.sections) ? psummary.sections : [];
  const qs = secs.reduce((n, s) => n + (parseInt(s.count, 10) || 0), 0);
  if (qs) parts.push(qs + " questions");
  if (psummary.total_marks != null) parts.push(psummary.total_marks + " marks");
  return parts.join(" \u2022 ");
}

function renderExamSection(sec, ctx) {
  const qs = Array.isArray(sec.questions) ? sec.questions : [];
  const marks = qs.reduce((n, q) => n + (parseInt(q.marks, 10) || 0), 0);
  let html =
    '<div class="exam-section">' +
    '<div class="exam-sec-head">' +
    '<span class="exam-sec-id" style="background:' + escapeHtml(ctx.color) + '">SECTION ' + escapeHtml((sec.id || "").trim()) + "</span>" +
    '<span class="exam-sec-title">' + escapeHtml(sec.title || "QUESTIONS") + "</span>" +
    '<span class="exam-sec-marks">' + marks + " marks</span>" +
    "</div>";
  if (sec.instruction) html += '<div class="exam-sec-instr">' + escapeHtml(sec.instruction) + "</div>";
  html += qs.map((q) => renderExamQuestion(q, sec.question_type, ctx)).join("");
  html += "</div>";
  return html;
}

function renderExamQuestion(q, type, ctx) {
  const marks = parseInt(q.marks, 10) || 0;
  const isMcq = type === "mcq";
  let html =
    '<div class="exam-q" data-q="' + escapeHtml(q.number) + '">' +
    '<div class="exam-q-head">' +
    '<span class="exam-q-no">' + escapeHtml(q.number) + ".</span>" +
    '<span class="exam-q-text">' + escapeHtml(q.text) + "</span>" +
    (marks ? '<span class="exam-q-marks">(' + marks + ")</span>" : "") +
    "</div>";
  if (isMcq) {
    const opts = Array.isArray(q.options) ? q.options : [];
    if (ctx.mode === "student") {
      html +=
        '<div class="exam-opts">' +
        opts
          .map(
            (o, i) =>
              '<label class="exam-opt"><input type="radio" name="' +
              escapeHtml(ctx.ns + "-" + q.number) +
              '" value="' +
              i +
              '"><span>' +
              escapeHtml(o) +
              "</span></label>"
          )
          .join("") +
        "</div>";
    } else {
      html +=
        '<div class="exam-opts exam-opts-static">' +
        opts.map((o) => '<div class="exam-opt">' + escapeHtml(o) + "</div>").join("") +
        "</div>";
    }
  } else {
    if (ctx.mode === "student") {
      html +=
        '<div style="display:flex;gap:0.35rem;align-items:flex-start">' +
        '<textarea class="exam-structured-answer" data-question="' + escapeHtml(q.number) + '" placeholder="Write your answer here..." style="flex:1;min-width:0;min-height:80px;padding:0.5rem;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;font-size:0.9rem;resize:vertical;margin-top:0"></textarea>' +
        '<button type="button" class="casuya-record" data-human-speech-only="true" data-lang="auto" data-label="Speak your answer" title="Speak your answer" aria-label="Speak your answer" style="margin-top:0">🎤 Voice</button>' +
        "</div>";
    } else {
      html += '<div class="exam-answer-line"></div>';
    }
  }
  html += "</div>";
  return html;
}

// Render the exam paper as HTML. opts.mode: "preview" (teacher) | "student".
// opts.ns: a unique namespace for radio name attributes (per assignment).
function renderExamPaper(paper, opts) {
  opts = opts || {};
  const h = paper.header || {};
  const sections = Array.isArray(paper.sections) ? paper.sections : [];
  const mode = opts.mode || "preview";
  const ns = opts.ns || "exam";
  const color = EXAM_PAPER_COLORS[paper.kind] || "#0b3d91";
  const label = examKindLabel(paper);

  let html = '<div class="exam-paper">';

  // Cover block (mirrors the top of a NECTA paper).
  html +=
    '<div class="exam-cover" style="border-top:5px solid ' +
    escapeHtml(color) +
    '">' +
    '<div class="exam-country">UNITED REPUBLIC OF TANZANIA</div>' +
    '<div class="exam-label">' +
    escapeHtml(label) +
    "</div>" +
    (h.subject ? '<div class="exam-subject">' + escapeHtml(h.subject) + "</div>" : "") +
    '<div class="exam-meta">' +
    (h.form_label
      ? '<span>Class: <b>' + escapeHtml(h.form_label) + "</b></span>"
      : "") +
    (h.duration ? '<span>Time Allowed: <b>' + escapeHtml(h.duration) + "</b></span>" : "") +
    '<span>Total: <b>' + (h.total_marks != null ? parseInt(h.total_marks, 10) : 0) + " marks</b></span>" +
    "</div>" +
    (h.topic ? '<div class="exam-topic">Topic: ' + escapeHtml(h.topic) + "</div>" : "") +
    "</div>";

  // Instructions.
  const instr = Array.isArray(h.instructions) ? h.instructions : [];
  if (instr.length) {
    html +=
      '<div class="exam-instr">' +
      '<div class="exam-instr-title">INSTRUCTIONS</div>' +
      "<ol>" +
      instr.map((i) => "<li>" + escapeHtml(i) + "</li>").join("") +
      "</ol>" +
      "</div>";
  }

  // Sections.
  html += sections.map((sec) => renderExamSection(sec, { mode, ns, color })).join("");

  // Auto-check control for the student view.
  if (mode === "student") {
    html +=
      '<div class="exam-check">' +
      '<button type="button" class="btn btn-sm btn-primary" data-exam-check data-exam-ns="' +
      escapeHtml(ns) +
      '">Check Objective Answers</button>' +
      '<div data-exam-score class="exam-score"></div>' +
      "</div>";
  }

  html += "</div>";
  return html;
}

// Bind the "Check Objective Answers" auto-score using the answers carried by
// the paper object already available to the caller (kept out of the DOM).
// root: the container that holds the rendered paper.
function bindExamScore(root, paper) {
  const btn = root.querySelector("[data-exam-check]");
  if (!btn) return;
  const out = root.querySelector("[data-exam-score]");
  const ns = btn.dataset.examNs || "exam";
  btn.addEventListener("click", () => {
    let correctMarks = 0;
    let objectiveMarks = 0;
    let correctQs = 0;
    let objectiveQs = 0;
    (paper.sections || []).forEach((sec) => {
      if (sec.question_type !== "mcq") return;
      (sec.questions || []).forEach((q) => {
        objectiveQs += 1;
        objectiveMarks += parseInt(q.marks, 10) || 1;
        const sel = root.querySelector('input[name="' + ns + "-" + q.number + '"]:checked');
        if (sel && parseInt(sel.value, 10) === q.answer) {
          correctQs += 1;
          correctMarks += parseInt(q.marks, 10) || 1;
        }
      });
    });
    const pct = objectiveQs ? Math.round((correctQs / objectiveQs) * 100) : 0;
    if (out) {
      out.innerHTML =
        '<span class="exam-score-good">Objective answers: <b>' +
        correctQs +
        "/" +
        objectiveQs +
        " correct (" +
        correctMarks +
        "/" +
        objectiveMarks +
        " marks)</b> \u2014 " +
        pct +
        "%</span>";
    }
  });
}
;
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

;
// API_HOST / API_PROTOCOL / API_BASE are declared once in modules/api.js and
// shared as globals when this file is concatenated into a classic-script bundle.
// When loaded directly as an ES module (login.html, register.html, …) those
// globals are not present, so resolve the base from the central config resolver.

function resolveApiBase() {
  if (typeof window !== "undefined" && window.API_BASE) return window.API_BASE;
  if (typeof window !== "undefined" && window.casuyaApiBase) return window.casuyaApiBase();
  return window.location.origin;
}

const STORAGE_KEYS = {
  accessToken: "casuya_token",
  refreshToken: "casuya_refresh_token",
  userId: "casuya_user_id",
  role: "casuya_role",
};

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildApiUrl(path, method = "GET") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const [pathname, search = ""] = normalizedPath.split("?");
  return `${resolveApiBase()}${pathname}${search ? `?${search}` : ""}`;
}

function getAuthHeaders(headers = {}, includeJson = true) {
  const nextHeaders = { ...headers };
  const accessToken = getAccessToken();

  if (includeJson && !nextHeaders["Content-Type"]) {
    nextHeaders["Content-Type"] = "application/json";
  }

  if (accessToken && !nextHeaders.Authorization) {
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  return nextHeaders;
}

function getApiBase() {
  return resolveApiBase();
}

function getPortalPath(role) {
  if (role === "admin") return "/admin/";
  if (role === "teacher") return "/teacher/";
  if (role === "pending") return "/select-role.html";
  return "/student/";
}

function getStoredAuth() {
  return {
    accessToken: localStorage.getItem(STORAGE_KEYS.accessToken),
    refreshToken: localStorage.getItem(STORAGE_KEYS.refreshToken),
    userId: localStorage.getItem(STORAGE_KEYS.userId),
    role: localStorage.getItem(STORAGE_KEYS.role),
  };
}

function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.refreshToken);
}

function persistAuth(data) {
  if (data.access_token) {
    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  }
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }
  if (data.user_id) {
    localStorage.setItem(STORAGE_KEYS.userId, data.user_id);
  }
  if (data.role) {
    localStorage.setItem(STORAGE_KEYS.role, data.role);
  }
  if (data.accessibility_prefs) {
    localStorage.setItem("casuya_accessibility_prefs", JSON.stringify(data.accessibility_prefs));
  }
}

function clearAuth() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  if (typeof clearRequestCaches === "function") clearRequestCaches();
}

function redirectToPortal(role) {
  window.location.replace(getPortalPath(role));
}

function redirectToLogin() {
  window.location.replace("/login.html");
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  let response;
  try {
    response = await fetch(buildApiUrl("/auth/refresh", "POST"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (networkError) {
    clearAuth();
    throw new Error("Network error during token refresh. Please check your connection.");
  }

  const data = safeJsonParse(await response.text()) || {};

  if (!response.ok || !data.access_token) {
    clearAuth();
    throw new Error(data.detail || "Session expired. Please sign in again.");
  }

  persistAuth(data);
  return data.access_token;
}

async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = getAuthHeaders(options.headers, !isFormData);

  const response = await fetch(buildApiUrl(path, method), {
    ...options,
    method,
    headers,
  });

  if (response.status === 401 && options.retryOnAuthFailure !== false && getRefreshToken()) {
    try {
      await refreshAccessToken();
      return apiRequest(path, { ...options, retryOnAuthFailure: false });
    } catch (error) {
      clearAuth();
      throw error;
    }
  }

  const text = await response.text();
  const data = safeJsonParse(text);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      throw new Error(data?.detail || "Session expired. Please sign in again.");
    }
    throw new Error(data?.detail || response.statusText || "Request failed");
  }

  return data ?? text;
}

async function login({ email, password, keep_logged_in = false }) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, keep_logged_in }),
    retryOnAuthFailure: false,
  });

  persistAuth(data);
  return data;
}

function requireRole(expectedRole) {
  const auth = getStoredAuth();

  if (!auth.accessToken || !auth.role) {
    clearAuth();
    redirectToLogin();
    return null;
  }

  if (expectedRole && auth.role !== expectedRole) {
    redirectToPortal(auth.role);
    return null;
  }

  return auth;
}

;
// Shared client-side role guard for the role-specific portals.
// Redirects unauthenticated users to login and users with the wrong role
// to their own portal, then signals the host page that the guard passed.

const ROLE_PORTALS = {
  admin: "/admin/",
  teacher: "/teacher/",
  student: "/student/",
  pending: "/select-role.html",
};

const AUTH_STORAGE_KEYS = [
  "casuya_token",
  "casuya_refresh_token",
  "casuya_user_id",
  "casuya_role",
];

function decodeTokenRole(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

function clearAuthData() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function guardPortal(expectedRole) {
  const token = localStorage.getItem("casuya_token");
  if (!token) {
    clearAuthData();
    window.location.replace("/login.html");
    return false;
  }
  const role = decodeTokenRole(token);
  if (!role) {
    clearAuthData();
    window.location.replace("/login.html");
    return false;
  }
  if (role !== expectedRole) {
    clearAuthData();
    const target = ROLE_PORTALS[role] || "/login.html";
    window.location.replace(target);
    return false;
  }
  return true;
}

;
// Shared accessibility toolbar — load after DOM ready
// Provides: dyslexia font, high contrast, large text, wide spacing, TTS, font size
(function () {
  var state = {
    dyslexia: false,
    highContrast: false,
    largeText: false,
    wideSpacing: false,
    tts: false,
    speechRate: 0.9,
    fontSize: 100
  };

  try {
    var saved = JSON.parse(localStorage.getItem('casuya_a11y'));
    if (saved) Object.assign(state, saved);
  } catch (e) {}

  function saveState() {
    try { localStorage.setItem('casuya_a11y', JSON.stringify(state)); } catch (e) {}
  }

  function applyState() {
    document.body.classList.toggle('dyslexia-mode', state.dyslexia);
    document.body.classList.toggle('high-contrast', state.highContrast);
    document.body.classList.toggle('large-text', state.largeText);
    document.body.classList.toggle('extra-large-text', state.fontSize >= 150 && state.fontSize < 200);
    document.body.classList.toggle('max-text', state.fontSize >= 200);
    document.body.classList.toggle('wide-spacing', state.wideSpacing);

    document.querySelectorAll('.a11y-toggle-btn').forEach(function (btn, i) {
      var vals = [state.dyslexia, state.highContrast, state.largeText, state.wideSpacing, state.tts];
      btn.classList.toggle('active', vals[i]);
    });

    var ids = ['a11y-dyslexia', 'a11y-contrast', 'a11y-large-text', 'a11y-wide-spacing', 'a11y-tts'];
    var keys = ['dyslexia', 'highContrast', 'largeText', 'wideSpacing', 'tts'];
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('aria-pressed', state[keys[i]]);
    });

    var speedRow = document.getElementById('a11y-speed-row');
    var speechCtrl = document.getElementById('speech-controls');
    if (speedRow) speedRow.style.display = state.tts ? 'flex' : 'none';
    if (speechCtrl) speechCtrl.style.display = state.tts ? 'flex' : 'none';

    var fontSlider = document.getElementById('a11y-fontsize');
    var fontLabel = document.getElementById('a11y-fontsize-label');
    if (fontSlider && fontLabel) {
      fontSlider.value = state.fontSize;
      fontLabel.textContent = state.fontSize + '%';
    }

    saveState();
  }

  applyState();

  var toggleBtn = document.getElementById('a11y-toggle-btn');
  var panel = document.getElementById('a11y-panel');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = panel.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
        panel.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
      }
    });
  }

  // Toggle handlers
  var toggleMap = {
    'a11y-dyslexia': 'dyslexia',
    'a11y-contrast': 'highContrast',
    'a11y-large-text': 'largeText',
    'a11y-wide-spacing': 'wideSpacing'
  };
  Object.keys(toggleMap).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () {
      state[toggleMap[id]] = !state[toggleMap[id]];
      applyState();
    });
  });

  var ttsBtn = document.getElementById('a11y-tts');
  if (ttsBtn) {
    ttsBtn.addEventListener('click', function () {
      state.tts = !state.tts;
      applyState();
      if (!state.tts) stopSpeech();
    });
  }

  // Font size slider
  var fontSlider = document.getElementById('a11y-fontsize');
  if (fontSlider) {
    fontSlider.addEventListener('input', function () {
      state.fontSize = parseInt(this.value);
      applyState();
    });
  }

  // Keyboard support
  document.querySelectorAll('.a11y-option').forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });

  // Speech rate slider
  var speedSlider = document.getElementById('a11y-speed');
  var speedLabel = document.getElementById('a11y-speed-label');
  if (speedSlider) {
    speedSlider.addEventListener('input', function () {
      state.speechRate = parseFloat(this.value);
      if (speedLabel) speedLabel.textContent = state.speechRate.toFixed(1) + 'x';
      saveState();
    });
  }

  function findVoice(lang) {
    if (window.__casuyaSpeech && typeof window.__casuyaSpeech.findVoice === 'function') {
      return window.__casuyaSpeech.findVoice(lang);
    }
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices();
    var preferred = lang === 'sw'
      ? ['sw-TZ', 'sw-KE', 'sw-UG', 'sw', 'en-TZ', 'en-KE']
      : ['en-TZ', 'en-KE', 'en-UG', 'en-GH', 'en-ZA', 'en-GB', 'en-US'];
    for (var i = 0; i < preferred.length; i++) {
      var match = voices.filter(function (v) { return v.lang === preferred[i]; });
      if (match.length) return match[0];
    }
    return null;
  }

  function getSelectedText() {
    var sel = window.getSelection();
    if (sel && sel.toString().trim()) return sel.toString().trim();
    return document.body.textContent.substring(0, 2000);
  }

  function stopSpeech() {
    var speechStatus = document.getElementById('speech-status');
    if (typeof casuyaStopAll === 'function') casuyaStopAll();
    else if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.controller = null;
    if (speechStatus) speechStatus.textContent = 'Done';
  }

  function speak(text) {
    stopSpeech();
    // Prefer the Casuya Sherpa-ONNX voice through the platform proxy when the
    // user is logged in; the browser voice is the fallback on public pages.
    var uiLang = null;
    try { uiLang = localStorage.getItem('casuya_lang'); } catch (e) {}
    var lang = typeof casuyaDetectLang === 'function'
      ? casuyaDetectLang(text, (uiLang === 'sw' || uiLang === 'en') ? uiLang : 'auto')
      : (uiLang === 'sw' ? 'sw' : 'en');
    if (typeof casuyaSpeakText === 'function' && casuyaIsAuthed()) {
      var speechStatus = document.getElementById('speech-status');
      state.controller = casuyaSpeakText(text, {
        lang: lang,
        rate: state.speechRate || 0.9,
        onLoading: function () { if (speechStatus) speechStatus.textContent = 'Loading audio...'; },
        onStart: function () { if (speechStatus) speechStatus.textContent = 'Speaking...'; },
        onEnd: function () { if (speechStatus) speechStatus.textContent = 'Done'; state.controller = null; },
        onError: function () { if (speechStatus) speechStatus.textContent = 'Error'; state.controller = null; }
      });
      return state.controller;
    }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var voice = findVoice(lang);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = lang === 'sw' ? 'sw-TZ' : 'en-TZ'; }
    u.rate = state.speechRate || 0.9;
    u.pitch = 1.0;
    u.volume = 1.0;
    var speechStatus = document.getElementById('speech-status');
    u.onstart = function () { if (speechStatus) speechStatus.textContent = 'Speaking...'; };
    u.onend = function () { if (speechStatus) speechStatus.textContent = 'Done'; };
    u.onerror = function () { if (speechStatus) speechStatus.textContent = 'Error'; };
    window.speechSynthesis.speak(u);
  }

  // Speech controls
  var speechPlay = document.getElementById('speech-play');
  var speechPause = document.getElementById('speech-pause');
  var speechStop = document.getElementById('speech-stop');
  if (speechPlay) {
    speechPlay.addEventListener('click', function () {
      var ctrl = state.controller;
      // API mode: resume the <audio> element; if that succeeds we're done.
      if (ctrl && typeof ctrl.resume === 'function' && ctrl.resume()) return;
      // Browser mode (or fallback): resume if paused, otherwise read fresh.
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        speak(getSelectedText());
      }
    });
  }
  if (speechPause) {
    speechPause.addEventListener('click', function () {
      // API mode: pause the <audio> element; if that succeeds we're done.
      var ctrl = state.controller;
      if (ctrl && typeof ctrl.pause === 'function' && ctrl.pause()) return;
      if (window.speechSynthesis) window.speechSynthesis.pause();
    });
  }
  if (speechStop) {
    speechStop.addEventListener('click', function () {
      stopSpeech();
    });
  }

  // Ctrl+U shortcut
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'u' && toggleBtn) {
      e.preventDefault();
      toggleBtn.click();
    }
  });

  // Preload voices
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {};
    window.speechSynthesis.getVoices();
  }

  // Expose for other scripts
  window.__casuyaA11y = { state: state, speak: speak, findVoice: findVoice };
})();

;
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
  iframe.setAttribute("sandbox", "allow-scripts allow-forms");
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

;
// modules/lesson/lesson-viewer/iframe.js — lesson iframe mount + teardown.

let _currentLessonIframe = null;
let _currentLessonCleanup = null;

function teardownCurrentIframe() {
  if (typeof _currentLessonCleanup === "function") {
    try { _currentLessonCleanup(); } catch (e) {}
    _currentLessonCleanup = null;
  }
  if (_currentLessonIframe) {
    try {
      const ivs = _currentLessonIframe.contentWindow?.casuya?._intervals || [];
      ivs.forEach(id => _currentLessonIframe.contentWindow.clearInterval(id));
    } catch(e) {}
    _currentLessonIframe = null;
  }
}

async function mountLessonIframe(container, html) {
  teardownCurrentIframe();
  const mount = container.querySelector(".lesson-iframe") || container;
  if (typeof mountLessonRuntime === "function") {
    const handle = await mountLessonRuntime(mount, html, { id: "lesson", title: "Lesson" });
    _currentLessonIframe = handle.getIframe ? handle.getIframe() : mount.querySelector("iframe");
    _currentLessonCleanup = handle.cleanup;
    return _currentLessonIframe;
  }
  if (mount.tagName === "IFRAME") {
    _currentLessonIframe = mount;
    mount.srcdoc = injectNodeBase(html);
  } else if (typeof mountGameSrcdoc === "function") {
    const handle = mountGameSrcdoc(mount, typeof injectNodeBase === "function" ? injectNodeBase(html) : html);
    _currentLessonIframe = handle.getIframe ? handle.getIframe() : mount.querySelector("iframe");
    _currentLessonCleanup = handle.cleanup;
    return _currentLessonIframe;
  }
  return _currentLessonIframe;
}

;
// modules/lesson/lesson-viewer/sections.js — lesson viewer page template.

function renderLessonSections({ lessonTitle, canBookmark, bookmarked, isStudent, quizData, gamesData, noteData, lessonId, lessonLang }) {
  return `
    <div class="content" style="max-width:100%;padding:0">
      <div style="padding:0.75rem 1rem;display:flex;align-items:center;gap:0.5rem;background:var(--color-surface);border-bottom:1px solid var(--color-border);flex-wrap:wrap">
        <button class="btn btn-primary lesson-back-btn" style="margin-bottom:0">&larr; Back</button>
        <span style="flex:1;font-weight:600;font-size:0.95rem">${escapeHtml(lessonTitle)}</span>
        <span id="lesson-listen-slot"></span>
        ${canBookmark ? `
          <button class="btn btn-sm lesson-bookmark-btn" style="${bookmarked ? 'background:var(--color-warning);color:#fff' : ''};margin-bottom:0">${bookmarked ? "★" : "☆"}</button>
        ` : ""}
        ${isStudent ? `
          <button class="btn btn-success btn-sm lesson-complete-btn" style="margin-bottom:0">Mark Complete</button>
        ` : ""}
      </div>
      <div style="width:100%">
        <div id="lesson-runtime-mount" class="lesson-iframe" style="width:100%;min-height:300px"></div>
      </div>
      ${isStudent ? `
        <div style="padding:0 1rem">
          <details style="margin-top:0.75rem">
            <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
            <div style="margin-top:0.5rem">
              <textarea id="lesson-notes" rows="4" style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:var(--radius);font-size:0.85rem">${escapeHtml(noteData?.content || "")}</textarea>
              <div style="display:flex;gap:0.35rem;align-items:center;margin-top:0.35rem">
                <button class="btn btn-sm btn-primary" id="notes-save-btn">Save Notes</button>
                <button type="button" class="casuya-record" data-target="#lesson-notes" title="Speak instead of typing" aria-label="Speak instead of typing">🎤 Voice</button>
                <span id="notes-status" style="font-size:0.8rem;color:var(--color-text-muted);margin-left:0.5rem"></span>
              </div>
            </div>
          </details>
          ${renderLessonQuiz(quizData, lessonId, lessonLang)}
          ${renderLessonGames(gamesData)}
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
            <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}
;
// modules/lesson/lesson-viewer/interactions.js — wires up all lesson-viewer buttons & listeners.

function bindLessonInteractions({ container, iframe, lessonId, isStudent, canBookmark, quizData, state, showToast, sendProgress, onMessage, backFn, lesson, lessonContent }) {
  window.__casuyaQuizLessonMeta = {
    lessonId: lessonId,
    title: lesson && lesson.title,
    subject_slug: lesson && lesson.subject_slug,
    form_level: lesson && lesson.form_level,
    topic: lesson && lesson.topic_title,
    subtopic: lesson && lesson.subtopic_title,
  };
  if (isStudent) {
    const completeBtn = container.querySelector(".lesson-complete-btn");
    if (completeBtn) {
      completeBtn.addEventListener("click", () => {
        sendProgress(100, null);
        completeBtn.textContent = "✓ Complete!";
        completeBtn.disabled = true;
        completeBtn.style.opacity = "0.6";
      });
    }

    // Bookmark toggle
    const bmBtn = container.querySelector(".lesson-bookmark-btn");
    if (bmBtn) {
      bmBtn.addEventListener("click", async () => {
        try {
          if (state.bookmarked) {
            await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
            state.bookmarked = false; bmBtn.textContent = "☆"; bmBtn.style.background = "";
            showToast("Bookmark removed");
          } else {
            await request(`/bookmarks/${lessonId}`, { method: "POST" });
            state.bookmarked = true; bmBtn.textContent = "★"; bmBtn.style.background = "var(--color-warning)"; bmBtn.style.color = "#fff";
            showToast("Bookmarked!");
          }
        } catch(e) { showToast("Failed to update bookmark"); }
      });
    }

    // Notes save
    document.getElementById("notes-save-btn")?.addEventListener("click", async () => {
      const content = document.getElementById("lesson-notes")?.value || "";
      const status = document.getElementById("notes-status");
      try {
        await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
        status.textContent = "Saved ✓";
        setTimeout(() => status.textContent = "", 2000);
      } catch(e) { status.textContent = "Failed to save"; }
    });

    // Quiz submission — now wired to Show your work blackboards
    document.getElementById("quiz-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("quiz-submit-btn");
      btn.disabled = true; btn.textContent = "Submitting...";
      const answers = {};
      if (quizData && quizData.questions) {
        quizData.questions.forEach(q => {
          const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
          if (sel) answers[q.id] = sel.value;
        });
      }
      // Collect Show your work snapshots per question
      let work = null;
      try {
        if (window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.collectWorkMap) {
          work = window.CasuyaBlackboardEmbed.collectWorkMap("[data-quiz-question]");
        } else {
          work = {};
          document.querySelectorAll("[data-quiz-question]").forEach(el => {
            const qid = el.dataset.quizQuestion;
            const bb = el._casuyaBlackboard;
            if (bb && bb.getWorkSnapshot) work[qid] = bb.getWorkSnapshot();
            else if (bb && bb.getElements) { const els = bb.getElements(); work[qid] = { elements: els, hasWork: els.length>0, recognizedLatex: els.length>0?"__drawing__":"" }; }
          });
        }
        if (work && Object.keys(work).length === 0) work = null;
      } catch {}
      try {
        const body = work ? { answers, work } : { answers };
        const result = await request(`/quizzes/${quizData.id}/submit`, {
          method: "POST", body: JSON.stringify(body),
        });
        const el = document.getElementById("quiz-result");
        el.style.display = "block";
        const pct = result.combined_percentage != null ? result.combined_percentage : result.percentage;
        const hasWork = result.work_score != null;
        el.innerHTML = `
          <p style="font-weight:600">Score: ${result.score} / ${result.total} (${Math.round(result.percentage)}%)</p>
          ${hasWork ? `<p style="font-size:0.85rem;color:var(--color-text-muted)">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · Combined (70% answer + 30% work): <strong>${Math.round(pct)}%</strong></p>` : ``}
          ${pct >= 50 ? '<p style="color:var(--color-success)">✅ Passed!</p>' : '<p style="color:red">❌ Try again</p>'}
          ${hasWork && result.work_score < result.work_total ? '<p style="font-size:0.8rem;color:var(--color-text-muted)">Tip: open "Show your work" on each question to earn work credit.</p>' : ''}
        `;
        if (pct < 50 && Array.isArray(result.wrong_questions) && result.wrong_questions.length && typeof mountLessonQuizTutor === "function") {
          mountLessonQuizTutor(el, result.wrong_questions, {
            lessonId: lessonId,
            lesson: lesson,
            lessonTitle: lesson && lesson.title,
            lessonContent: lessonContent,
            subject_slug: lesson && lesson.subject_slug,
            form_level: lesson && lesson.form_level,
            topic: lesson && lesson.topic_title,
            subtopic: lesson && lesson.subtopic_title,
          });
        }
        sendProgress(100, pct);
        state.quizScoreSent = true;
      } catch(err) {
        document.getElementById("quiz-result").style.display = "block";
        document.getElementById("quiz-result").innerHTML = `<p style="color:red">Error: ${escapeHtml(err.message)}</p>`;
      }
      btn.disabled = false; btn.textContent = "Submit Quiz";
    });
  }

  // Mount blackboard (if embed script is present)
  if (window.CasuyaBlackboardEmbed) {
    window.CasuyaBlackboardEmbed.autoMount();
  }

  document.querySelectorAll(".game-item").forEach(item => {
    item.addEventListener("click", async () => {
      const gameId = item.dataset.gameId;
      const area = document.getElementById("game-content-area");
      if (!area) return;
      area.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>';
      try {
        const html = typeof loadGameHtml === "function" ? await loadGameHtml(gameId) : "";
        if (!html) throw new Error("Failed to load game content");
        area.innerHTML = `<iframe style="width:100%;min-height:400px;border:none;border-radius:var(--radius)" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>`;
      } catch(err) {
        area.innerHTML = `<p style="color:var(--color-danger)">Error loading game: ${escapeHtml(err.message)}</p>`;
      }
    });
  });

  const backBtn = container.querySelector(".lesson-back-btn");
  backBtn.addEventListener("click", () => {
    if (isStudent && !state.quizScoreSent) sendProgress(80, null);
    window.removeEventListener("message", onMessage);
    if (state.progressTimer) clearTimeout(state.progressTimer);
    teardownCurrentIframe();
    backFn();
  });
}
;
// modules/lesson/lesson-viewer/viewer.js — lesson viewer orchestrator.
// Extracted from modules/lesson-viewer.js; viewers for quiz/games, the bridge
// script and blackboard helpers live in modules/lesson/lesson-content.js.

async function viewLessonContent(containerId, lessonId, backFn) {
  const container = document.querySelector(containerId);
  if (!container) return;

  teardownCurrentIframe();

  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>`;

  try {

    const token = localStorage.getItem("casuya_token");
    const payload = decodeToken(token);
    const isStudent = payload?.role === "student";
    const canBookmark = isStudent || payload?.role === "teacher";

    let htmlPromise = typeof loadLessonHtml === "function" ? loadLessonHtml(lessonId) : null;

    // Fetch lesson metadata + bookmark/quiz/games in ONE call (P2-3 aggregated endpoint)
    let lessonMeta = {};
    let pkgData = null;
    try {
      if (canBookmark) {
        pkgData = await request(`/lessons/${lessonId}/package`);
        lessonMeta = pkgData.lesson || {};
      } else {
        lessonMeta = await request(`/lessons/${lessonId}`);
      }
    } catch(e) {}
    const lessonTitle = lessonMeta.title || "Lesson";

    // Update recently viewed title
    let _recent = [];
    try {
      _recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      const idx = _recent.findIndex(r => r.id === lessonId);
      if (idx >= 0) { _recent[idx].title = lessonTitle; localStorage.setItem("casuya_recently_viewed", JSON.stringify(_recent)); }
    } catch(e) {}

    let html = htmlPromise ? await htmlPromise : "";
    if (!html) {
      const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content${typeof lessonContentQuery === "function" ? lessonContentQuery() : ""}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      });
      if (resp.status === 404) {
        const filtered = _recent.filter(r => r.id !== lessonId);
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        container.innerHTML = '<div class="empty-state"><p>This lesson is no longer available.</p></div>';
        return;
      }
      if (!resp.ok) throw new Error("Failed to load lesson");
      html = await resp.text();
      if (typeof cacheLessonContent === "function") cacheLessonContent(lessonId, html);
    }
    if (!html) {
      const filtered = _recent.filter(r => r.id !== lessonId);
      localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
      container.innerHTML = '<div class="empty-state"><p>This lesson is no longer available.</p></div>';
      return;
    }

    const lessonStart = Date.now();
    let studentId = null;
    const sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    const state = { quizScoreSent: false, bookmarked: false, progressTimer: null };

    if (isStudent) {
      try {
        const me = await request("/students/me");
        if (me && me.id) studentId = me.id;
      } catch(e) {}
    }

    function showToast(msg) {
      let t = container.querySelector(".lesson-toast");
      if (!t) { t = document.createElement("div"); t.className = "lesson-toast"; t.style.cssText = "position:sticky;bottom:0;padding:0.5rem 1rem;background:var(--color-success);color:#fff;text-align:center;font-size:0.85rem;transition:opacity 0.3s;z-index:10"; container.appendChild(t); }
      t.textContent = msg; t.style.opacity = "1";
      clearTimeout(t._hide); t._hide = setTimeout(() => { t.style.opacity = "0"; }, 2500);
    }

    function sendProgress(completionPct, scorePct) {
      if (!isStudent || !studentId) return;
      if (completionPct <= state.lastSentCompletion && (scorePct == null || scorePct <= state.lastSentScore)) return;
      state.lastSentCompletion = Math.max(state.lastSentCompletion || 0, completionPct);
      if (scorePct != null) state.lastSentScore = Math.max(state.lastSentScore || -1, scorePct);
      if (state.progressTimer) clearTimeout(state.progressTimer);
      state.progressTimer = setTimeout(() => {
        const elapsed = Date.now() - lessonStart;
        request("/progress/sync", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            lesson_id: lessonId,
            session_id: sessionId,
            elapsed_ms: elapsed,
            completion_percentage: state.lastSentCompletion,
            score_percentage: state.lastSentScore >= 0 ? state.lastSentScore : null,
          }),
        }).then(() => showToast("Progress saved")).catch(() => {});
      }, 2000);
    }

    // Use pkgData from the earlier aggregated call (P2-3) — no second request needed.
    let quizData = null;
    let gamesData = [];
    let noteData = { content: "" };
    if (pkgData) {
      state.bookmarked = pkgData.bookmark_status?.bookmarked || false;
      quizData = isStudent ? pkgData.quiz : null;
      gamesData = isStudent ? (pkgData.games || []) : [];
      noteData = isStudent ? (pkgData.note || { content: "" }) : { content: "" };
    }

    const initialLessonLang = typeof casuyaResolveLessonLang === "function"
      ? casuyaResolveLessonLang(lessonTitle, "", quizData?.questions?.[0]?.prompt)
      : (typeof casuyaDetectLang === "function"
        ? casuyaDetectLang(String(lessonTitle || "") + " " + String(quizData?.questions?.[0]?.prompt || ""))
        : "sw");

    container.innerHTML = renderLessonSections({
      lessonTitle, canBookmark, bookmarked: state.bookmarked, isStudent, quizData, gamesData, noteData, lessonId,
      lessonLang: initialLessonLang,
    });

    const iframe = await mountLessonIframe(container, html);

    // Listen button: reads the lesson title + spoken content using the Casuya
    // TTS voice (browser voice fallback on failure / logged-out use).
    if (typeof casuyaAttachListen === "function") {
      const listenSlot = container.querySelector("#lesson-listen-slot");
      if (listenSlot) {
        const bodySample = typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : "";
        const lessonLang = typeof casuyaResolveLessonLang === "function"
          ? casuyaResolveLessonLang(lessonTitle, bodySample, quizData?.questions?.[0]?.prompt)
          : initialLessonLang;
        container.querySelectorAll(".question-block[data-lesson-lang], .quiz-item .casuya-listen[data-lang]").forEach(function (el) {
          el.setAttribute("data-lang", lessonLang);
          if (el.classList.contains("question-block")) el.setAttribute("data-lesson-lang", lessonLang);
        });
        casuyaAttachListen(listenSlot, {
          title: "Listen to this lesson",
          lang: lessonLang,
          textProvider: function () {
            const body = typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : "";
            return (lessonTitle + ". " + body).trim();
          }
        });
      }
    }

    const onMessage = (e) => {
      if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
        state.quizScoreSent = true;
        const pct = Math.round((e.data.score / e.data.total) * 100);
        sendProgress(100, pct);
      } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
        sendProgress(e.data.percent, null);
      }
    };
    window.addEventListener("message", onMessage);

    bindLessonInteractions({
      container,
      iframe,
      lessonId,
      isStudent,
      canBookmark,
      quizData,
      state,
      showToast,
      sendProgress,
      onMessage,
      backFn,
      lesson: lessonMeta,
      lessonContent: html,
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}
;
// modules/lesson.js — backward-compatible facade (classic script, shared global scope).
// The lesson viewer was split into focused modules:
//   - modules/lesson/lesson-content.js  (bridge script + quiz/games section builders)
//   - modules/lesson/lesson-viewer/     (viewLessonContent implementation + helpers)
// This file is kept so existing bundle lists / script tags continue to resolve the
// same module id. The sub-modules must be loaded before this file.
;
// modules/api-client/core/test-generator.js — Test Generator UI (shared global scope).
// Shared by admin, teacher, and student dashboards. Renders the picker of exam
// types (Topical/Monthly/Midterm/Terminal/Annual/NECTA Form II/IV/VI) plus a
// subject/form/topic form, then calls POST /ai/tests/generate (grounded in the
// NECTA/TIE knowledge base at low temperature) and renders the result with the
// shared quiz renderer.

const TEST_TYPE_OPTIONS = [
  { value: "topical", label: "📌 Topical Test", desc: "Topical questions grouped by topic." },
  { value: "monthly", label: "📆 Monthly Test", desc: "Monthly-style test for your class." },
  { value: "midterm", label: "🕘 Midterm Test", desc: "Midterm examination style." },
  { value: "terminal", label: "🏁 Terminal Test", desc: "Terminal examination style." },
  { value: "annual", label: "📅 Annual Test", desc: "Annual examination style." },
  { value: "necta_ii", label: "🎓 NECTA Form II", desc: "Form II / FTNA style questions." },
  { value: "necta_iv", label: "🎓 NECTA Form IV", desc: "CSEE Section A style questions." },
  { value: "necta_vi", label: "🎓 NECTA Form VI", desc: "ACSEE style questions." },
];

let _testGenStylesInjected = false;

function _injectTestGenStyles() {
  if (_testGenStylesInjected || document.getElementById("test-gen-styles")) return;
  _testGenStylesInjected = true;
  const style = document.createElement("style");
  style.id = "test-gen-styles";
  style.textContent = `
    .test-type-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem}
    .test-type-card{text-align:left;padding:0.7rem 0.85rem;border:1px solid var(--color-border);border-radius:var(--radius);background:transparent;cursor:pointer;transition:border-color .15s ease,background .15s ease}
    .test-type-card:hover{border-color:var(--color-primary)}
    .test-type-card.selected{border-color:var(--color-primary);background:color-mix(in srgb,var(--color-primary) 8%,transparent);box-shadow:inset 0 0 0 1px var(--color-primary)}
  `;
  document.head.appendChild(style);
}

function renderTestGeneratorView(meta = {}) {
  _injectTestGenStyles();
  const title = meta.title || "Test Generator";
  const intro = meta.intro || "Pick an exam type, then choose a subject and form. Tick the topics (and sub-topics) the exam must cover — the more you tick, the wider the paper. The system reads the NECTA/TIE knowledge base (past papers, syllabuses) to generate fresh practice questions without copying any past question.";
  const typeCards = TEST_TYPE_OPTIONS.map((t, i) => `
    <button type="button" class="test-type-card${i === 0 ? " selected" : ""}" data-test-type="${t.value}">
      <div style="font-weight:600;font-size:0.95rem">${t.label}</div>
      <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.15rem">${t.desc}</div>
    </button>`).join("");

  return `
    <div class="content">
      <h2 style="margin:0 0 0.4rem">📝 ${escapeHtml(title)}</h2>
      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:1.25rem">${escapeHtml(intro)}</p>

      <div class="card" style="padding:1.25rem;margin-bottom:1rem">
        <h3 style="margin:0 0 0.75rem">1. Choose the exam type</h3>
        <div class="test-type-grid">${typeCards}</div>
      </div>

      <div class="card" style="padding:1.25rem;margin-bottom:1rem">
        <h3 style="margin:0 0 1rem">2. Scope the test</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem">
          <div>
            <label style="font-size:0.8rem;color:var(--color-text-muted)">Subject</label>
            <select class="input" id="test-gen-subject">
              <option value="mathematics">Mathematics</option>
              <option value="chemistry">Chemistry</option>
              <option value="physics">Physics</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.8rem;color:var(--color-text-muted)">Form Level</label>
            <select class="input" id="test-gen-form">
              ${["I","II","III","IV","V","VI"].map((f, i) => `<option value="${i+1}">Form ${f}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:0.8rem;color:var(--color-text-muted)">Questions</label>
            <select class="input" id="test-gen-count">
              ${[5,10,15,20].map(n => `<option value="${n}"${n === 10 ? " selected" : ""}>${n}</option>`).join("")}
            </select>
          </div>
        </div>
        <div style="margin-top:1.1rem">
          <label style="font-size:0.8rem;color:var(--color-text-muted)">Topics &amp; sub-topics to cover
            <span style="color:var(--color-text-muted);font-weight:400">(tick topics and sub-topics — the more you tick, the wider the exam)</span>
          </label>
          <div id="test-gen-scope" style="margin-top:0.6rem"></div>
          <div id="test-gen-scope-summary" style="font-size:0.8rem;color:var(--color-text-muted);font-weight:600;margin-top:0.5rem"></div>
          <div id="test-gen-fallback" style="display:none;margin-top:0.6rem;font-size:0.85rem">
            <label style="color:var(--color-text-muted)">Topic</label>
            <input class="input" id="test-gen-topic-fallback" placeholder="e.g. Acids, Bases and Salts">
            <label style="color:var(--color-text-muted);display:block;margin-top:0.4rem">Subtopic</label>
            <input class="input" id="test-gen-subtopic-fallback" placeholder="e.g. Preparation of Salts">
          </div>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem">
        <button class="btn btn-primary" id="test-gen-run">⚡ Generate Test</button>
        <span id="test-gen-status" style="font-size:0.8rem;color:var(--color-text-muted)"></span>
      </div>

      <div id="test-gen-sources"></div>
      <div id="test-gen-results"></div>
    </div>`;
}

let _testGenScopeCache = {};

function _testGenUpdateSummary(root) {
  const summary = root.querySelector("#test-gen-scope-summary");
  if (!summary) return;
  const topics = Array.from(root.querySelectorAll(".test-gen-topic-cb:checked")).length;
  const subs = Array.from(root.querySelectorAll(".test-gen-subtopic-cb:checked")).length;
  if (!topics && !subs) {
    summary.textContent = "";
    return;
  }
  summary.textContent = `Scope: ${topics} topic${topics === 1 ? "" : "s"} · ${subs} sub-topic${subs === 1 ? "" : "s"} selected`;
}

async function _testGenLoadScope(subject, form) {
  const root = document;
  const scopeEl = root.querySelector("#test-gen-scope");
  const fallbackEl = root.querySelector("#test-gen-fallback");
  if (!scopeEl) return;
  scopeEl.innerHTML = '<p style="font-size:0.85rem;color:var(--color-text-muted)">Loading topics from the syllabus…</p>';
  fallbackEl.style.display = "none";
  _testGenUpdateSummary(root);

  let topics = [];
  const cacheKey = subject + ":" + form;
  if (_testGenScopeCache[cacheKey]) {
    topics = _testGenScopeCache[cacheKey];
  } else {
    try {
      const res = await request(`/syllabus/subjects/${encodeURIComponent(subject)}/topics?form_level=${form}`);
      topics = Array.isArray(res) ? res : [];
      _testGenScopeCache[cacheKey] = topics;
    } catch (e) {
      topics = [];
    }
  }

  if (!topics.length) {
    scopeEl.innerHTML = '<p style="font-size:0.85rem;color:var(--color-text-muted)">No syllabus topics found for this subject and form. Type the topic below instead.</p>';
    fallbackEl.style.display = "block";
    _testGenUpdateSummary(root);
    return;
  }

  const items = topics.map((t) => {
    const subs = Array.isArray(t.subtopics) ? t.subtopics : [];
    const subLabels = subs
      .map((s) => `
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;margin-top:0.2rem">
          <input type="checkbox" class="test-gen-subtopic-cb" data-topic="${escapeHtml(t.title)}" value="${escapeHtml(s.title)}">
          <span>${escapeHtml(s.title)}</span>
        </label>`)
      .join("");
    const toggle = subs.length
      ? `<button type="button" class="test-gen-sub-toggle" style="margin-left:auto;background:none;border:none;color:var(--color-primary);font-size:0.75rem;cursor:pointer">${subs.length} sub-topic${subs.length === 1 ? "" : "s"} ▾</button>`
      : "";
    return `
      <div class="scope-topic-item" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.5rem 0.75rem;margin-bottom:0.4rem">
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.88rem;cursor:pointer">
          <input type="checkbox" class="test-gen-topic-cb" value="${escapeHtml(t.title)}">
          <span>${escapeHtml(t.title)}</span>
          ${toggle}
        </label>
        ${subs.length ? `<div class="test-gen-sub-wrap" style="display:none;margin-top:0.35rem;border-top:1px dashed var(--color-border);padding-top:0.3rem">${subLabels}</div>` : ""}
      </div>`;
  }).join("");

  scopeEl.innerHTML = `
    <div style="font-size:0.8rem;margin-bottom:0.5rem">
      <button type="button" class="test-gen-select-all" style="background:none;border:none;color:var(--color-primary);cursor:pointer">Select all topics</button>
      <button type="button" class="test-gen-clear-all" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;margin-left:0.75rem">Clear all</button>
    </div>
    ${items}`;
  _testGenUpdateSummary(root);
}

function initTestGeneratorView(root = document) {
  const cards = Array.from(root.querySelectorAll(".test-type-card"));
  let selected = (root.querySelector(".test-type-card.selected")?.dataset.testType) || "topical";
  cards.forEach((c) => {
    c.addEventListener("click", () => {
      cards.forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
      selected = c.dataset.testType;
    });
  });

  const statusEl = root.querySelector("#test-gen-status");
  const sourcesEl = root.querySelector("#test-gen-sources");
  const resultsEl = root.querySelector("#test-gen-results");
  const runBtn = root.querySelector("#test-gen-run");
  if (!runBtn) return;

  const subjectEl = root.querySelector("#test-gen-subject");
  const formEl = root.querySelector("#test-gen-form");

  const reloadScope = () => {
    const subject = subjectEl.value;
    const form = formEl.value || "1";
    _testGenLoadScope(subject, form);
  };
  subjectEl.addEventListener("change", reloadScope);
  formEl.addEventListener("change", reloadScope);

  const scopeEl = root.querySelector("#test-gen-scope");
  if (scopeEl) {
    scopeEl.addEventListener("change", (e) => {
      if (e.target.matches(".test-gen-topic-cb")) _testGenUpdateSummary(root);
      if (e.target.matches(".test-gen-subtopic-cb")) _testGenUpdateSummary(root);
    });
    scopeEl.addEventListener("click", (e) => {
      const toggle = e.target.closest(".test-gen-sub-toggle");
      if (toggle) {
        e.preventDefault();
        const wrap = toggle.closest(".scope-topic-item")?.querySelector(".test-gen-sub-wrap");
        if (wrap) {
          wrap.style.display = wrap.style.display === "none" ? "block" : "none";
          toggle.textContent = wrap.style.display === "none"
            ? toggle.textContent.replace("▴", "▾")
            : toggle.textContent.replace("▾", "▴");
        }
        return;
      }
      const selectAll = e.target.closest(".test-gen-select-all");
      if (selectAll) {
        const scope = root.querySelector("#test-gen-scope");
        Array.from(scope.querySelectorAll(".test-gen-topic-cb")).forEach((t) => {
          t.checked = true;
          const wrap = t.closest(".scope-topic-item")?.querySelector(".test-gen-sub-wrap");
          if (wrap) wrap.style.display = "block";
        });
        _testGenUpdateSummary(root);
        return;
      }
      const clearAll = e.target.closest(".test-gen-clear-all");
      if (clearAll) {
        const scope = root.querySelector("#test-gen-scope");
        Array.from(scope.querySelectorAll(".test-gen-topic-cb, .test-gen-subtopic-cb")).forEach((t) => { t.checked = false; });
        _testGenUpdateSummary(root);
      }
    });
  }

  runBtn.addEventListener("click", async () => {
    const subject = subjectEl.value;
    const form = formEl.value || "1";
    const count = Number(root.querySelector("#test-gen-count").value);

    const topics = Array.from(root.querySelectorAll(".test-gen-topic-cb:checked")).map((t) => t.value.trim());
    const subtopics = Array.from(root.querySelectorAll(".test-gen-subtopic-cb:checked")).map((s) => s.value.trim());
    const fallbackTopic = root.querySelector("#test-gen-topic-fallback")?.value.trim() || "";
    const fallbackSubtopic = root.querySelector("#test-gen-subtopic-fallback")?.value.trim() || "";

    if (!topics.length && !subtopics.length && !fallbackTopic) {
      statusEl.textContent = "Tick at least one topic (or sub-topic), then press Generate.";
      return;
    }
    const topic = topics[0] || fallbackTopic;
    const subtopic = subtopics[0] || fallbackSubtopic;

    runBtn.disabled = true;
    statusEl.textContent = "Reading knowledge base and generating questions...";
    sourcesEl.innerHTML = "";
    resultsEl.innerHTML = "";
    try {
      const data = await request("/ai/tests/generate", {
        method: "POST",
        body: JSON.stringify({
          test_type: selected,
          subject_slug: subject,
          form_level: Number(form),
          topic,
          subtopic,
          topics,
          subtopics,
          count,
        }),
      });
      if (!Array.isArray(data.questions) || !data.questions.length) {
        resultsEl.innerHTML = '<div class="card" style="padding:1rem"><p style="color:var(--color-text-muted)">No questions were generated. Try a different topic, subject, or exam type.</p></div>';
        statusEl.textContent = "";
        return;
      }
      const label = data.testTypeLabel || selected;
      const hits = Array.isArray(data.kbHits) ? data.kbHits : [];
      const footerPayload = {
        source: data.source || "casuya-ai",
        kbHits: hits,
        sourced: data.grounded !== false,
      };
      sourcesEl.innerHTML = `
        <div class="card" style="padding:0.75rem 1rem;margin-bottom:1rem">
          <p style="font-size:0.8rem;margin:0 0 0.35rem;color:var(--color-text-muted)">
            📚 <strong>${escapeHtml(label)}</strong> — grounded in ${hits.length || "syllabus"} knowledge-base source(s)
            ${data.grounded ? "" : " (syllabus/topic fallback)"}
          </p>
          <div class="tutor-response-footer">
            ${typeof renderAiResultFooter === "function"
              ? renderAiResultFooter(footerPayload)
              : (typeof renderTutorSourceChips === "function" ? renderTutorSourceChips(hits) : "")
                + (typeof renderAiSourceBadge === "function" ? renderAiSourceBadge(footerPayload.source) : "")}
          </div>
        </div>`;
      resultsEl.innerHTML = renderQuizQuestions(data.questions, {
        subject,
        formLevel: data.formLevel,
        topic: `${topic}${topics.length + subtopics.length ? ` (+${Math.max(0, topics.length + subtopics.length - 1)} more)` : ""}`,
      });
      statusEl.textContent = `Done — ${data.count || data.questions.length} question(s).`;
    } catch (e) {
      resultsEl.innerHTML = `<div class="card" style="padding:1rem"><p style="color:var(--color-danger)">${escapeHtml(e.message || "Generation failed. Please try again.")}</p></div>`;
      statusEl.textContent = "";
    } finally {
      runBtn.disabled = false;
    }
  });

  reloadScope();
}
;
// modules/admin-dashboard.js — extracted from main.js (classic script, shared global scope)
function showAdminView(content) {
  const el = document.getElementById("admin-content");
  if (!el) return;
  el.innerHTML = content;
}

async function renderAdminDashboard() {
  const token = localStorage.getItem("casuya_token");
  const payload = decodeToken(token);

  render("#app", `
    <div class="sidebar-layout">
      <aside id="admin-sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2>Casuya Admin</h2>
          <p>${escapeHtml(payload.full_name || payload.email || "Admin")}</p>
        </div>
        <nav class="sidebar-nav" id="admin-nav">
          <div class="sidebar-nav-item active" data-view="dashboard">📊 Dashboard</div>
          <div class="sidebar-nav-item" data-view="subjects">📚 Subjects</div>
          <div class="sidebar-nav-item" data-view="topics">📁 Topics</div>
          <div class="sidebar-nav-item" data-view="subtopics">📂 Subtopics</div>
          <div class="sidebar-nav-item" data-view="lessons">📝 Lessons</div>
          <div class="sidebar-nav-item" data-view="quizzes">❓ Quizzes</div>
          <div class="sidebar-nav-item" data-view="test-generator">📝 Test Generator</div>
          <div class="sidebar-nav-item" data-view="games">🎮 Games</div>
          <div class="sidebar-nav-item" data-view="users">👥 Users</div>
          <div class="sidebar-nav-item" data-view="progress">📈 Progress</div>
          <div class="sidebar-nav-item" data-view="analytics">📉 Analytics</div>
          <div class="sidebar-nav-item" data-view="ai-quality">🤖 AI Tutor</div>
          <div class="sidebar-nav-item" data-view="payments">💳 Payments</div>
          <div class="sidebar-nav-item" data-view="notifications">🔔 Notifications</div>
          <div class="sidebar-nav-item" data-view="uploads">📤 Uploads</div>
          <div class="sidebar-nav-item" data-view="library">📖 Reference Library</div>
          <div class="sidebar-nav-item" data-view="branding">🎨 Branding</div>
          <div class="sidebar-nav-item" data-view="settings">⚙️ Settings</div>
        </nav>
        <div class="sidebar-footer">
          <button id="admin-logout" class="btn btn-danger" style="width:100%;font-size:0.85rem">Sign Out</button>
        </div>
      </aside>
      <main class="main-content">
        <header class="main-header">
          <button id="sidebar-toggle" class="sidebar-toggle-btn">&#9776;</button>
          <div style="position:relative;flex:1;max-width:360px">
            <input id="admin-search" type="search" class="input" placeholder="Search users, lessons..." style="padding:0.4rem 0.75rem;font-size:0.85rem">
            <div id="admin-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);z-index:100;max-height:300px;overflow-y:auto"></div>
          </div>
        </header>
        <div id="admin-content" class="main-body"></div>
      </main>
    </div>
  `);

  document.getElementById("admin-logout").addEventListener("click", handleLogout);

  // Sidebar toggle (mobile)
  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("admin-sidebar").classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#admin-sidebar") && !e.target.closest("#sidebar-toggle")) {
      document.getElementById("admin-sidebar")?.classList.remove("open");
    }
  }, { signal: _globalAbort.signal });

  // Admin search
  const adminSearchInput = document.getElementById("admin-search");
  const adminSearchResults = document.getElementById("admin-search-results");
  let searchTimer;
  let searchSeq = 0;

  adminSearchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = adminSearchInput.value.trim();
    if (q.length < 2) { adminSearchResults.style.display = "none"; return; }
    const mySeq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
        if (mySeq !== searchSeq) return; // stale response, discard
        if (!Array.isArray(results) || results.length === 0) {
          adminSearchResults.innerHTML = '<div style="padding:0.5rem;color:var(--color-text-muted)">No results</div>';
        } else {
          adminSearchResults.innerHTML = results.map(u => `
            <div class="admin-search-item" data-id="${escapeHtml(u.id)}" data-type="${escapeHtml(u.type)}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between">
              <span>${escapeHtml(u.title || u.email)}</span>
              <span style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(u.type)}</span>
            </div>
          `).join("");
          adminSearchResults.querySelectorAll(".admin-search-item").forEach(el => {
            el.addEventListener("click", () => {
              adminSearchResults.style.display = "none";
              adminSearchInput.value = "";
              if (el.dataset.type === "student" || el.dataset.type === "teacher") loadAdminUsers();
              else if (el.dataset.type === "lesson") loadAdminLessons();
              else loadAdminSubjects();
            });
          });
        }
        adminSearchResults.style.display = "block";
      } catch(e) { adminSearchResults.style.display = "none"; }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#admin-search") && !e.target.closest("#admin-search-results")) adminSearchResults.style.display = "none";
  }, { signal: _globalAbort.signal });

  // Navigation
  const _adminNavItems = document.querySelectorAll("#admin-nav .sidebar-nav-item");
  function setActiveNav(viewId) {
    _adminNavItems.forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  const navHandlers = {
    dashboard: () => { setActiveNav("dashboard"); loadAdminOverview(); },
    subjects: () => { setActiveNav("subjects"); loadAdminSubjects(); },
    topics: () => { setActiveNav("topics"); loadAdminTopics(); },
    subtopics: () => { setActiveNav("subtopics"); loadAdminSubtopics(); },
    lessons: () => { setActiveNav("lessons"); loadAdminLessons(); },
    quizzes: () => { setActiveNav("quizzes"); loadAdminQuizzes(); },
    "test-generator": () => { setActiveNav("test-generator"); loadAdminTestGenerator(); },
    games: () => { setActiveNav("games"); loadAdminGames(); },
    users: () => { setActiveNav("users"); loadAdminUsers(); },
    progress: () => { setActiveNav("progress"); loadAdminProgress(); },
    analytics: () => { setActiveNav("analytics"); loadAdminAnalytics(); },
    "ai-quality": () => { setActiveNav("ai-quality"); loadAdminAiQuality(); },
    payments: () => { setActiveNav("payments"); loadAdminPayments(); },
    notifications: () => { setActiveNav("notifications"); loadAdminNotifications(); },
    uploads: () => { setActiveNav("uploads"); loadAdminUploads(); },
    library: () => { setActiveNav("library"); loadAdminLibrary(); },
    branding: () => { setActiveNav("branding"); loadAdminBranding(); },
    settings: () => { setActiveNav("settings"); loadAdminSettings(); },
  };

  function navigateTo(view) {
    if (navHandlers[view]) {
      location.hash = view;
      navHandlers[view]();
    }
  }

  document.querySelectorAll("#admin-nav .sidebar-nav-item").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("admin-sidebar")?.classList.remove("open");
      navigateTo(el.dataset.view);
    });
  });

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "dashboard";
    if (navHandlers[view]) navHandlers[view]();
  });


;
// modules/admin-dashboard/01-overview/greeting.js — admin overview greeting + KPIs + quick actions

  async function loadAdminOverview() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const overview = await request("/analytics/overview");
      const name = payload.full_name || payload.email || "Admin";

      // Greeting based on time
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      showAdminView(`
        <div class="content" style="max-width:960px">
          <!-- Welcome Banner -->
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}</h2>
            <p>Here's your platform overview at a glance.</p>
          </div>

          <!-- Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">👥</div>
              <div class="stat-value">${overview?.total_students ?? 0}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">👩‍🏫</div>
              <div class="stat-value">${overview?.total_teachers ?? 0}</div>
              <div class="stat-label">Teachers</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">📝</div>
              <div class="stat-value">${overview?.total_lessons ?? 0}</div>
              <div class="stat-label">Lessons</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">❓</div>
              <div class="stat-value">${overview?.total_quizzes ?? 0}</div>
              <div class="stat-label">Quizzes</div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="section-header">
            <h3>Quick Actions</h3>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem">
            <div class="recent-lesson-card" data-nav="subjects" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">📚</div>
              <h4 style="margin:0">Manage Subjects</h4>
            </div>
            <div class="recent-lesson-card" data-nav="lessons" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">📝</div>
              <h4 style="margin:0">Manage Lessons</h4>
            </div>
            <div class="recent-lesson-card" data-nav="users" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">👥</div>
              <h4 style="margin:0">Manage Users</h4>
            </div>
            <div class="recent-lesson-card" data-nav="progress" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">📈</div>
              <h4 style="margin:0">View Progress</h4>
            </div>
          </div>
        </div>
      `);

      // Wire up quick action clicks
      document.querySelectorAll("#admin-content .recent-lesson-card[data-nav]").forEach(el => {
        el.addEventListener("click", () => {
          const view = el.dataset.nav;
          if (navHandlers[view]) navHandlers[view]();
        });
      });
    } catch (err) {
      showAdminView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }
;
// modules/admin-dashboard/01-overview/kpi.js — admin subjects & topics management

  async function loadAdminSubjects() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const list = Array.isArray(subjects) ? subjects : [];
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Subjects</h2>
            <button class="btn btn-primary" id="add-subject-btn">+ Add Subject</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No subjects yet</p></div>' :
              list.map(s => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(s.name)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(s.slug || "")}</p>
                    </div>
                    ${deleteBtn(s.id, s.name, "/subjects")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.getElementById("add-subject-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Subject</h3>
            <form id="create-subject-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <input class="input" name="name" placeholder="Subject name (e.g. Mathematics)" required>
              <input class="input" name="slug" placeholder="Slug (e.g. mathematics)" required>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-subject-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/subjects", { method: "POST", body: JSON.stringify({ name: fd.get("name"), slug: fd.get("slug") }) });
            loadAdminSubjects();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminTopics(card.dataset.id, card.dataset.name);
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }

  async function loadAdminTopics(subjectId, subjectName) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      const topics = await request(`/topics/${subjectId ? "?subject_id=" + subjectId : ""}`);
      const list = Array.isArray(topics) ? topics : [];
      showAdminView(`
        <div class="content">
          ${subjectId ? '<button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>' : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${subjectId ? escapeHtml(subjectName) + " — " : ""}Topics</h2>
            <button class="btn btn-primary" id="add-topic-btn">+ Add Topic</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No topics yet</p></div>' :
              list.map(t => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(t.id)}" data-title="${escapeHtml(t.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(t.title)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">Form ${escapeHtml(t.form_level || "")}</p>
                    </div>
                    ${deleteBtn(t.id, t.title, "/topics")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      if (subjectId) document.getElementById("back-btn")?.addEventListener("click", loadAdminSubjects);
      document.getElementById("add-topic-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Topic</h3>
            <form id="create-topic-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              ${!subjectId ? '<select class="input" name="subject_id" required><option value="">Select subject...</option></select>' : ""}
              <input class="input" name="title" placeholder="Topic title" required>
              <select class="input" name="form_level">
                <option value="">Select form level...</option>
                ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => '<option value="'+f+'">'+f+'</option>').join("")}
              </select>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        if (!subjectId) {
          request("/subjects").then(subs => {
            const sel = document.querySelector('[name="subject_id"]');
            if (sel && Array.isArray(subs)) subs.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
          });
        }
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-topic-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const sid = subjectId || fd.get("subject_id");
          if (!title || !sid) { showToast("Title and subject are required"); return; }
          try {
            await request("/topics", { method: "POST", body: JSON.stringify({ title, subject_id: sid, form_level: fd.get("form_level") || "" }) });
            loadAdminTopics(subjectId, subjectName);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminSubtopics(card.dataset.id, card.dataset.title, loadAdminTopics.bind(null, subjectId, subjectName));
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }
;
// modules/admin-dashboard/01-overview/charts.js — admin subtopics & lessons drill-down

  async function loadAdminSubtopics(topicId, topicTitle, backFn) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      const subtopics = await request(`/subtopics/${topicId ? "?topic_id=" + topicId : ""}`);
      const list = Array.isArray(subtopics) ? subtopics : [];
      showAdminView(`
        <div class="content">
          ${topicId ? '<button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>' : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${topicId ? escapeHtml(topicTitle) + " — " : ""}Subtopics</h2>
            <button class="btn btn-primary" id="add-subtopic-btn">+ Add Subtopic</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No subtopics yet</p></div>' :
              list.map(st => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(st.id)}" data-title="${escapeHtml(st.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <h3>${escapeHtml(st.title)}</h3>
                    ${deleteBtn(st.id, st.title, "/subtopics")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      if (topicId) document.getElementById("back-btn")?.addEventListener("click", backFn);
      document.getElementById("add-subtopic-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Subtopic</h3>
            <form id="create-subtopic-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              ${!topicId ? '<select class="input" name="topic_id" required><option value="">Select topic...</option></select>' : ""}
              <input class="input" name="title" placeholder="Subtopic title" required>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        if (!topicId) {
          request("/topics").then(tpcs => {
            const sel = document.querySelector('[name="topic_id"]');
            if (sel && Array.isArray(tpcs)) tpcs.forEach(t => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.title; sel.appendChild(o); });
          });
        }
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-subtopic-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const tid = topicId || fd.get("topic_id");
          if (!title || !tid) { showToast("Title and topic are required"); return; }
          try {
            await request("/subtopics", { method: "POST", body: JSON.stringify({ title, topic_id: tid }) });
            loadAdminSubtopics(topicId, topicTitle, backFn);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminLessonsList(card.dataset.id, card.dataset.title, loadAdminSubtopics.bind(null, topicId, topicTitle, backFn));
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }

  async function loadAdminLessonsList(subtopicId, subtopicTitle, backFn) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      const lessons = await request(`/lessons/?subtopic_id=${subtopicId}&status=published`);
      const list = Array.isArray(lessons) ? lessons : [];
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(subtopicTitle)} — Lessons</h2>
            <button class="btn btn-primary" id="add-lesson-btn">+ Add Lesson</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No lessons yet</p></div>' :
              list.map(l => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(l.id)}">
                  <h3>${escapeHtml(l.title)}</h3>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status)}</p>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", backFn);
      document.getElementById("add-lesson-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Lesson</h3>
            <form id="create-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <input class="input" name="title" placeholder="Lesson title" required>
              <textarea class="input" name="content" rows="6" placeholder="Lesson content (HTML supported)"></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-lesson-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          try {
            await request("/lessons", { method: "POST", body: JSON.stringify({ title, slug, html_content: fd.get("content"), subtopic_id: subtopicId }) });
            loadAdminLessonsList(subtopicId, subtopicTitle, backFn);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", () => viewLessonContent("#admin-content", card.dataset.id, loadAdminLessonsList.bind(null, subtopicId, subtopicTitle, backFn)));
      });
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }
;
// Facade — actual implementation split into admin-progress.js, admin-lessons.js,
// admin-quizzes.js



;
  async function loadAdminProgress() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const [students, teachers, subjects, distribution] = await Promise.all([
        request("/students"),
        request("/teachers"),
        request("/subjects"),
        request("/analytics/lesson-distribution"),
      ]);
      if (!students || !Array.isArray(students?.items)) {
        showAdminView('<div class="content"><h2>Platform Progress</h2><div class="empty-state"><p>Unable to load progress data. Your session may have expired. <a href="#" id="reload-link">Click here to reload</a>.</p></div></div>');
        document.getElementById("reload-link")?.addEventListener("click", (e) => { e.preventDefault(); loadAdminProgress(); });
        return;
      }
      const dist = Array.isArray(distribution) ? distribution : [];
      const lessonCount = dist.length;

      showAdminView(`
        <div class="content">
          <h2>Platform Progress</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-top:0.5rem">
            <div class="card" style="padding:0.75rem"><h4>Students</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(students?.items) ? students.items.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Teachers</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(teachers?.items) ? teachers.items.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Lessons</h4><p style="font-size:1.6rem;font-weight:700">${lessonCount}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Subjects</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(subjects) ? subjects.length : 0}</p></div>
          </div>
          ${dist.length > 0 ? `
            <h3 style="margin-top:1.5rem">Lesson Distribution</h3>
            <div style="margin-top:0.5rem">
              ${dist.map(d => `
                <div style="margin-bottom:0.5rem">
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">
                    <span style="font-size:0.85rem">${escapeHtml(d.lesson_title)}</span>
                    <span style="font-size:0.85rem;color:var(--color-text-muted)">${d.avg_completion_percentage}% (${d.session_count} sessions)</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-bar-fill" style="width:${d.avg_completion_percentage}%"></div>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : '<div class="empty-state" style="margin-top:1rem"><p>No lesson progress data yet. Have students started lessons?</p></div>'}
        </div>
      `);
    } catch (err) {
      showAdminView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

;
  function checkSubjectContentMatch(subjectSlug, htmlContent) {
    const plain = String(htmlContent || "").toLowerCase().replace(/<[^>]+>/g, " ");
    const subjects = {
      mathematics: { label: "Mathematics", keywords: ["math", "mathematics", "algebra", "geometry", "equation", "calculus", "number", "probability", "trigonometry", "statistics", "function", "formula", "solve", "measure", "graph", "fraction", "percent", "angle", "proportion", "vector", "matrix", "integral", "derivative", "arithmetic", "sum", "multiply", "divide", "add", "subtract", "quadratic", "linear", "exponent", "logarithm", "sequence", "series", "distance", "speed", "area", "volume"] },
      chemistry: { label: "Chemistry", keywords: ["chem", "chemistry", "atom", "molecule", "element", "compound", "reaction", "acid", "base", "balance", "equilibrium", "bond", "electron", "proton", "neutron", "ion", "periodic", "table", "formula", "mole", "concentration", "solution", "oxid", "reduc", "titration", "gas", "solid", "liquid", "state", "organic", "inorganic", "polymer", "chemical", "salt", "ph", "electroly", "carbon", "hydrogen", "oxygen", "nitrogen"] },
      physics: { label: "Physics", keywords: ["phys", "physics", "force", "mass", "energy", "velocity", "acceleration", "momentum", "newton", "gravity", "electron", "magnet", "electric", "current", "voltage", "resistance", "wavelength", "frequency", "wave", "sound", "light", "optics", "refraction", "reflection", "lens", "mirror", "circuit", "heat", "temperature", "thermodynamic", "work", "power", "pressure", "density", "kinetic", "potential", "speed", "motion", "displacement", "projectile", "hooke", "ohms", "law", "capacitor", "friction"] },
    };
    const def = subjects[subjectSlug];
    const keywords = def ? def.keywords : [];
    if (!keywords.length) return { warning: "" };
    const matches = keywords.filter(k => plain.includes(k));
    if (matches.length === 0) {
      return { warning: `The pasted content does not appear to be about ${def.label}. Questions generated may not match the selected subject. Make sure the content is from the ${def.label} topic for accurate questions.` };
    }
    return { warning: "" };
  }

  async function loadAdminLessons() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      const lessons = await request("/lessons/");
      const list = Array.isArray(lessons) ? lessons : [];
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Lessons</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary" id="ai-generate-questions-btn">🤖 AI Generate Questions</button>
              <button class="btn btn-primary" id="add-lesson-btn">+ Add Lesson</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div id="ai-form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No lessons</p></div>' :
              list.map(l => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(l.id)}" data-title="${escapeHtml(l.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(l.title)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status||"")}</p>
                    </div>
                    ${deleteBtn(l.id, l.title, "/lessons")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          viewAdminLesson(card.dataset.id, card.dataset.title);
        });
      });
      initDeleteButtons();
      document.getElementById("add-lesson-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Lesson</h3>
            <p style="font-size:0.8rem;color:var(--color-text-muted);margin:0 0 0.5rem">
              Students only see <b>published</b> lessons under Subjects. Saving creates a draft until you publish.
            </p>
            <form id="create-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="subtopic_id" required><option value="">Select subtopic...</option></select>
              <input class="input" name="title" placeholder="Lesson title" required>
              <textarea class="input" name="content" rows="6" placeholder="Lesson content (HTML supported)"></textarea>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                <button class="btn btn-primary" type="button" id="create-publish-btn">Publish to Students</button>
                <button class="btn" type="button" id="create-draft-btn">Save as Draft</button>
                <button class="btn" type="button" id="create-cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        Promise.all([request("/subjects"), request("/topics"), request("/subtopics")]).then(([subjects, topics, subs]) => {
          const sel = document.querySelector('[name="subtopic_id"]');
          if (!sel || !Array.isArray(subs)) return;
          const subjectById = Object.fromEntries((Array.isArray(subjects) ? subjects : []).map(s => [s.id, s]));
          const topicById = Object.fromEntries((Array.isArray(topics) ? topics : []).map(t => [t.id, t]));
          subs.slice().sort((a, b) => {
            const ta = topicById[a.topic_id] || {};
            const tb = topicById[b.topic_id] || {};
            const sa = subjectById[ta.subject_id]?.name || "";
            const sb = subjectById[tb.subject_id]?.name || "";
            return sa.localeCompare(sb) || (ta.title || "").localeCompare(tb.title || "") || a.title.localeCompare(b.title);
          }).forEach(s => {
            const topic = topicById[s.topic_id] || {};
            const subject = subjectById[topic.subject_id]?.name || "Subject";
            const form = topic.form_level ? ` (Form ${topic.form_level})` : "";
            const o = document.createElement("option");
            o.value = s.id;
            o.textContent = `${subject} → ${topic.title || "Topic"}${form} → ${s.title}`;
            sel.appendChild(o);
          });
        });
        document.getElementById("create-cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        async function saveAdminLesson(publish) {
          const form = document.getElementById("create-lesson-form");
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const title = fd.get("title");
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          try {
            const created = await request("/lessons", {
              method: "POST",
              body: JSON.stringify({ title, slug, html_content: fd.get("content"), subtopic_id: fd.get("subtopic_id") }),
            });
            if (publish && created?.id) {
              await request(`/lessons/${created.id}/publish`, { method: "POST" });
              showToast("Lesson published — students can see it under Subjects.");
            } else {
              showToast("Draft saved — open the lesson and click Publish when ready.");
            }
            loadAdminLessons();
          } catch(err) { showToast("Error: " + err.message); }
        }
        document.getElementById("create-publish-btn").addEventListener("click", () => saveAdminLesson(true));
        document.getElementById("create-draft-btn").addEventListener("click", () => saveAdminLesson(false));
      });
      document.getElementById("ai-generate-questions-btn")?.addEventListener("click", () => {
        document.getElementById("ai-form-area").innerHTML = `
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Generate Quiz Questions</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Auto-generate quiz questions from lesson content.</p>
            <form id="ai-gen-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <div style="display:flex;gap:0.5rem">
                <select class="input" name="subject_slug" style="flex:1">
                  <option value="mathematics">Mathematics</option>
                  <option value="chemistry">Chemistry</option>
                  <option value="physics">Physics</option>
                </select>
                <select class="input" name="form_level" style="flex:0.5">
                  <option value="1">Form I</option>
                  <option value="2">Form II</option>
                  <option value="3">Form III</option>
                  <option value="4">Form IV</option>
                  <option value="5">Form V</option>
                  <option value="6">Form VI</option>
                </select>
              </div>
              <textarea class="input" name="lesson_html" rows="5" placeholder="Paste lesson content..." required></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Number of questions:</label>
                <input class="input" type="number" name="count" value="5" min="1" max="20" style="width:80px">
              </div>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Generate Questions</button>
                <button class="btn" type="button" id="cancel-ai-gen">Cancel</button>
              </div>
            </form>
            <div id="ai-gen-result" style="margin-top:1rem;display:none">
              <div id="ai-gen-text"></div>
            </div>
          </div>
        `;
        document.getElementById("cancel-ai-gen").addEventListener("click", () => document.getElementById("ai-form-area").innerHTML = "");
        document.getElementById("ai-gen-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const resultDiv = document.getElementById("ai-gen-result");
          const textDiv = document.getElementById("ai-gen-text");
          const lessonHtml = fd.get("lesson_html") || "";
          const subjectSlug = fd.get("subject_slug") || "";
          const subjectCheck = checkSubjectContentMatch(subjectSlug, lessonHtml);
          if (subjectCheck.warning) {
            if (!confirm(subjectCheck.warning + "\n\nDo you want to continue generating anyway?")) return;
          }
          resultDiv.style.display = "block";
          runAiGenerateTask({
            container: textDiv,
            loadingLabel: "Generating...",
            path: "/ai/questions/generate",
            body: {
              lesson_html: lessonHtml,
              count: parseInt(fd.get("count")) || 5,
              subject_slug: subjectSlug,
              form_level: parseInt(fd.get("form_level")) || 2,
            },
            render: function (result) {
              const questions = result?.questions || result;
              if (!Array.isArray(questions) || !questions.length) {
                return '<p style="color:var(--color-text-muted)">No questions generated. Try different content.</p>';
              }
              return renderQuizQuestions(questions, {
                subject: subjectSlug,
                formLevel: fd.get("form_level"),
                topic: questions[0]?.topic || "",
              });
            },
          }).catch(function () {});
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  async function lessonCatalogPath(subtopicId) {
    if (!subtopicId) return "";
    try {
      const [subjects, topics, subtopics] = await Promise.all([
        request("/subjects"),
        request("/topics"),
        request("/subtopics"),
      ]);
      const subtopic = (Array.isArray(subtopics) ? subtopics : []).find((s) => s.id === subtopicId);
      if (!subtopic) return "";
      const topic = (Array.isArray(topics) ? topics : []).find((t) => t.id === subtopic.topic_id);
      const subject = topic
        ? (Array.isArray(subjects) ? subjects : []).find((s) => s.id === topic.subject_id)
        : null;
      const form = topic?.form_level ? ` (Form ${topic.form_level})` : "";
      return `${subject?.name || "Subject"} → ${topic?.title || "Topic"}${form} → ${subtopic.title}`;
    } catch (e) {
      return "";
    }
  }

  async function viewAdminLesson(lessonId, lessonTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      const lesson = await request(`/lessons/${lessonId}`);
      if (!lesson) return;
      const catalogPath = await lessonCatalogPath(lesson.subtopic_id);
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          ${catalogPath ? `<p style="color:var(--color-text-muted);font-size:0.9rem;margin:0 0 0.75rem">Students find this under <b>${escapeHtml(catalogPath)}</b></p>` : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(lesson.title || lessonTitle)}</h2>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span class="badge" style="background:var(--color-${lesson.status === "published" ? "success" : "warning"});color:#fff;padding:0.2rem 0.6rem;border-radius:var(--radius);font-size:0.8rem">${escapeHtml(lesson.status)}</span>
              ${lesson.status !== "published" ? `<button class="btn btn-primary" id="publish-btn">Publish</button>` : ""}
              <button class="btn" id="edit-btn">Edit</button>
            </div>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <iframe id="lesson-frame" style="width:100%;border:none;display:block;min-height:500px"></iframe>
          </div>
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminLessons);
      document.getElementById("publish-btn")?.addEventListener("click", async () => {
        try {
          await request(`/lessons/${lessonId}/publish`, { method: "POST" });
          showToast("Lesson published!");
          viewAdminLesson(lessonId, lessonTitle);
        } catch(err) { showToast("Error: " + err.message); }
      });
      document.getElementById("edit-btn")?.addEventListener("click", async () => {
        let currentHtml = "";
        try {
          currentHtml = typeof loadLessonHtml === "function"
            ? await loadLessonHtml(lessonId, true)
            : "";
          if (!currentHtml) {
            const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
            if (resp.ok) currentHtml = await resp.text();
          }
        } catch(e) {}
        showAdminView(`
          <div class="content">
            <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
            <h2>Edit Lesson</h2>
            <div class="card" style="margin-top:1rem">
              <form id="edit-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <input class="input" name="title" value="${escapeHtml(lesson.title || "")}" required>
                <textarea class="input" name="content" rows="14" style="font-family:monospace">${escapeHtml(currentHtml)}</textarea>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `);
        document.getElementById("back-btn")?.addEventListener("click", () => viewAdminLesson(lessonId, lessonTitle));
        document.getElementById("cancel-btn")?.addEventListener("click", () => viewAdminLesson(lessonId, lessonTitle));
        document.getElementById("edit-lesson-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request(`/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify({ title: fd.get("title"), html_content: fd.get("content") }) });
            showToast("Lesson updated!");
            viewAdminLesson(lessonId, lessonTitle);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      try {
        const html = typeof loadLessonHtml === "function"
          ? await loadLessonHtml(lessonId)
          : "";
        if (html) {
          const iframe = document.getElementById("lesson-frame");
          iframe.setAttribute("sandbox", "allow-scripts allow-forms");
          iframe.srcdoc = injectNodeBase(html);
          iframe.onload = () => {
            try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
          };
        }
      } catch(e) {}
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lesson</p></div>'); }
  }

;
  async function loadAdminQuizzes() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading quizzes...</p></div>');
    try {
      const [quizzes, lessons] = await Promise.all([
        request("/quizzes/"),
        request("/lessons/")
      ]);
      const list = Array.isArray(quizzes) ? quizzes : [];
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const lessonMap = {};
      lessonList.forEach(l => lessonMap[l.id] = l.title);
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Quizzes</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary" id="add-quiz-html-btn">+ HTML Quiz</button>
              <button class="btn btn-primary" id="add-quiz-btn">+ Builder Quiz</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No quizzes yet</p></div>' :
              list.map(q => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(q.id)}" data-title="${escapeHtml(q.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${escapeHtml(q.title)}</h3>
                        <span class="badge" style="background:var(--color-${q.status === "published" ? "success" : "warning"});color:#fff;padding:0.15rem 0.5rem;border-radius:var(--radius);font-size:0.75rem">${escapeHtml(q.status)}</span>
                      </div>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(lessonMap[q.lesson_id] || "Standalone")}</p>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${q.slug ? "HTML Quiz" : "Structured Quiz"}</p>
                    </div>
                    ${deleteBtn(q.id, q.title, "/quizzes")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          viewAdminQuiz(card.dataset.id, card.dataset.title);
        });
      });
      initDeleteButtons();
      document.getElementById("add-quiz-html-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New HTML Quiz</h3>
            <form id="create-quiz-html-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Quiz title" required>
              <textarea class="input" name="html_content" rows="8" placeholder="Paste or write full HTML quiz content..." required></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/lessons/").then(ls => {
          const sel = document.querySelector('[name="lesson_id"]');
          if (sel && Array.isArray(ls)) ls.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.title; sel.appendChild(o); });
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-quiz-html-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if (!fd.get("title") || !fd.get("html_content")) { showToast("Title and content are required"); return; }
          try {
            await request("/quizzes/from-html", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title: fd.get("title"), html_content: fd.get("html_content") }) });
            showToast("Quiz created!");
            loadAdminQuizzes();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.getElementById("add-quiz-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Builder Quiz</h3>
            <form id="create-quiz-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Quiz title" required>
              <div id="questions-area"></div>
              <button class="btn" type="button" id="add-question-btn" style="align-self:flex-start">+ Add Question</button>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save Quiz</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/lessons/").then(ls => {
          const sel = document.querySelector('[name="lesson_id"]');
          if (sel && Array.isArray(ls)) ls.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.title; sel.appendChild(o); });
        });
        let qIdx = 0;
        function addQuestion() {
          const area = document.getElementById("questions-area");
          const i = qIdx++;
          const div = document.createElement("div");
          div.className = "card";
          div.style.cssText = "padding:0.75rem;margin-bottom:0.5rem";
          div.innerHTML = `
            <input class="input" name="q_text_${i}" placeholder="Question text" required style="margin-bottom:0.5rem">
            <input class="input" name="q_a_${i}" placeholder="Option A" required style="margin-bottom:0.25rem">
            <input class="input" name="q_b_${i}" placeholder="Option B" required style="margin-bottom:0.25rem">
            <input class="input" name="q_c_${i}" placeholder="Option C" style="margin-bottom:0.25rem">
            <input class="input" name="q_d_${i}" placeholder="Option D" style="margin-bottom:0.25rem">
            <select class="input" name="q_answer_${i}">
              <option value="A">Correct: A</option>
              <option value="B">Correct: B</option>
              <option value="C">Correct: C</option>
              <option value="D">Correct: D</option>
            </select>
          `;
          area.appendChild(div);
        }
        addQuestion();
        document.getElementById("add-question-btn").addEventListener("click", addQuestion);
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-quiz-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const questions = [];
          for (let i = 0; i < qIdx; i++) {
            const text = fd.get(`q_text_${i}`);
            if (!text) continue;
            questions.push({
              prompt: text,
              options: [
                { text: fd.get(`q_a_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "A" },
                { text: fd.get(`q_b_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "B" },
                { text: fd.get(`q_c_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "C" },
                { text: fd.get(`q_d_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "D" },
              ]
            });
          }
          if (!fd.get("title")) { showToast("Title is required"); return; }
          try {
            await request("/quizzes", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title: fd.get("title"), questions }) });
            showToast("Quiz created!");
            loadAdminQuizzes();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading quizzes</p></div>'); }
  }

  async function viewAdminQuiz(quizId, quizTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading quiz...</p></div>');
    try {
      const quiz = await request(`/quizzes/${quizId}`);
      if (!quiz) return;
      let htmlContent = "";
      let questionsHtml = "";
      const [resp, fullQuiz] = await Promise.all([
        fetch(`${API_BASE}/quizzes/${quizId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } }).catch(() => null),
        request(`/quizzes/by-lesson/${quiz.lesson_id}`).catch(() => null)
      ]);
      if (quiz.slug && resp && resp.ok) {
        htmlContent = await resp.text();
      }
      if (!quiz.slug && fullQuiz && Array.isArray(fullQuiz.questions)) {
        questionsHtml = fullQuiz.questions.map((q, i) => `
          <div class="card" style="padding:0.75rem;margin-bottom:0.5rem">
            <p style="font-weight:600;margin-bottom:0.5rem">${i + 1}. ${escapeHtml(q.prompt)}</p>
            ${q.options.map(o => `<p style="font-size:0.85rem;margin:0.15rem 0;padding-left:1rem">• ${escapeHtml(o.text)}</p>`).join("")}
          </div>
        `).join("");
      }
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(quiz.title || quizTitle)}</h2>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span class="badge" style="background:var(--color-${quiz.status === "published" ? "success" : "warning"});color:#fff;padding:0.2rem 0.6rem;border-radius:var(--radius);font-size:0.8rem">${escapeHtml(quiz.status)}</span>
              ${quiz.status !== "published" ? `<button class="btn btn-primary" id="publish-btn">Publish</button>` : ""}
              <button class="btn" id="edit-btn">Edit</button>
            </div>
          </div>
          ${htmlContent ?
            `<div class="card" style="padding:0;overflow:hidden"><iframe id="quiz-frame" style="width:100%;border:none;display:block;min-height:500px"></iframe></div>` :
            questionsHtml ?
              `<div>${questionsHtml}</div>` :
              '<div class="empty-state"><p>No quiz content</p></div>'
          }
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminQuizzes);
      document.getElementById("publish-btn")?.addEventListener("click", async () => {
        try {
          await request(`/quizzes/${quizId}/publish`, { method: "POST" });
          showToast("Quiz published!");
          viewAdminQuiz(quizId, quizTitle);
        } catch(err) { showToast("Error: " + err.message); }
      });
      document.getElementById("edit-btn")?.addEventListener("click", () => {
        showAdminView(`
          <div class="content">
            <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
            <h2>Edit Quiz</h2>
            <div class="card" style="margin-top:1rem">
              <form id="edit-quiz-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <input class="input" name="title" value="${escapeHtml(quiz.title || "")}" required>
                <textarea class="input" name="content" rows="14" style="font-family:monospace">${escapeHtml(htmlContent)}</textarea>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `);
        document.getElementById("back-btn")?.addEventListener("click", () => viewAdminQuiz(quizId, quizTitle));
        document.getElementById("cancel-btn")?.addEventListener("click", () => viewAdminQuiz(quizId, quizTitle));
        document.getElementById("edit-quiz-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request(`/quizzes/${quizId}`, { method: "PUT", body: JSON.stringify({ title: fd.get("title"), html_content: fd.get("content") }) });
            showToast("Quiz updated!");
            viewAdminQuiz(quizId, quizTitle);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      if (htmlContent) {
        const iframe = document.getElementById("quiz-frame");
        iframe.srcdoc = injectNodeBase(htmlContent);
        iframe.onload = () => {
          try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
        };
      }
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading quiz</p></div>'); }
  }

;
// modules/admin-dashboard/admin-test-generator.js — Test Generator view for the admin dashboard.

function loadAdminTestGenerator() {
  showAdminView(renderTestGeneratorView({
    title: "Test Generator",
    intro: "Generate platform-wide practice tests grounded in the NECTA/TIE knowledge base. Pick an exam type (Topical, Monthly, Midterm, Terminal, Annual, or NECTA Form II/IV/VI), then choose the subject, form, and topic.",
  }));
  initTestGeneratorView(document.getElementById("admin-content"));
}
;
// Facade — actual implementation split into admin-games.js, admin-users-list.js,
// admin-users-detail.js



;
  async function loadAdminGames() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const [games, lessons] = await Promise.all([
        request("/games/"),
        request("/lessons/")
      ]);
      const list = Array.isArray(games?.items) ? games.items : [];
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const lessonMap = {};
      lessonList.forEach(l => lessonMap[l.id] = l.title);
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Games</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary" id="add-game-html-btn">+ HTML Game</button>
              <button class="btn btn-primary" id="add-game-btn">+ Builder Game</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No games yet</p></div>' :
              list.map(g => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(g.id)}" data-title="${escapeHtml(g.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${escapeHtml(g.title)}</h3>
                        <span class="badge" style="background:var(--color-${g.status === "published" ? "success" : "warning"});color:#fff;padding:0.15rem 0.5rem;border-radius:var(--radius);font-size:0.75rem">${escapeHtml(g.status)}</span>
                      </div>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(lessonMap[g.lesson_id] || "Standalone")}</p>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${g.slug ? "HTML Game" : "Structured Game"}</p>
                    </div>
                    ${deleteBtn(g.id, g.title, "/games")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          viewAdminGame(card.dataset.id, card.dataset.title);
        });
      });
      initDeleteButtons();
      document.getElementById("add-game-html-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New HTML Game</h3>
            <form id="create-game-html-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Game title" required>
              <textarea class="input" name="html_content" rows="8" placeholder="Paste or write full HTML game content..." required></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/lessons/").then(ls => {
          const sel = document.querySelector('[name="lesson_id"]');
          if (sel && Array.isArray(ls)) ls.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.title; sel.appendChild(o); });
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-game-html-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if (!fd.get("title") || !fd.get("html_content")) { showToast("Title and content are required"); return; }
          try {
            await request("/games/from-html", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title: fd.get("title"), html_content: fd.get("html_content") }) });
            showToast("Game created!");
            loadAdminGames();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.getElementById("add-game-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Builder Game</h3>
            <form id="create-game-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Game title" required>
              <div id="builder-questions">
                <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.5rem">Questions (add at least one)</p>
                <div class="builder-question" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.5rem">
                  <input class="input" name="q_prompt_0" placeholder="Question text" required style="margin-bottom:0.5rem">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem">
                    <input class="input" name="q_opt0_0" placeholder="Option A" required>
                    <input class="input" name="q_opt1_0" placeholder="Option B" required>
                    <input class="input" name="q_opt2_0" placeholder="Option C" required>
                    <input class="input" name="q_opt3_0" placeholder="Option D" required>
                  </div>
                  <select class="input" name="q_correct_0" style="margin-top:0.35rem">
                    <option value="0">Correct: Option A</option>
                    <option value="1">Correct: Option B</option>
                    <option value="2">Correct: Option C</option>
                    <option value="3">Correct: Option D</option>
                  </select>
                </div>
              </div>
              <button type="button" class="btn btn-sm" id="add-question-btn">+ Add Question</button>
              <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/lessons/").then(ls => {
          const sel = document.querySelector('[name="lesson_id"]');
          if (sel && Array.isArray(ls)) ls.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.title; sel.appendChild(o); });
        });
        let qIdx = 1;
        document.getElementById("add-question-btn").addEventListener("click", () => {
          const i = qIdx++;
          const div = document.createElement("div");
          div.className = "builder-question";
          div.style.cssText = "border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.5rem";
          div.innerHTML = `
            <input class="input" name="q_prompt_${i}" placeholder="Question text" required style="margin-bottom:0.5rem">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem">
              <input class="input" name="q_opt0_${i}" placeholder="Option A" required>
              <input class="input" name="q_opt1_${i}" placeholder="Option B" required>
              <input class="input" name="q_opt2_${i}" placeholder="Option C" required>
              <input class="input" name="q_opt3_${i}" placeholder="Option D" required>
            </div>
            <select class="input" name="q_correct_${i}" style="margin-top:0.35rem">
              <option value="0">Correct: Option A</option>
              <option value="1">Correct: Option B</option>
              <option value="2">Correct: Option C</option>
              <option value="3">Correct: Option D</option>
            </select>
          `;
          document.getElementById("builder-questions").appendChild(div);
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-game-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          if (!title) { showToast("Title is required"); return; }
          const questions = [];
          document.querySelectorAll(".builder-question").forEach((_, idx) => {
            const prompt = fd.get(`q_prompt_${idx}`);
            if (!prompt) return;
            const options = [
              { text: fd.get(`q_opt0_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 0 },
              { text: fd.get(`q_opt1_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 1 },
              { text: fd.get(`q_opt2_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 2 },
              { text: fd.get(`q_opt3_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 3 },
            ];
            questions.push({ prompt, options });
          });
          if (questions.length === 0) { showToast("Add at least one question"); return; }
          try {
            await request("/games", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title, questions }) });
            showToast("Game created!");
            loadAdminGames();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading games</p></div>'); }
  }

  async function viewAdminGame(gameId, gameTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>');
    try {
      const game = await request(`/games/${gameId}`);
      if (!game) return;
      let htmlContent = "";
      if (game.slug) {
        try {
          htmlContent = typeof loadGameHtml === "function"
            ? await loadGameHtml(gameId)
            : "";
        } catch(e) {}
      }
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(game.title || gameTitle)}</h2>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span class="badge" style="background:var(--color-${game.status === "published" ? "success" : "warning"});color:#fff;padding:0.2rem 0.6rem;border-radius:var(--radius);font-size:0.8rem">${escapeHtml(game.status)}</span>
              ${game.status !== "published" ? `<button class="btn btn-primary" id="publish-btn">Publish</button>` : ""}
              <button class="btn" id="edit-btn">Edit</button>
            </div>
          </div>
          ${htmlContent ?
            `<div class="card" style="padding:0;overflow:hidden"><iframe id="game-frame" style="width:100%;border:none;display:block;min-height:500px"></iframe></div>` :
            '<div class="empty-state"><p>No game content</p></div>'
          }
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminGames);
      document.getElementById("publish-btn")?.addEventListener("click", async () => {
        try {
          await request(`/games/${gameId}/publish`, { method: "POST" });
          showToast("Game published!");
          viewAdminGame(gameId, gameTitle);
        } catch(err) { showToast("Error: " + err.message); }
      });
      document.getElementById("edit-btn")?.addEventListener("click", () => {
        showAdminView(`
          <div class="content">
            <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
            <h2>Edit Game</h2>
            <div class="card" style="margin-top:1rem">
              <form id="edit-game-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <input class="input" name="title" value="${escapeHtml(game.title || "")}" required>
                <textarea class="input" name="content" rows="14" style="font-family:monospace">${escapeHtml(htmlContent)}</textarea>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `);
        document.getElementById("back-btn")?.addEventListener("click", () => viewAdminGame(gameId, gameTitle));
        document.getElementById("cancel-btn")?.addEventListener("click", () => viewAdminGame(gameId, gameTitle));
        document.getElementById("edit-game-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request(`/games/${gameId}`, { method: "PUT", body: JSON.stringify({ title: fd.get("title"), html_content: fd.get("content") }) });
            showToast("Game updated!");
            viewAdminGame(gameId, gameTitle);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      if (htmlContent) {
        const iframe = document.getElementById("game-frame");
        iframe.srcdoc = injectNodeBase(htmlContent);
        iframe.onload = () => {
          try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
        };
      }
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading game</p></div>'); }
  }

;
const _adminRoleLabels = { student: "Student", teacher: "Teacher", admin: "Admin", pending: "Pending", special_needs: "Student (Special Needs)" };

  async function _fetchAllUsers() {
    const items = [];
    const pageSize = 200;
    const page = await request(`/users?offset=0&limit=${pageSize}`);
    if (!page || !Array.isArray(page.items)) {
      throw new Error("invalid_response");
    }
    items.push(...page.items);
    let offset = page.items.length;
    const total = page.total ?? offset;
    while (offset < total) {
      const next = await request(`/users?offset=${offset}&limit=${pageSize}`);
      if (!next || !Array.isArray(next.items)) break;
      items.push(...next.items);
      offset += next.items.length;
    }
    return items;
  }

  async function loadAdminUsers() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>');
    try {
      const items = await _fetchAllUsers();
      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
            <h2>Users (${items.length})</h2>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn btn-primary" id="register-user-btn">+ Register User</button>
              <button class="btn btn-outline-primary" id="export-users-btn">⬇️ Download XLSX</button>
            </div>
          </div>
          <div id="user-form-area"></div>
          <div id="users-msg" style="font-size:0.85rem;margin-top:0.5rem;min-height:1.2em"></div>

          ${items.length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No users registered yet</p></div>'
            : `<div style="overflow-x:auto">
                <table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem">
                  <thead>
                    <tr style="border-bottom:2px solid var(--color-border)">
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Name</th>
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Role</th>
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Email</th>
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Phone</th>
                      <th style="padding:0.6rem;text-align:center;font-weight:600">Status</th>
                      <th style="padding:0.6rem;text-align:center;font-weight:600">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(u => {
                      const name = escapeHtml(u.full_name || "Unnamed");
                      const profileLink = u.profile && u.profile.id
                        ? `<a href="#" class="user-view-link" data-id="${escapeHtml(u.profile.id)}" data-type="${escapeHtml(u.profile.type)}" data-name="${escapeHtml(u.full_name || "")}" style="color:var(--color-primary);text-decoration:none;font-weight:600">${name}</a>`
                        : name;
                      const extra = u.profile && u.profile.type === "student" && u.profile.form_level
                        ? ' <span style="color:var(--color-text-muted)">· ' + escapeHtml(u.profile.form_level) + '</span>'
                        : "";
                      return `
                        <tr class="user-row" data-user-id="${escapeHtml(u.id)}" style="border-bottom:1px solid var(--color-border)">
                          <td style="padding:0.6rem">${profileLink}${extra}</td>
                          <td style="padding:0.6rem">${escapeHtml(_adminRoleLabels[u.role] || u.role || "—")}</td>
                          <td style="padding:0.6rem">${escapeHtml(u.email || "—")}</td>
                          <td style="padding:0.6rem">${escapeHtml(u.phone || "—")}</td>
                          <td class="user-status-cell" style="padding:0.6rem;text-align:center">
                            <span class="badge ${u.is_active ? "badge-completed" : "badge-failed"}">${u.is_active ? "Active" : "Inactive"}</span>
                          </td>
                          <td style="padding:0.6rem;text-align:center">
                            <label style="display:inline-flex;align-items:center;cursor:pointer" title="${u.is_active ? "Click to deactivate" : "Click to activate"}">
                              <input type="checkbox" class="user-status-toggle" data-id="${escapeHtml(u.id)}" ${u.is_active ? "checked" : ""} style="width:17px;height:17px;accent-color:var(--color-primary)">
                            </label>
                          </td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>`}
        </div>
      `);

      const msgEl = document.getElementById("users-msg");

      document.querySelectorAll(".user-view-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          viewAdminUser(link.dataset.id, link.dataset.type, link.dataset.name);
        });
      });

      document.querySelectorAll(".user-status-toggle").forEach(cb => {
        cb.addEventListener("change", async () => {
          const userId = cb.dataset.id;
          const row = cb.closest(".user-row");
          try {
            await request(`/users/${encodeURIComponent(userId)}`, {
              method: "PATCH",
              body: JSON.stringify({ is_active: cb.checked }),
            });
            if (row) {
              const badge = row.querySelector(".user-status-cell .badge");
              if (badge) {
                badge.className = "badge " + (cb.checked ? "badge-completed" : "badge-failed");
                badge.textContent = cb.checked ? "Active" : "Inactive";
              }
              row.querySelector('label[title]')?.setAttribute("title", cb.checked ? "Click to deactivate" : "Click to activate");
            }
            if (msgEl) {
              msgEl.innerHTML = `<span style="color:var(--color-success)">${cb.checked ? "User activated" : "User deactivated"}</span>`;
              setTimeout(() => { msgEl.innerHTML = ""; }, 3000);
            }
          } catch (err) {
            cb.checked = !cb.checked;
            if (msgEl) msgEl.innerHTML = `<span style="color:var(--color-danger)">Could not update user: ${escapeHtml(err.message)}</span>`;
          }
        });
      });

      document.getElementById("export-users-btn")?.addEventListener("click", async () => {
        const btn = document.getElementById("export-users-btn");
        const original = btn.innerHTML;
        try {
          btn.disabled = true;
          btn.textContent = "Preparing…";
          const token = localStorage.getItem("casuya_token");
          const res = await fetch(API_BASE + "/users/export", {
            headers: token ? { "Authorization": "Bearer " + token } : {},
          });
          if (!res.ok) {
            let detail = res.statusText || "Request failed";
            try { const body = await res.json(); if (body && body.detail) detail = body.detail; } catch (e) {}
            throw new Error(detail);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "casuya-users.xlsx";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          if (msgEl) msgEl.innerHTML = '<span style="color:var(--color-success)">Users exported to casuya-users.xlsx</span>';
        } catch (err) {
          if (msgEl) msgEl.innerHTML = `<span style="color:var(--color-danger)">Export failed: ${escapeHtml(err.message)}</span>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });

      document.getElementById("register-user-btn")?.addEventListener("click", () => {
        document.getElementById("user-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Register New User</h3>
            <form id="register-user-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Full Name</label>
                <input class="input" name="full_name" placeholder="John Doe" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Email</label>
                <input class="input" type="email" name="email" placeholder="john@example.com" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Password</label>
                <input class="input" type="password" name="password" placeholder="Min 6 characters" required minlength="6">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Phone</label>
                <input class="input" name="phone" placeholder="+255...">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Role</label>
                <select class="input" name="role" required>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Form Level (Students)</label>
                <select class="input" name="form_level">
                  <option value="">N/A</option>
                  <option value="Form I">Form I</option>
                  <option value="Form II">Form II</option>
                  <option value="Form III">Form III</option>
                  <option value="Form IV">Form IV</option>
                  <option value="Form V">Form V</option>
                  <option value="Form VI">Form VI</option>
                </select>
              </div>
              <div style="grid-column:1/-1;display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit">Register</button>
                <button class="btn" type="button" id="cancel-register">Cancel</button>
              </div>
            </form>
            <div id="register-user-result" style="margin-top:0.75rem;font-size:0.85rem"></div>
          </div>
        `;
        document.getElementById("cancel-register").addEventListener("click", () => document.getElementById("user-form-area").innerHTML = "");
        document.getElementById("register-user-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                full_name: fd.get("full_name"),
                email: fd.get("email"),
                password: fd.get("password"),
                phone: fd.get("phone") || null,
                role: fd.get("role"),
                form_level: fd.get("form_level") || null,
              }),
            });
            document.getElementById("register-user-result").innerHTML = '<span style="color:var(--color-success)">User registered!</span>';
            setTimeout(() => loadAdminUsers(), 1000);
          } catch(err) {
            document.getElementById("register-user-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(err.message)}</span>`;
          }
        });
      });
    } catch(e) {
      if (e.message === "invalid_response") {
        showAdminView('<div class="content"><h2>Users</h2><div class="empty-state"><p>Unable to load users. Your session may have expired. <a href="#" id="reload-link">Click here to reload</a>.</p></div></div>');
        document.getElementById("reload-link")?.addEventListener("click", (ev) => { ev.preventDefault(); loadAdminUsers(); });
      } else {
        showAdminView('<div class="empty-state"><p>Error loading users</p></div>');
      }
    }
  }
;
  async function viewAdminUser(userId, userType, userName) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading user...</p></div>');
    try {
      let userData = null;
      let progressData = [];
      if (userType === "student") {
        [userData, progressData] = await Promise.all([
          request(`/students/${userId}`).catch(() => null),
          request(`/progress/${userId}`).catch(() => []),
        ]);
      } else {
        userData = await request(`/teachers/${userId}`).catch(() => null);
      }

      const progressList = typeof asProgressItems === "function" ? asProgressItems(progressData) : (Array.isArray(progressData) ? progressData : (progressData && progressData.items) || []);
      const totalCompleted = progressList.filter(p => p.completion_percentage >= 100).length;
      const scores = progressList.filter(p => p.score_percentage != null && p.score_percentage > 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score_percentage, 0) / scores.length) : 0;

      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
            <button class="btn" id="back-btn">← Back</button>
            <h2>${escapeHtml(userName)}</h2>
            <span style="font-size:0.75rem;padding:0.2rem 0.6rem;background:${userType === "student" ? "#eff6ff" : "#f0fdf4"};color:${userType === "student" ? "#2563eb" : "#16a34a"};border-radius:var(--radius);font-weight:600">${userType === "student" ? "Student" : "Teacher"}</span>
          </div>

          <div class="card" style="margin-bottom:1rem">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem">
              <div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Name</div>
                <div style="font-size:0.9rem">${escapeHtml(userData?.full_name || "N/A")}</div>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Email</div>
                <div style="font-size:0.9rem">${escapeHtml(userData?.email || "N/A")}</div>
              </div>
              ${userData?.phone ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Phone</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.phone)}</div>
              </div>` : ""}
              ${userData?.form_level ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Form Level</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.form_level)}</div>
              </div>` : ""}
              ${userData?.subjects ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Subjects</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.subjects)}</div>
              </div>` : ""}
            </div>
          </div>

          ${userType === "student" && progressList.length > 0 ? `
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-icon" style="background:#eff6ff;color:#2563eb">📚</div>
                <div class="stat-value">${progressList.length}</div>
                <div class="stat-label">Lessons Attempted</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">✅</div>
                <div class="stat-value">${totalCompleted}</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#fef3c7;color:#d97706">📈</div>
                <div class="stat-value">${avgScore != null ? avgScore + "%" : "0%"}</div>
                <div class="stat-label">Avg Score</div>
              </div>
            </div>

            <div class="section-header">
              <h3>Progress by Subject</h3>
            </div>
            ${(() => {
              const bySubject = {};
              progressList.forEach(p => {
                const subj = p.subject_name || "General";
                if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
                bySubject[subj].total++;
                if (p.completion_percentage >= 100) bySubject[subj].completed++;
              });
              return Object.entries(bySubject).map(([name, data]) => {
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return `
                  <div class="card" style="margin-bottom:0.75rem">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                      <strong>${escapeHtml(name)}</strong>
                      <span style="font-size:0.85rem;color:var(--color-text-muted)">${data.completed}/${data.total} · ${pct}%</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join("");
            })()}
          ` : userType === "student" ? `
            <div class="empty-state" style="padding:2rem"><p>No progress data yet</p></div>
          ` : ""}

          ${userType === "teacher" ? `
            <div class="section-header" style="margin-top:1rem">
              <h3>Teacher Actions</h3>
            </div>
            <div class="card" style="padding:1rem">
              <p style="color:var(--color-text-muted);font-size:0.85rem">Teacher progress and class analytics are available in the teacher portal.</p>
            </div>
          ` : ""}
        </div>
      `);

      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    } catch (err) {
      showAdminView(`<div class="empty-state"><p>Error loading user details</p><button class="btn" id="back-btn">← Back</button></div>`);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    }
  }

;
// Facade — actual implementation split into admin-payments.js, admin-notifications.js,
// admin-uploads.js, admin-library.js




;
  async function loadAdminPayments() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
    try {
      const transactions = await request("/payments/transactions").catch(() => []);
      const txList = Array.isArray(transactions) ? transactions : [];
      const totalRevenue = txList.filter(t => t.status === "completed").reduce((s, t) => s + (t.amount_tzs || 0), 0);
      const completedCount = txList.filter(t => t.status === "completed").length;
      const pendingCount = txList.filter(t => t.status === "pending").length;

      showAdminView(`
        <div class="content">
          <h2>Payments</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">AzamPay mobile money integration</p>

          <div class="stat-grid" style="margin-top:1rem">
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">💰</div>
              <div class="stat-value">${totalRevenue.toLocaleString()}</div>
              <div class="stat-label">Total Revenue (TZS)</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">✅</div>
              <div class="stat-value">${completedCount}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">⏳</div>
              <div class="stat-value">${pendingCount}</div>
              <div class="stat-label">Pending</div>
            </div>
          </div>

          <div class="card" style="padding:1.5rem;margin-top:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <h3>Payment Plans</h3>
              <button class="btn btn-sm btn-primary" id="admin-add-plan-btn">+ New Plan</button>
            </div>
            <div id="admin-plan-form-wrap" style="display:none;margin-bottom:1rem">
              <form id="admin-plan-form" class="checkout-body">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                  <div style="flex:1;min-width:0"><label class="field-label">Name</label><input class="input" name="name" required></div>
                  <div style="flex:1;min-width:0"><label class="field-label">Description</label><input class="input" name="description"></div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
                  <div style="min-width:0"><label class="field-label">Amount (TZS)</label><input class="input" name="amount_tzs" type="number" min="100" required></div>
                  <div style="min-width:0"><label class="field-label">Audience</label><select class="input" name="audience"><option value="both">Both</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>
                  <div style="min-width:0"><label class="field-label">Active</label><select class="input" name="is_active"><option value="true">Yes</option><option value="false">No</option></select></div>
                </div>
                <div style="margin-top:0.75rem">
                  <button class="btn btn-success" type="submit" id="admin-plan-submit">Save Plan</button>
                  <button class="btn btn-ghost" type="button" id="admin-plan-cancel">Cancel</button>
                </div>
              </form>
              <div id="admin-plan-result" style="margin-top:0.5rem"></div>
            </div>
            <div id="admin-plans-list"><div class="loading-state"><div class="spinner"></div></div></div>
          </div>

          <div class="card" style="padding:0;max-width:560px;margin-top:1rem;overflow:hidden">
              <div class="checkout-header">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <h3>Initiate Checkout</h3>
              </div>
              <form id="payment-form" class="checkout-body">
                <div>
                  <label class="field-label">Mobile Number</label>
                  <div class="input-icon-wrap">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    <input class="input" name="mobile_number" placeholder="0712345678" required>
                  </div>
                </div>
                <div>
                  <label class="field-label">Amount (TZS)</label>
                  <div class="input-icon-wrap">
                    <span class="input-currency-prefix">TZS</span>
                    <input class="input" name="amount_tzs" type="number" placeholder="5,000" required min="100">
                  </div>
                </div>
                <div>
                  <label class="field-label">Provider</label>
                  <div class="provider-grid">
                    <label class="provider-card">
                      <input type="radio" name="provider" value="m-pesa" required>
                      <span class="provider-dot" style="background:#16a34a"></span>
                      <span>M-Pesa</span>
                    </label>
                    <label class="provider-card">
                      <input type="radio" name="provider" value="tigo-pesa">
                      <span class="provider-dot" style="background:#2563eb"></span>
                      <span>Tigo Pesa</span>
                    </label>
                    <label class="provider-card">
                      <input type="radio" name="provider" value="halopesa">
                      <span class="provider-dot" style="background:#d97706"></span>
                      <span>HaloPesa</span>
                    </label>
                    <label class="provider-card">
                      <input type="radio" name="provider" value="azampay">
                      <span class="provider-dot" style="background:#8b5cf6"></span>
                      <span>AzamPay</span>
                    </label>
                  </div>
                </div>
                <button class="btn btn-success btn-block" type="submit" id="payment-submit-btn">Initiate Payment</button>
              </form>
              <div id="payment-result" style="padding:0 1.5rem 1.5rem"></div>
            </div>

          <div class="card" style="padding:1.5rem;margin-top:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <h3>Transaction History</h3>
              <button class="btn btn-sm" id="refresh-tx-btn">Refresh</button>
            </div>
            ${txList.length === 0
              ? '<div class="empty-state" style="padding:2rem"><p>No transactions yet</p></div>'
              : `<div style="overflow-x:auto">
                  <table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem">
                    <thead>
                      <tr style="border-bottom:2px solid var(--color-border)">
                        <th style="padding:0.6rem;text-align:left;font-weight:600">Date</th>
                         <th style="padding:0.6rem;text-align:left;font-weight:600">Phone</th>
                         <th style="padding:0.6rem;text-align:left;font-weight:600">Provider</th>
                         <th style="padding:0.6rem;text-align:left;font-weight:600">Plan</th>
                         <th style="padding:0.6rem;text-align:right;font-weight:600">Amount</th>
                        <th style="padding:0.6rem;text-align:center;font-weight:600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${txList.map(t => `
                        <tr style="border-bottom:1px solid var(--color-border)">
                          <td style="padding:0.6rem;color:var(--color-text-muted)">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "\u2014"}</td>
                           <td style="padding:0.6rem;font-weight:500">${escapeHtml(t.mobile_number || "\u2014")}</td>
                           <td style="padding:0.6rem">${escapeHtml(t.provider || "\u2014")}</td>
                           <td style="padding:0.6rem">${escapeHtml(t.plan_name || "\u2014")}</td>
                           <td style="padding:0.6rem;text-align:right;font-weight:600">${(t.amount_tzs || 0).toLocaleString()} TZS</td>
                          <td style="padding:0.6rem;text-align:center"><span class="badge badge-${t.status || 'pending'}">${escapeHtml(t.status || "unknown")}</span></td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>`
            }
          </div>
        </div>
      `);

      let paymentInProgress = false;
      document.getElementById("payment-form")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const btn = document.getElementById("payment-submit-btn");
        if (paymentInProgress) return;
        paymentInProgress = true;
        btn.innerHTML = '<span class="btn-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg> Processing...</span>';
        btn.disabled = true;
        const fd = new FormData(ev.target);
        try {
          const data = await request("/payments/checkout", {
            method: "POST",
            body: JSON.stringify({
              mobile_number: fd.get("mobile_number"),
              amount_tzs: parseInt(fd.get("amount_tzs"), 10),
              provider: fd.get("provider"),
              idempotency_key: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            }),
          });
          if (data === null) return;
          document.getElementById("payment-result").innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(data.external_transaction_id || data.id || "")}</span></div></div>`;
          loadAdminPayments();
        } catch (err) {
          document.getElementById("payment-result").innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
        }
        paymentInProgress = false;
        btn.innerHTML = 'Initiate Payment';
        btn.disabled = false;
      });

      document.getElementById("refresh-tx-btn")?.addEventListener("click", loadAdminPayments);

      // ── Payment Plans management ───────────────────────────────────────
      let _adminEditingPlanId = null;
      const planFormWrap = document.getElementById("admin-plan-form-wrap");
      const planForm = document.getElementById("admin-plan-form");

      document.getElementById("admin-add-plan-btn")?.addEventListener("click", () => {
        _adminEditingPlanId = null;
        planForm.reset();
        planFormWrap.style.display = planFormWrap.style.display === "none" ? "block" : "block";
        document.getElementById("admin-plan-result").innerHTML = "";
      });
      document.getElementById("admin-plan-cancel")?.addEventListener("click", () => {
        planFormWrap.style.display = "none";
        _adminEditingPlanId = null;
      });

      planForm?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const btn = document.getElementById("admin-plan-submit");
        const resultEl = document.getElementById("admin-plan-result");
        const fd = new FormData(ev.target);
        const payload = {
          name: fd.get("name"),
          description: fd.get("description") || null,
          amount_tzs: parseFloat(fd.get("amount_tzs")),
          audience: fd.get("audience"),
          is_active: fd.get("is_active") === "true",
        };
        btn.disabled = true; btn.textContent = "Saving...";
        try {
          if (_adminEditingPlanId) {
            await request(`/payments/plans/${_adminEditingPlanId}`, { method: "PUT", body: JSON.stringify(payload) });
          } else {
            await request("/payments/plans", { method: "POST", body: JSON.stringify(payload) });
          }
          resultEl.innerHTML = '<div class="payment-result success">Plan saved.</div>';
          planFormWrap.style.display = "none";
          _adminEditingPlanId = null;
          loadAdminPlans();
        } catch (err) {
          resultEl.innerHTML = `<div class="payment-result error">${escapeHtml(err.message)}</div>`;
        } finally {
          btn.disabled = false; btn.textContent = "Save Plan";
        }
      });

      async function loadAdminPlans() {
        const el = document.getElementById("admin-plans-list");
        if (!el) return;
        try {
          const plans = await request("/payments/plans/all").catch(() => []);
          if (!Array.isArray(plans) || plans.length === 0) {
            el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>No plans created yet.</p></div>';
            return;
          }
          el.innerHTML = plans.map(p => `
            <div class="plan-card" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:1rem;margin-top:0.75rem;display:flex;justify-content:space-between;align-items:center;gap:0.5rem">
              <div>
                <div style="font-weight:600">${escapeHtml(p.name)} ${p.is_active ? '' : '<span class="badge badge-pending">inactive</span>'}</div>
                <div style="font-size:0.8rem;color:var(--color-text-muted)">${escapeHtml(p.description || "")}</div>
                <div style="font-weight:700;margin-top:0.25rem">${Number(p.amount_tzs).toLocaleString()} ${escapeHtml(p.currency || "TZS")} · <span style="text-transform:capitalize">${escapeHtml(p.audience)}</span></div>
              </div>
              <div style="display:flex;gap:0.4rem">
                <button class="btn btn-sm admin-edit-plan" data-id="${p.id}">Edit</button>
                <button class="btn btn-sm btn-danger admin-delete-plan" data-id="${p.id}">Delete</button>
              </div>
            </div>
          `).join("");
          document.querySelectorAll(".admin-edit-plan").forEach(b => b.addEventListener("click", () => {
            const id = b.getAttribute("data-id");
            const plan = plans.find(x => x.id === id);
            if (!plan) return;
            _adminEditingPlanId = id;
            planForm.name.value = plan.name;
            planForm.description.value = plan.description || "";
            planForm.amount_tzs.value = plan.amount_tzs;
            planForm.audience.value = plan.audience;
            planForm.is_active.value = String(plan.is_active);
            planFormWrap.style.display = "block";
            document.getElementById("admin-plan-result").innerHTML = "";
            planForm.scrollIntoView({ behavior: "smooth" });
          }));
          document.querySelectorAll(".admin-delete-plan").forEach(b => b.addEventListener("click", async () => {
            if (!confirm("Delete this plan?")) return;
            try {
              await request(`/payments/plans/${b.getAttribute("data-id")}`, { method: "DELETE" });
              loadAdminPlans();
            } catch (err) {
              alert(escapeHtml(err.message));
            }
          }));
        } catch (e) {
          el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>Could not load plans.</p></div>';
        }
      }
      loadAdminPlans();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
  }

;
  async function loadAdminNotifications() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const [data, users] = await Promise.all([
        request("/notifications"),
        request("/users"),
      ]);
      const allNotifs = Array.isArray(data?.items) ? data.items : [];
      const userList = Array.isArray(users?.items) ? users.items : [];
      let currentFilter = "all";
      let searchQuery = "";
      const PAGE_SIZE = 15;
      let currentPage = 1;

      function getFiltered() {
        let list = allNotifs;
        if (currentFilter === "unread") list = list.filter(n => !n.is_read);
        else if (currentFilter === "read") list = list.filter(n => n.is_read);
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          list = list.filter(n => (n.message || "").toLowerCase().includes(q));
        }
        return list;
      }

      function renderNotifHistory() {
        const filtered = getFiltered();
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const page = filtered.slice(start, start + PAGE_SIZE);
        const unreadCount = allNotifs.filter(n => !n.is_read).length;

        document.getElementById("notif-stats").innerHTML = `
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <span style="font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:var(--radius);background:var(--color-bg);border:1px solid var(--color-border)">Total: ${allNotifs.length}</span>
            <span style="font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:var(--radius);background:#fef3c7;border:1px solid #fde68a">Unread: ${unreadCount}</span>
            <span style="font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:var(--radius);background:var(--color-bg);border:1px solid var(--color-border)">Showing: ${filtered.length}</span>
          </div>
        `;

        const notifList = document.getElementById("notif-list");
        if (page.length === 0) {
          notifList.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No notifications match your filter</p></div>';
        } else {
          notifList.innerHTML = page.map(n => `
            <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.5rem;${n.is_read ? "opacity:0.7" : "border-left:3px solid var(--color-primary)"}">
              <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem">
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.875rem;${n.is_read ? "" : "font-weight:600"}">${escapeHtml(n.message)}</p>
                  <p style="margin:0.25rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">${n.created_at ? new Date(n.created_at).toLocaleString() : ""} · ${n.is_read ? "Read" : "Unread"}</p>
                </div>
                <div style="display:flex;gap:0.25rem;flex-shrink:0">
                  ${!n.is_read ? `<button class="btn btn-primary btn-xs notif-mark-read" data-id="${n.id}">✓ Read</button>` : ""}
                </div>
              </div>
            </div>
          `).join("");
        }

        const pag = document.getElementById("notif-pagination");
        if (totalPages <= 1) { pag.innerHTML = ""; return; }
        pag.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin-top:1rem">
            <button class="btn btn-ghost btn-sm notif-page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>← Prev</button>
            <span style="font-size:0.85rem;color:var(--color-text-muted)">Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-ghost btn-sm notif-page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>Next →</button>
          </div>
        `;
        document.querySelectorAll(".notif-page-btn").forEach(btn => {
          btn.addEventListener("click", () => { currentPage = parseInt(btn.dataset.page); renderNotifHistory(); });
        });
        document.querySelectorAll(".notif-mark-read").forEach(btn => {
          btn.addEventListener("click", async () => {
            await request(`/notifications/${btn.dataset.id}/read`, { method: "POST" });
            const n = allNotifs.find(x => x.id === btn.dataset.id);
            if (n) n.is_read = true;
            renderNotifHistory();
          });
        });
      }

      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
            <h2>🔔 Notifications</h2>
            <button class="btn btn-primary btn-pattern" id="notif-send-btn">✉️ Send Notification</button>
          </div>
          <div class="card" style="margin-top:1rem;display:none" id="notif-send-form-area">
            <h3 style="margin-bottom:0.75rem">Send Notification</h3>
            <form id="send-notif-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <label style="font-size:0.85rem;font-weight:500">Recipient</label>
              <select class="input" name="recipient_type" id="notif-recipient-type" required>
                <option value="role_student">All Students</option>
                <option value="role_teacher">All Teachers</option>
                <option value="specific">Specific User...</option>
              </select>
              <div id="notif-specific-user" style="display:none">
                <select class="input" name="user_id" id="notif-user-select">
                  <option value="">Select user...</option>
                  ${userList.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.email)} (${escapeHtml(u.role)})</option>`).join("")}
                </select>
              </div>
              <label style="font-size:0.85rem;font-weight:500">Message</label>
              <textarea class="input" name="message" rows="3" placeholder="Write your notification message..." required></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <button class="btn btn-success btn-pattern" type="submit">📤 Send Notification</button>
                <button class="btn btn-ghost" type="button" id="notif-cancel-send">Cancel</button>
                <p id="notif-send-status" style="font-size:0.85rem;display:none;margin:0"></p>
              </div>
            </form>
          </div>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter notif-filter-btn active" data-filter="all">All</button>
            <button class="btn-filter notif-filter-btn" data-filter="unread">🔴 Unread</button>
            <button class="btn-filter notif-filter-btn" data-filter="read">✅ Read</button>
            <input type="search" class="input" id="notif-search" placeholder="Search..." style="flex:1;min-width:120px;padding:0.35rem 0.6rem;font-size:0.85rem">
            <button class="btn btn-ghost btn-sm" id="notif-mark-all" style="margin-left:auto">✓ Mark All Read</button>
          </div>
          <div id="notif-stats" style="margin-top:0.75rem"></div>
          <div style="margin-top:0.5rem" id="notif-list"></div>
          <div id="notif-pagination"></div>
        </div>
      `);

      document.getElementById("notif-send-btn")?.addEventListener("click", () => {
        const area = document.getElementById("notif-send-form-area");
        area.style.display = area.style.display === "none" ? "block" : "none";
      });
      document.getElementById("notif-cancel-send")?.addEventListener("click", () => {
        document.getElementById("notif-send-form-area").style.display = "none";
      });
      document.getElementById("notif-recipient-type")?.addEventListener("change", (e) => {
        document.getElementById("notif-specific-user").style.display = e.target.value === "specific" ? "block" : "none";
      });
      document.getElementById("send-notif-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const type = fd.get("recipient_type");
        const message = fd.get("message");
        const statusEl = document.getElementById("notif-send-status");
        try {
          let body = { message };
          if (type === "role_student") body.role = "student";
          else if (type === "role_teacher") body.role = "teacher";
          else body.user_id = fd.get("user_id");
          if (!body.role && !body.user_id) {
            statusEl.textContent = "Please select a user"; statusEl.style.color = "var(--color-danger)"; statusEl.style.display = "inline";
            return;
          }
          const result = await request("/notifications", { method: "POST", body: JSON.stringify(body) });
          statusEl.textContent = `Sent to ${result.sent} user(s)`; statusEl.style.color = "var(--color-success)"; statusEl.style.display = "inline";
          e.target.reset();
          document.getElementById("notif-specific-user").style.display = "none";
          loadAdminNotifications();
        } catch(err) {
          statusEl.textContent = "Error: " + err.message; statusEl.style.color = "var(--color-danger)"; statusEl.style.display = "inline";
        }
      });

      document.querySelectorAll(".notif-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentFilter = btn.dataset.filter; currentPage = 1;
          document.querySelectorAll(".notif-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === currentFilter));
          renderNotifHistory();
        });
      });
      document.getElementById("notif-search")?.addEventListener("input", (e) => {
        searchQuery = e.target.value; currentPage = 1; renderNotifHistory();
      });
      document.getElementById("notif-mark-all")?.addEventListener("click", async () => {
        const unread = allNotifs.filter(n => !n.is_read);
        if (unread.length === 0) return;
        for (const n of unread) {
          try { await request(`/notifications/${n.id}/read`, { method: "POST" }); n.is_read = true; } catch(e) {}
        }
        renderNotifHistory();
      });

      renderNotifHistory();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
  }

;
  async function loadAdminUploads() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading uploads...</p></div>');
    try {
      const files = await request("/uploads").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];
      const imageFiles = fileList.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.filename || f.path || ""));
      const docFiles = fileList.filter(f => /\.(pdf|doc|docx|txt)$/i.test(f.filename || f.path || ""));
      const mediaFiles = fileList.filter(f => /\.(mp4|webm|mp3|wav|ogg)$/i.test(f.filename || f.path || ""));
      let activeFilter = "all";

      function renderFiles() {
        let filtered = fileList;
        if (activeFilter === "images") filtered = imageFiles;
        else if (activeFilter === "documents") filtered = docFiles;
        else if (activeFilter === "media") filtered = mediaFiles;

        const grid = document.getElementById("uploads-grid");
        if (!grid) return;
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No files uploaded yet</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(f => {
          const name = f.filename || f.path || "unknown";
          const displayName = f.display_name || name;
          const isVisible = f.is_visible !== false;
          const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);
          const isVideo = /\.(mp4|webm)$/i.test(name);
          const isAudio = /\.(mp3|wav|ogg)$/i.test(name);
          const icon = isImage ? "🖼️" : isVideo ? "🎬" : isAudio ? "🎵" : "📄";
          return `
            <div class="card upload-card" style="padding:0.75rem;cursor:pointer" data-filename="${escapeHtml(name)}">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="upload-display-name">${escapeHtml(displayName)}</p>
                  <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${f.size ? (f.size / 1024).toFixed(1) + " KB" : ""} · ${f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ""}</p>
                  ${!isVisible ? '<span style="display:inline-block;margin-top:0.25rem;font-size:0.65rem;padding:0.1rem 0.4rem;background:#fee2e2;color:#dc2626;border-radius:4px">Hidden</span>' : ""}
                </div>
                <div style="display:flex;flex-direction:column;gap:0.25rem;flex-shrink:0">
                   <button class="btn btn-xs upload-rename-btn" data-filename="${escapeHtml(name)}" data-display="${escapeHtml(displayName)}" title="Rename">✏️</button>
                   <button class="btn btn-xs upload-vis-btn" data-filename="${escapeHtml(name)}" data-visible="${isVisible}" title="${isVisible ? 'Hide from students & teachers' : 'Show to students & teachers'}">${isVisible ? "👁️" : "🚫"}</button>
                   <button class="btn btn-outline-danger btn-xs upload-delete-btn" data-filename="${escapeHtml(name)}" title="Delete file">✕</button>
                </div>
              </div>
            </div>
          `;
        }).join("");

        document.querySelectorAll(".upload-rename-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const oldName = btn.dataset.display;
            const newName = prompt("Rename file:", oldName);
            if (newName && newName !== oldName) {
              try {
                await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, {
                  method: "PATCH",
                  body: JSON.stringify({ display_name: newName }),
                });
                showToast("File renamed");
                loadAdminUploads();
              } catch(err) { showToast(err.message || "Rename failed"); }
            }
          });
        });

        document.querySelectorAll(".upload-vis-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const currentVisible = btn.dataset.visible === "true";
            try {
              await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, {
                method: "PATCH",
                body: JSON.stringify({ is_visible: !currentVisible }),
              });
              showToast(currentVisible ? "File hidden from students & teachers" : "File now visible to students & teachers");
              loadAdminUploads();
            } catch(err) { showToast(err.message || "Update failed"); }
          });
        });

        document.querySelectorAll(".upload-delete-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirmDelete(btn.dataset.filename)) return;
            try {
              await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, { method: "DELETE" });
              showToast("File deleted");
              loadAdminUploads();
            } catch(err) { showToast(err.message || "Delete failed"); }
          });
        });
        document.querySelectorAll("#uploads-grid .card[data-filename]").forEach(card => {
          if (card.querySelector(".upload-delete-btn")) {
            card.addEventListener("click", (e) => {
              if (e.target.closest(".upload-delete-btn") || e.target.closest(".upload-rename-btn") || e.target.closest(".upload-vis-btn")) return;
              window.open(`${API_BASE}/uploads/${encodeURIComponent(card.dataset.filename)}`, "_blank");
            });
          }
        });
      }

      showAdminView(`
        <div class="content">
          <h2>📁 Uploads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Manage uploaded files. Control visibility for students and teachers.</p>

          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">📤 Upload New File</h3>
            <form id="upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <p style="font-size:0.8rem;color:var(--color-text-muted);margin:0">Supports images (png, jpg, gif, svg, webp), documents (pdf, doc), videos (mp4, webm), audio (mp3, wav, ogg)</p>
              <input class="input" type="file" id="upload-file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" required>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <button class="btn btn-success btn-pattern" type="submit" id="upload-submit-btn" style="width:100%">📤 Upload File</button>
              </div>
            </form>
            <div id="upload-result" style="margin-top:0.5rem"></div>
          </div>

          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter upload-filter-btn active" data-filter="all">All <span class="filter-count">${fileList.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="images">🖼️ Images <span class="filter-count">${imageFiles.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="documents">📄 Documents <span class="filter-count">${docFiles.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="media">🎬 Media <span class="filter-count">${mediaFiles.length}</span></button>
          </div>
          <div id="uploads-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.5rem"></div>
        </div>
      `);

      document.querySelectorAll(".upload-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".upload-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderFiles();
        });
      });

      let uploading = false;
      document.getElementById("upload-form")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fileInput = document.getElementById("upload-file");
        const file = fileInput?.files?.[0];
        if (!file || uploading) return;
        const btn = document.getElementById("upload-submit-btn");
        uploading = true;
        btn.textContent = "Uploading..."; btn.disabled = true; btn.style.opacity = "0.7";
        const token = localStorage.getItem("casuya_token");
        const formData = new FormData();
        formData.append("file", file);
        try {
          const resp = await fetch(`${API_BASE}/uploads/`, {
            method: "POST",
            headers: token ? { "Authorization": `Bearer ${token}` } : {},
            body: formData,
          });
          const data = await resp.json();
          if (resp.ok) {
            document.getElementById("upload-result").innerHTML = `<div style="padding:0.5rem;background:#dcfce7;border-radius:var(--radius);font-size:0.85rem;color:var(--color-success)">Uploaded: ${escapeHtml(data.filename || file.name)}</div>`;
            loadAdminUploads();
          } else {
            document.getElementById("upload-result").innerHTML = `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.85rem;color:var(--color-danger)">${escapeHtml(data.detail || "Upload failed")}</div>`;
          }
        } catch (err) {
          document.getElementById("upload-result").innerHTML = `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.85rem;color:var(--color-danger)">${escapeHtml(err.message)}</div>`;
        }
        uploading = false;
        btn.textContent = "Upload File"; btn.disabled = false; btn.style.opacity = "1";
      });

      renderFiles();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading uploads</p></div>'); }
  }

;
  // ── Reference Library (admin — manage visibility) ────────────────
  async function loadAdminLibrary() {
    const SUBJECTS = [
      { slug: "mathematics", name: "Mathematics" },
      { slug: "chemistry", name: "Chemistry" },
      { slug: "physics", name: "Physics" },
    ];
    let docs = [];
    let libStats = {};
    let filters = { doc_type: "", subject_slug: "", form_level: "", query: "" };
    let page = 0;
    const PAGE_SIZE = 30;

    function subjectOpts() {
      return '<option value="">All Subjects</option>' +
        SUBJECTS.map(s => `<option value="${s.slug}">${escapeHtml(s.name)}</option>`).join("");
    }

    async function loadStats() {
      try { libStats = await request("/reference-docs/stats"); } catch(e) { libStats = {}; }
    }

    async function loadDocs() {
      const params = new URLSearchParams();
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
      if (filters.form_level) params.set("form_level", filters.form_level);
      if (filters.query) params.set("query", filters.query);
      params.set("limit", PAGE_SIZE);
      params.set("offset", page * PAGE_SIZE);
      try {
        const res = await request("/reference-docs/admin/list?" + params.toString());
        docs = res.items || [];
        libStats = { ...libStats, total: res.total || 0 };
      } catch (e) { docs = []; }
    }

    function renderStats() {
      const el = document.getElementById("lib-stats");
      if (!el) return;
      el.innerHTML = `
        <div class="stat-grid" style="margin-bottom:1rem">
          <div class="stat-card"><div class="stat-value">${libStats.total || 0}</div><div class="stat-label">Total Documents</div></div>
          <div class="stat-card"><div class="stat-value">${libStats.lesson_plans || 0}</div><div class="stat-label">Lesson Plans</div></div>
          <div class="stat-card"><div class="stat-value">${libStats.schemes_of_work || 0}</div><div class="stat-label">Schemes of Work</div></div>
        </div>`;
    }

    function renderDocList() {
      const el = document.getElementById("lib-results");
      if (!el) return;
      if (!docs.length) {
        el.innerHTML = '<div class="tdocs-empty"><div class="tdocs-empty-icon">📖</div><p>No reference documents found.</p></div>';
        return;
      }
      const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
      el.innerHTML = docs.map(d => {
        const typeLabel = d.doc_type === "scheme_of_work" ? "Scheme of Work" : "Lesson Plan";
        const typeCls = d.doc_type === "scheme_of_work" ? "tdocs-status-info" : "tdocs-status-success";
        const form = d.form_level ? "Form " + (ROMAN[d.form_level] || d.form_level) : "";
        const vis = d.visible_to_students;
        return `
          <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.15rem">
                <span class="tdocs-status ${typeCls}">${typeLabel}</span>
                ${form ? `<span class="tdocs-status" style="background:var(--color-bg);color:var(--color-text-muted)">${form}</span>` : ""}
              </div>
              <h4 style="margin:0;font-size:0.85rem;font-weight:600">${escapeHtml(d.title)}</h4>
              <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${escapeHtml(d.subject_name || "")}</p>
            </div>
            <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer;font-size:0.78rem;font-weight:600;white-space:nowrap">
              <input type="checkbox" data-toggle-vis="${d.id}" ${vis ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--color-primary)">
              Students
            </label>
          </div>`;
      }).join("");
      const totalPages = Math.ceil(libStats.total / PAGE_SIZE);
      const pag = document.getElementById("lib-pagination");
      if (pag) {
        pag.innerHTML = totalPages > 1 ? `
          <div style="display:flex;gap:0.5rem;align-items:center;justify-content:center;margin-top:1rem">
            <button class="btn btn-sm btn-outline" id="lib-prev" ${page === 0 ? "disabled" : ""}>← Prev</button>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">Page ${page + 1} of ${totalPages}</span>
            <button class="btn btn-sm btn-outline" id="lib-next" ${page >= totalPages - 1 ? "disabled" : ""}>Next →</button>
          </div>` : "";
      }
    }

    showAdminView(`
      <div class="content">
        <h2 class="tdocs-page-title">Reference Library</h2>
        <p class="tdocs-page-desc">Manage which reference documents are visible to students. Toggle visibility per document.</p>

        <div id="lib-stats"></div>

        <div style="display:grid;gap:0.6rem;margin-top:0.5rem">
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <select class="input" id="lib-type" style="max-width:180px;padding:0.45rem 0.6rem;font-size:0.85rem">
              <option value="">All Types</option>
              <option value="lesson_plan">Lesson Plans</option>
              <option value="scheme_of_work">Schemes of Work</option>
            </select>
            <select class="input" id="lib-subject" style="max-width:180px;padding:0.45rem 0.6rem;font-size:0.85rem">${subjectOpts()}</select>
            <select class="input" id="lib-form" style="max-width:140px;padding:0.45rem 0.6rem;font-size:0.85rem">
              <option value="">All Forms</option>
              <option value="1">Form I</option>
              <option value="2">Form II</option>
              <option value="3">Form III</option>
              <option value="4">Form IV</option>
              <option value="5">Form V</option>
              <option value="6">Form VI</option>
            </select>
            <input class="input" id="lib-search" type="search" placeholder="Search titles..." style="max-width:220px;padding:0.45rem 0.6rem;font-size:0.85rem">
            <div style="margin-left:auto;display:flex;gap:0.4rem">
              <button class="btn btn-sm btn-outline" id="lib-set-all-visible">Show All to Students</button>
              <button class="btn btn-sm btn-outline" id="lib-set-all-hidden">Hide All from Students</button>
            </div>
          </div>
          <div id="lib-results"></div>
          <div id="lib-pagination"></div>
        </div>
      </div>
    `);

    const typeEl = document.getElementById("lib-type");
    const subjEl = document.getElementById("lib-subject");
    const formEl = document.getElementById("lib-form");
    const searchEl = document.getElementById("lib-search");
    let searchTimer;

    function applyFilters() {
      filters.doc_type = typeEl.value;
      filters.subject_slug = subjEl.value;
      filters.form_level = formEl.value;
      page = 0;
      loadDocs().then(renderDocList);
    }

    typeEl?.addEventListener("change", applyFilters);
    subjEl?.addEventListener("change", applyFilters);
    formEl?.addEventListener("change", applyFilters);
    searchEl?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filters.query = searchEl.value.trim(); page = 0; loadDocs().then(renderDocList); }, 300);
    });

    document.getElementById("lib-results")?.addEventListener("change", async (e) => {
      const cb = e.target.closest("[data-toggle-vis]");
      if (!cb) return;
      const docId = cb.dataset.toggleVis;
      try {
        await request("/reference-docs/" + docId + "/visibility", {
          method: "PATCH",
          body: JSON.stringify({ visible_to_students: cb.checked }),
        });
      } catch (err) {
        cb.checked = !cb.checked;
        alert("Failed to update visibility");
      }
    });

    document.getElementById("lib-pagination")?.addEventListener("click", (e) => {
      if (e.target.id === "lib-prev") { page--; loadDocs().then(renderDocList); }
      if (e.target.id === "lib-next") { page++; loadDocs().then(renderDocList); }
    });

    document.getElementById("lib-set-all-visible")?.addEventListener("click", async () => {
      if (!confirm("Show ALL matching documents to students?")) return;
      const params = new URLSearchParams();
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
      if (filters.form_level) params.set("form_level", filters.form_level);
      try {
        await request("/reference-docs/admin/set-all-visibility?" + params.toString(), {
          method: "POST",
          body: JSON.stringify({ visible_to_students: true }),
        });
        await loadDocs();
        renderDocList();
      } catch(e) { alert("Failed"); }
    });

    document.getElementById("lib-set-all-hidden")?.addEventListener("click", async () => {
      if (!confirm("Hide ALL matching documents from students?")) return;
      const params = new URLSearchParams();
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
      if (filters.form_level) params.set("form_level", filters.form_level);
      try {
        await request("/reference-docs/admin/set-all-visibility?" + params.toString(), {
          method: "POST",
          body: JSON.stringify({ visible_to_students: false }),
        });
        await loadDocs();
        renderDocList();
      } catch(e) { alert("Failed"); }
    });

    await Promise.all([loadStats(), loadDocs()]);
    renderStats();
    renderDocList();
  }

;
// Facade — actual implementation split into admin-branding.js, admin-analytics.js,
// admin-settings.js, admin-settings-platform.js





  // Load initial view from URL hash, fallback to dashboard
  const initialView = location.hash.slice(1) || "dashboard";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadAdminOverview();
  }
}

;
  async function loadAdminBranding() {
    const API = window.casuyaApiBase ? window.casuyaApiBase() : ((window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80") ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:8765`);
    const token = localStorage.getItem("casuya_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    // Check what's currently uploaded
    let logoExists = false, faviconExists = false;
    const [lr, fr] = await Promise.all([
      fetch(`${API}/branding/logo`).catch(() => ({ ok: false })),
      fetch(`${API}/branding/favicon`).catch(() => ({ ok: false }))
    ]);
    logoExists = lr.ok;
    faviconExists = fr.ok;

    showAdminView(`
      <div class="content">
        <h2>🎨 Site Branding</h2>
        <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:1.5rem">Upload your logo and favicon. These appear across the entire platform.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
          <!-- Logo -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">🖼️ Logo</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${logoExists
                ? `<img src="${API}/branding/logo" alt="Current logo" style="max-width:120px;max-height:120px;border-radius:12px;border:1px solid var(--color-border)">`
                : `<div style="width:120px;height:120px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${logoExists ? "✅ Custom logo active" : "Using default"}</p>
            </div>
            <form id="logo-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="logo-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${logoExists ? "🔄 Replace" : "📤 Upload"}</button>
                ${logoExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="logo-delete">🗑️ Delete</button>' : ''}
              </div>
            </form>
            <div id="logo-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>

          <!-- Favicon -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">🏷️ Favicon</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${faviconExists
                ? `<img src="${API}/branding/favicon" alt="Current favicon" style="width:64px;height:64px;border-radius:8px;border:1px solid var(--color-border)">`
                : `<div style="width:64px;height:64px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${faviconExists ? "✅ Custom favicon active" : "Using default"}</p>
            </div>
            <form id="favicon-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="favicon-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${faviconExists ? "🔄 Replace" : "📤 Upload"}</button>
                ${faviconExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="favicon-delete">🗑️ Delete</button>' : ''}
              </div>
            </form>
            <div id="favicon-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>
        </div>
      </div>
    `);

    // Logo upload
    document.getElementById("logo-upload-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const file = document.getElementById("logo-file")?.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch(`${API}/branding/logo`, { method: "POST", headers, body: fd });
        const d = await r.json();
        if (r.ok) {
          document.getElementById("logo-result").innerHTML = '<span style="color:var(--color-success)">Logo uploaded!</span>';
          localStorage.removeItem("casuya_brand_logo");
          loadAdminBranding();
        } else {
          document.getElementById("logo-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(d.detail || "Failed")}</span>`;
        }
      } catch (e) {
        document.getElementById("logo-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(e.message)}</span>`;
      }
    });

    // Logo delete
    document.getElementById("logo-delete")?.addEventListener("click", async () => {
      try {
        await fetch(`${API}/branding/logo`, { method: "DELETE", headers });
        localStorage.removeItem("casuya_brand_logo");
        loadAdminBranding();
      } catch {}
    });

    // Favicon upload
    document.getElementById("favicon-upload-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const file = document.getElementById("favicon-file")?.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch(`${API}/branding/favicon`, { method: "POST", headers, body: fd });
        const d = await r.json();
        if (r.ok) {
          document.getElementById("favicon-result").innerHTML = '<span style="color:var(--color-success)">Favicon uploaded!</span>';
          localStorage.removeItem("casuya_brand_favicon");
          loadAdminBranding();
        } else {
          document.getElementById("favicon-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(d.detail || "Failed")}</span>`;
        }
      } catch (e) {
        document.getElementById("favicon-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(e.message)}</span>`;
      }
    });

    // Favicon delete
    document.getElementById("favicon-delete")?.addEventListener("click", async () => {
      try {
        await fetch(`${API}/branding/favicon`, { method: "DELETE", headers });
        localStorage.removeItem("casuya_brand_favicon");
        loadAdminBranding();
      } catch {}
    });
  }

;
  async function loadAdminAnalytics() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading analytics...</p></div>');
    try {
      const [overview, distribution] = await Promise.all([
        request("/analytics/overview"),
        request("/analytics/lesson-distribution").catch(() => []),
      ]);
      const lessons = await request("/lessons").catch(() => []);
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const perLesson = await Promise.all(
        lessonList.slice(0, 10).map(async (l) => {
          try {
            const a = await request(`/analytics/lessons/${l.id}`);
            return a ? { ...a, title: l.title } : null;
          } catch (e) { return null; }
        })
      );
      const lessonAnalytics = perLesson.filter(Boolean);
      showAdminView(`
        <div class="content">
          <h2>Analytics</h2>
          <div class="stat-grid" style="margin:1rem 0">
            <div class="stat-card"><div class="stat-value">${overview?.total_students ?? 0}</div><div class="stat-label">Students</div></div>
            <div class="stat-card"><div class="stat-value">${overview?.total_lessons ?? 0}</div><div class="stat-label">Lessons</div></div>
            <div class="stat-card"><div class="stat-value">${overview?.total_sessions ?? 0}</div><div class="stat-label">Sessions</div></div>
            <div class="stat-card"><div class="stat-value">${overview?.avg_completion_rate ?? 0}%</div><div class="stat-label">Avg Completion</div></div>
          </div>
          ${Array.isArray(distribution) && distribution.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Lesson Distribution</h3>
            <div class="card-grid">
              ${distribution.map(d => `
                <div class="card" style="padding:1rem">
                  <h4 style="margin:0 0 0.25rem">${escapeHtml(d.lesson_title || "Untitled Lesson")}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">${d.session_count ?? 0} sessions · ${d.avg_completion_percentage ?? 0}% completion</p>
                </div>
              `).join("")}
            </div>
          ` : ''}
          ${lessonAnalytics.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Per-Lesson Analytics</h3>
            <div class="card-grid">
              ${lessonAnalytics.map(a => `
                <div class="card" style="padding:1rem">
                  <h4 style="margin:0 0 0.25rem">${escapeHtml(a.title)}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">Sessions: ${a.session_count ?? 0} | Avg Completion: ${a.avg_completion_percentage ?? 0}% | Avg Score: ${a.avg_score_percentage ?? 0}%</p>
                </div>
              `).join("")}
            </div>
          ` : ''}
        </div>
      `);
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading analytics</p></div>'); }
  }

;
  function renderPlatformTab(panel, platformStatus, branding, API_BASE) {
    var ps = platformStatus || null;
    function _statusBadge(ok, okText, noText) {
      return ok
        ? '<span style="font-size:0.8rem;font-weight:600;color:var(--color-success)">● ' + okText + '</span>'
        : '<span style="font-size:0.8rem;font-weight:600;color:var(--color-danger)">● ' + noText + '</span>';
    }
    function _sourceBadge(src) {
      return src === "env"
        ? '<span style="font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:999px;background:var(--color-surface-2,#eef2f7);color:var(--color-text-muted)">env</span>'
        : '<span style="font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:999px;border:1px solid var(--color-border);color:var(--color-text-muted)">default</span>';
    }
    var runtimeHtml = '';
    if (ps && ps.runtime) {
      runtimeHtml = [
        ["Database", ps.runtime.database],
        ["Redis", ps.runtime.redis],
        ["SMTP/Email", ps.runtime.smtp],
      ].map(function (kv) {
        return '<div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;text-align:center">'
          + '<div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:0.25rem">' + kv[0] + '</div>'
          + _statusBadge(!!kv[1], "Healthy", "Down") + '</div>';
      }).join('');
      runtimeHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;margin:1rem 0 1.25rem">' + runtimeHtml + '</div>';
    }
    var backendHtml = '';
    if (ps && Array.isArray(ps.backend) && ps.backend.length) {
      var groups = {};
      ps.backend.forEach(function (v) { (groups[v.group] = groups[v.group] || []).push(v); });
      backendHtml = Object.keys(groups).map(function (g) {
        var rows = groups[g].map(function (v) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0.55rem 0;border-bottom:1px solid var(--color-border)">'
            + '<div style="min-width:0">'
            + '<div style="font-size:0.9rem">' + escapeHtml(v.label) + '</div>'
            + '<div style="font-size:0.72rem;font-family:monospace;color:var(--color-text-muted)">' + escapeHtml(v.name) + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">'
            + '<span style="font-size:0.8rem;color:var(--color-text-muted)">' + escapeHtml(v.value) + '</span>'
            + _sourceBadge(v.source)
            + (v.configured ? '<span style="color:var(--color-success);font-size:0.9rem">✓</span>' : '<span style="color:var(--color-danger);font-size:0.9rem">—</span>')
            + '</div></div>';
        }).join('');
        return '<div style="margin:0 0 0.25rem">'
          + '<div style="font-weight:600;font-size:0.85rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.04em;padding:0.6rem 0 0.25rem">' + escapeHtml(g) + '</div>'
          + rows + '</div>';
      }).join('');
    } else {
      backendHtml = '<p style="font-size:0.85rem;color:var(--color-text-muted)">Platform status unavailable.</p>';
    }
    var uiLang = (window.CasuyaI18n && typeof window.CasuyaI18n.getLang === "function") ? window.CasuyaI18n.getLang() : "en";
    var feVars = [
      ["API Base", window.API_BASE || ""],
      ["API Host", window.API_HOST || ""],
      ["API Protocol", window.API_PROTOCOL || ""],
      ["CASUYA_API_URL", window.CASUYA_API_URL || ""],
      ["UI Language", uiLang],
    ];
    var frontendHtml = feVars.map(function (v) {
      var set = !!v[1];
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0.55rem 0;border-bottom:1px solid var(--color-border)">'
        + '<div style="font-size:0.9rem">' + escapeHtml(v[0]) + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem">'
        + '<span style="font-size:0.8rem;font-family:monospace;color:var(--color-text-muted)">' + escapeHtml(String(v[1] || "(unset)")) + '</span>'
        + (set ? '<span style="color:var(--color-success);font-size:0.9rem">✓</span>' : '<span style="color:var(--color-danger);font-size:0.9rem">—</span>')
        + '</div></div>';
    }).join('');

    panel.innerHTML = `
      <div class="card" style="padding:1.5rem">
        <h3 style="margin-bottom:0.5rem">Platform Information</h3>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Environment</span>
          <strong style="font-size:0.9rem">${escapeHtml((ps && ps.environment) || (window.API_BASE ? "production" : "development"))}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">API Base</span>
          <strong style="font-size:0.9rem">${escapeHtml(API_BASE)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Logo</span>
          <strong style="font-size:0.9rem">${branding ? "Custom" : "Default"}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Version</span>
          <strong style="font-size:0.9rem">1.0.0</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0">
          <span style="color:var(--color-text-muted);font-size:0.9rem">Status</span>
          <span style="font-size:0.9rem;color:var(--color-success);font-weight:600">● Online</span>
        </div>

        <h3 style="margin:1.5rem 0 0.25rem">Runtime Health</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0">Live connectivity checks against the services the platform depends on.</p>
        ${runtimeHtml}

        <h3 style="margin:1.75rem 0 0.5rem">Backend Environment Variables</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted)">Configured status of every backend setting, drawn from environment variables. Secret values are masked. <span style="font-size:0.8rem">env = set in the environment · default = using the bundled default.</span></p>
        ${backendHtml}

        <h3 style="margin:1.75rem 0 0.5rem">Frontend Environment</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted)">Values resolved in the browser from the served frontend.</p>
        ${frontendHtml}
      </div>
      <div class="card" style="padding:1.5rem;margin-top:1rem" id="module-visibility-card">
        <h3 style="margin-bottom:0.25rem">Module Visibility</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:1rem">Toggle which sidebar modules are visible to students and teachers. Hidden modules can be re-enabled anytime.</p>
        <div id="module-vis-loading" style="text-align:center;padding:1rem;color:var(--color-text-muted);font-size:0.85rem">Loading...</div>
      </div>
      <div class="card" style="padding:1.5rem;margin-top:1rem">
        <h3 style="margin-bottom:0.75rem">⚠️ Danger Zone</h3>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">Irreversible actions</p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm btn-pattern" id="clear-cache-btn">🗑️ Clear Cache</button>
          <button class="btn btn-outline-danger btn-sm" id="export-data-btn">📦 Export All Data</button>
        </div>
        <div id="danger-msg" style="font-size:0.85rem;margin-top:0.5rem"></div>
      </div>
    `;
    document.getElementById("clear-cache-btn")?.addEventListener("click", () => {
      requestCache.clear();
      const msg = document.getElementById("danger-msg");
      msg.textContent = "In-memory cache cleared"; msg.style.color = "var(--color-success)";
    });
    document.getElementById("export-data-btn")?.addEventListener("click", async () => {
      const msg = document.getElementById("danger-msg");
      try {
        const [students, teachers, subjects, lessons] = await Promise.all([
          request("/students"), request("/teachers"), request("/subjects"), request("/lessons"),
        ]);
        const data = { students, teachers, subjects, lessons, exported_at: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "casuya-export.json"; a.click();
        URL.revokeObjectURL(url);
        msg.textContent = "Data exported"; msg.style.color = "var(--color-success)";
      } catch(err) { msg.textContent = err.message; msg.style.color = "var(--color-danger)"; }
    });
    (async function() {
      var loading = document.getElementById("module-vis-loading");
      if (!loading) return;
      try {
        var vis = await request("/settings/modules");
        var studentMods = vis.student || {};
        var teacherMods = vis.teacher || {};
        var studentLabels = {dashboard:"Dashboard",subjects:"Subjects",progress:"Progress",bookmarks:"Bookmarks",assignments:"Assignments",games:"Games",downloads:"Downloads",exams:"Exams",files:"Files","test-generator":"Test Generator",library:"Reference Library",payments:"Payments",notifications:"Notifications",settings:"Settings"};
        var teacherLabels = {overview:"Overview",class:"My Class",students:"Students",lessons:"Lessons",assignments:"Assignments",reports:"Reports","ai-assistant":"AI Assistant","teaching-docs":"Teaching Docs",bookmarks:"Bookmarks",files:"Files","test-generator":"Test Generator",library:"Reference Library",payments:"Payments",notifications:"Notifications",settings:"Settings"};
        function buildSection(title, mods, labels) {
          var html = '<div style="margin-bottom:1rem"><div style="font-weight:600;font-size:0.9rem;margin-bottom:0.5rem">' + title + '</div>';
          var keys = Object.keys(labels);
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var enabled = mods[key] !== false;
            html += '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--color-border);cursor:pointer;font-size:0.85rem">';
            html += '<input type="checkbox" data-role="' + title.toLowerCase() + '" data-mod="' + key + '"' + (enabled ? ' checked' : '') + ' style="accent-color:var(--color-primary);width:16px;height:16px">';
            html += '<span>' + labels[key] + '</span>';
            html += '</label>';
          }
          html += '</div>';
          return html;
        }
        loading.outerHTML = buildSection("Student", studentMods, studentLabels) + buildSection("Teacher", teacherMods, teacherLabels) + '<p id="module-vis-msg" style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.5rem"></p>';
        document.querySelectorAll("#module-visibility-card input[type=checkbox]").forEach(function(cb) {
          cb.addEventListener("change", async function() {
            var msg = document.getElementById("module-vis-msg");
            var studentData = {};
            var teacherData = {};
            document.querySelectorAll("#module-visibility-card input[type=checkbox]").forEach(function(c) {
              var role = c.getAttribute("data-role");
              var mod = c.getAttribute("data-mod");
              if (role === "student") studentData[mod] = c.checked;
              else teacherData[mod] = c.checked;
            });
            try {
              await request("/settings/modules", { method: "PUT", body: JSON.stringify({ student: studentData, teacher: teacherData }) });
              msg.textContent = "Saved"; msg.style.color = "var(--color-success)";
              setTimeout(function() { msg.textContent = ""; }, 2000);
            } catch(e) {
              msg.textContent = "Error: " + e.message; msg.style.color = "var(--color-danger)";
            }
          });
        });
      } catch(e) {
        loading.outerHTML = '<p style="color:var(--color-danger);font-size:0.85rem">Failed to load module settings</p>';
      }
    })();
  }

;
  async function loadAdminSettings() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [profile, branding, platformStatus, maintenance] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/branding/logo").catch(() => null),
        request("/settings/platform-status").catch(() => null),
        request("/settings/maintenance").catch(() => null),
      ]);
      const activeTab = localStorage.getItem("admin_settings_tab") || "profile";

      function renderTab(tab) {
        localStorage.setItem("admin_settings_tab", tab);
        document.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        const panel = document.getElementById("settings-panel");
        if (!panel) return;

        if (tab === "profile") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Admin Profile</h3>
              <form id="admin-profile-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Full Name</label>
                  <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" placeholder="Your name">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Email</label>
                  <input class="input" value="${escapeHtml(profile.email || "")}" disabled style="opacity:0.6">
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">Email cannot be changed here</p>
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Phone</label>
                  <input class="input" name="phone" value="${escapeHtml(profile.phone || "")}" placeholder="Phone number">
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center">
                  <button class="btn btn-primary" type="submit">💾 Save Profile</button>
                  <span id="admin-profile-msg" style="font-size:0.85rem;display:none"></span>
                </div>
              </form>
            </div>
          `;
          document.getElementById("admin-profile-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("admin-profile-msg");
            try {
              await request("/users/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), phone: fd.get("phone") }) });
              msg.textContent = "✅ Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
          });
        } else if (tab === "security") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Change Password</h3>
              <form id="admin-pw-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Current Password</label>
                  <input class="input" name="current_password" type="password" required>
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">New Password</label>
                  <input class="input" name="new_password" type="password" required minlength="8">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Confirm New Password</label>
                  <input class="input" name="confirm_password" type="password" required>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center">
                  <button class="btn btn-primary btn-pattern" type="submit">🔐 Update Password</button>
                  <span id="admin-pw-msg" style="font-size:0.85rem;display:none"></span>
                </div>
              </form>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3 style="margin-bottom:0.75rem">Active Sessions</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">Manage your login sessions</p>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
                <div>
                  <p style="font-weight:500;margin:0;font-size:0.9rem">Current Session</p>
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin:0.15rem 0 0">Now · ${navigator.userAgent.slice(0, 60)}...</p>
                </div>
                <span style="color:var(--color-success);font-size:0.8rem;font-weight:600">🟢 Active</span>
              </div>
            </div>
          `;
          document.getElementById("admin-pw-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("admin-pw-msg");
            if (fd.get("new_password") !== fd.get("confirm_password")) {
              msg.textContent = "❌ Passwords do not match"; msg.style.color = "var(--color-danger)"; msg.style.display = "inline";
              return;
            }
            try {
              await request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), new_password: fd.get("new_password") }) });
              msg.textContent = "✅ Password updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              e.target.reset();
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
          });
        } else if (tab === "notifications") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Notification Preferences</h3>
              <form id="admin-notif-prefs-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer">
                  <input type="checkbox" name="email_notifs" checked> Email notifications for new users
                </label>
                <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer">
                  <input type="checkbox" name="payment_notifs" checked> Payment confirmations
                </label>
                <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer">
                  <input type="checkbox" name="system_notifs" checked> System alerts and errors
                </label>
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">💾 Save Preferences</button>
              </form>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3 style="margin-bottom:0.75rem">Send Bulk Notification</h3>
              <form id="settings-notify-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <select class="input" name="target" required>
                  <option value="all">All Users</option>
                  <option value="students">All Students</option>
                  <option value="teachers">All Teachers</option>
                </select>
                <textarea class="input" name="message" rows="3" placeholder="Notification message..." required></textarea>
                <button class="btn btn-primary btn-pattern" type="submit">📤 Send</button>
              </form>
              <div id="settings-notify-result" style="margin-top:0.5rem;font-size:0.85rem"></div>
            </div>
          `;
          document.getElementById("settings-notify-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const target = fd.get("target");
            const message = fd.get("message");
            try {
              if (target === "all") {
                await request("/notifications/bulk", { method: "POST", body: JSON.stringify({ role: "student", message }) });
                await request("/notifications/bulk", { method: "POST", body: JSON.stringify({ role: "teacher", message }) });
              } else {
                await request("/notifications/bulk", { method: "POST", body: JSON.stringify({ role: target === "students" ? "student" : "teacher", message }) });
              }
              document.getElementById("settings-notify-result").innerHTML = '<span style="color:var(--color-success)">Notification sent!</span>';
              e.target.reset();
            } catch(err) {
              document.getElementById("settings-notify-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(err.message)}</span>`;
            }
          });
        } else if (tab === "platform") {
          renderPlatformTab(panel, platformStatus, branding, API_BASE);
        } else if (tab === "appearance") {
          panel.innerHTML = appearancePanelHTML();
          setupAppearanceControls();
        } else if (tab === "maintenance") {
          var maint = maintenance || { enabled: false, title: "", message: "", until: null };
          var maintUntil = maint.until ? maint.until.slice(0, 16) : "";
          var maintIsOn = !!maint.enabled;
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:0.5rem">
                <div>
                  <h3 style="margin:0">Maintenance Mode</h3>
                  <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0.25rem 0 0">While enabled, students and teachers can still sign up and sign in, but they'll see a friendly "we'll be back soon" page after login. You keep full access.</p>
                </div>
                <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.9rem;font-weight:600;cursor:pointer;flex-shrink:0">
                  <input type="checkbox" id="maint-enabled"${maintIsOn ? " checked" : ""}>
                  <span style="color:${maintIsOn ? "var(--color-danger)" : "var(--color-text-muted)"}">${maintIsOn ? "Maintenance is ON" : "Maintenance is OFF"}</span>
                </label>
              </div>
              <div id="maint-body" style="${maintIsOn ? "" : "opacity:0.45;pointer-events:none"}">
                <div style="margin-top:1rem">
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Headline</label>
                  <input class="input" id="maint-title" value="${escapeHtml(maint.title || "We'll Be Back Soon")}" placeholder="We'll Be Back Soon" maxlength="60">
                </div>
                <div style="margin-top:0.75rem">
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Message</label>
                  <textarea class="input" id="maint-message" rows="4" placeholder="A warm, reassuring note for your users...">${escapeHtml(maint.message || "")}</textarea>
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">Keep it warm and hopeful. This is shown on the maintenance page.</p>
                </div>
                <div style="margin-top:0.75rem">
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Available again at</label>
                  <input class="input" type="datetime-local" id="maint-until" value="${escapeHtml(maintUntil)}">
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">The date and time users should expect to get back in. Optional.</p>
                </div>
              </div>
              <div style="display:flex;gap:0.5rem;align-items:center;margin-top:1rem">
                <button class="btn btn-primary" type="button" id="maint-save">Save Maintenance Settings</button>
                <span id="maint-msg" style="font-size:0.85rem;display:none"></span>
              </div>
            </div>
          `;
          var enabledInput = document.getElementById("maint-enabled");
          enabledInput.addEventListener("change", function () {
            var body = document.getElementById("maint-body");
            body.style.opacity = enabledInput.checked ? "" : "0.45";
            body.style.pointerEvents = enabledInput.checked ? "" : "none";
            document.getElementById("maint-enabled").parentElement.querySelector("span").style.color = enabledInput.checked ? "var(--color-danger)" : "var(--color-text-muted)";
            document.getElementById("maint-enabled").parentElement.querySelector("span").textContent = enabledInput.checked ? "Maintenance is ON" : "Maintenance is OFF";
          });
          document.getElementById("maint-save").addEventListener("click", async function () {
            var msg = document.getElementById("maint-msg");
            var until = document.getElementById("maint-until").value;
            try {
              await request("/settings/maintenance", {
                method: "PUT",
                body: JSON.stringify({
                  enabled: enabledInput.checked,
                  title: document.getElementById("maint-title").value,
                  message: document.getElementById("maint-message").value,
                  until: until ? new Date(until).toISOString() : null,
                }),
              });
              msg.textContent = "Saved. Maintenance " + (enabledInput.checked ? "is now ON." : "is now OFF."); msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              setTimeout(function () { msg.style.display = "none"; }, 3500);
            } catch(err) { msg.textContent = "Error: " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
          });
        }
      }

      showAdminView(`
        <div class="content">
          <h2>Settings</h2>
          <div class="tab-bar">
            <button class="tab-btn settings-tab-btn${activeTab === "profile" ? " active" : ""}" data-tab="profile">👤 Profile</button>
            <button class="tab-btn settings-tab-btn${activeTab === "security" ? " active" : ""}" data-tab="security">🔒 Security</button>
            <button class="tab-btn settings-tab-btn${activeTab === "notifications" ? " active" : ""}" data-tab="notifications">🔔 Notifications</button>
            <button class="tab-btn settings-tab-btn${activeTab === "platform" ? " active" : ""}" data-tab="platform">⚙️ Platform</button>
            <button class="tab-btn settings-tab-btn${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">🎨 Appearance</button>
            <button class="tab-btn settings-tab-btn${activeTab === "maintenance" ? " active" : ""}" data-tab="maintenance">🛠️ Maintenance</button>
          </div>
          <div id="settings-panel"></div>
        </div>
      `);

      document.querySelectorAll(".settings-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => renderTab(btn.dataset.tab));
      });
      renderTab(activeTab);
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading settings</p></div>'); }
  }

;
// modules/dashboards.js — extracted from main.js (classic script, shared global scope)
function renderApp() {
  const token = localStorage.getItem("casuya_token");
  const payload = decodeToken(token);
  const role = payload.role || "student";
  if (role === "admin") {
    renderAdminDashboard();
  } else if (role === "student") {
    renderStudentDashboard();
  } else if (role === "teacher") {
    renderTeacherDashboard();
  } else {
    render("#app", `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center">
        <h2 style="margin-bottom:0.5rem">Access Not Available</h2>
        <p style="color:var(--color-text-muted);margin-bottom:1.5rem">Your account role ("<strong>${escapeHtml(role || "unknown")}</strong>") does not have a dashboard yet.</p>
        <button class="btn btn-primary" onclick="localStorage.removeItem('casuya_token');window.location.href='/login.html'">Log Out</button>
      </div>
    `);
  }
}

;
// main.js — bootstrap/glue. Loaded AFTER modules/*.js (classic scripts, shared global scope).
// Derive the API base the same way auth-client.js does: when the page is
// served from the API host (port 8765) use same-origin, otherwise assume the
// backend runs on :8765. This keeps dev (separate frontend port) and a
// reverse-proxied production deploy behaviour consistent.
// --- Login ---
// --- App Router ---
// --- Student Dashboard ---
// --- Admin Dashboard ---
// --- Teacher Dashboard ---
document.addEventListener("DOMContentLoaded", async () => {
  applyAppearance();
  const token = localStorage.getItem("casuya_token");
  if (token) {
    // Render the shell immediately. The maintenance check runs in parallel and
    // overlays the maintenance screen only if it's actually enabled — otherwise
    // it used to block every page load on a server round-trip.
    renderApp();
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(function () {
        if (typeof ensureSpeechBundle === "function") ensureSpeechBundle();
      }, { timeout: 8000 });
    }
    try {
      const data = await request("/settings/maintenance");
      if (data && data.enabled === true && localStorage.getItem("casuya_role") !== "admin") {
        renderMaintenanceScreen(data);
      }
    } catch (_) {}
  } else {
    renderLogin();
  }
});

function renderMaintenanceScreen(data) {
  var app = document.getElementById("app");
  if (app) app.style.visibility = "hidden";
  if (document.getElementById("casuya-maintenance")) return;
  var fmt = data.until ? new Date(data.until) : null;
  var whenHtml = "";
  if (fmt && !isNaN(fmt.getTime())) {
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var whenText = days[fmt.getDay()] + ", " + months[fmt.getMonth()] + " " + fmt.getDate() + (fmt.getHours()||fmt.getMinutes() ? " at " + (fmt.getHours()%12||12) + ":" + (fmt.getMinutes()<10?"0":"") + fmt.getMinutes() + (fmt.getHours()>=12?" PM":" AM") + " EAT" : "");
    whenHtml = '<p style="margin:1.25rem 0 0;font-size:1rem;color:rgba(255,255,255,0.92);font-weight:600">' + "We should be back by <span style='border-bottom:2px solid rgba(255,255,255,0.55)'>&nbsp;" + whenText + "&nbsp;</span></p>";
  }
  var overlay = document.createElement("div");
  overlay.id = "casuya-maintenance";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:linear-gradient(140deg,#1e3a8a 0%,#2563eb 55%,#3b82f6 100%);color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;overflow:auto";
  overlay.innerHTML = '<div style="max-width:560px;width:100%">'
    + '<div style="width:56px;height:56px;margin:0 auto 1.25rem;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.15);border-radius:16px;font-size:1.7rem">🔧</div>'
    + '<h1 style="margin:0 0 0.75rem;font-size:1.85rem;line-height:1.2;font-weight:800">' + (data.title || "We'll Be Back Soon") + '</h1>'
    + '<p style="margin:0 auto;font-size:1.05rem;line-height:1.7;color:rgba(255,255,255,0.92);max-width:460px">' + (data.message || "We're fixing bugs and making improvements to Casuya to serve you even better. Your learning progress is safe with us — hang tight, we're almost ready to welcome you back.") + '</p>'
    + whenHtml
    + '<p style="margin:1.5rem 0 0;font-size:0.9rem;color:rgba(255,255,255,0.85)">Need urgent assistance? Contact us at <a href="mailto:admin@casuya.co.tz" style="color:#fff;font-weight:600;text-decoration:underline">admin@casuya.co.tz</a></p>'
    + '<p style="margin:1.25rem 0 0;font-size:0.85rem;color:rgba(255,255,255,0.7)">Thank you for your patience — see you very soon. 💙</p>'
    + '</div>';
  document.body.appendChild(overlay);
}
