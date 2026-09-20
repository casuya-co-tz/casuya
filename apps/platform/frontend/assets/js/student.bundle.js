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
      const markingSplit = rawBody.split(/\n(?=\*?\*?(?:Model Answer|Marking Scheme|Jibu)/i);
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
var TUTOR_QA_MAX = 20;

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
      var req = indexedDB.open(TUTOR_QA_IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(TUTOR_QA_STORE)) {
          db.createObjectStore(TUTOR_QA_STORE, { keyPath: "id" });
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
  try {
    sessionStorage.setItem(key, JSON.stringify((messages || []).slice(-8)));
  } catch (e) {}
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
        container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
          callbacks.errorMessage || "The AI tutor is temporarily unavailable."
        ) + "</div>";
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
          container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
            callbacks.errorMessage || "The AI tutor could not be reached."
          ) + "</div>";
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
// modules/student/dashboard/state.js — StudentDashboard shared state + view routing.
//
// Holds shared state as class properties and provides the core navigation
// and view registry methods. The class is completed by sidebar.js and
// bootstrap.js (which extend StudentDashboard.prototype).

"use strict";

class StudentDashboard {
  constructor() {
    this.token = localStorage.getItem("casuya_token");
    this.payload = decodeToken(this.token);
    this._navStack = [];
    this._subtopicLessonList = [];
    this._recentlyViewedCache = null;
    this._recentlyViewedCacheTs = 0;
    this._views = {};
    this._navItems = null;
  }

  // ── Recently-viewed cache (localStorage, 5 s TTL) ──────────────────
  getRecentlyViewed() {
    const now = Date.now();
    if (this._recentlyViewedCache === null || now - this._recentlyViewedCacheTs > 5000) {
      this._recentlyViewedCache = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      this._recentlyViewedCacheTs = now;
    }
    return this._recentlyViewedCache;
  }

  // ── Navigation helpers ──────────────────────────────────────────────
  goBack() {
    if (this._navStack.length > 0) {
      const prev = this._navStack.pop();
      prev();
    } else {
      this.callView("dashboard");
    }
  }

  showView(content) {
    const el = document.getElementById("student-content");
    if (el) el.innerHTML = content;
  }

  setActiveNav(viewId) {
    if (!this._navItems) {
      this._navItems = document.querySelectorAll("#student-nav .sidebar-nav-item");
    }
    this._navItems.forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  navigateTo(view) {
    if (this._views[view]) {
      location.hash = view;
      this._views[view]();
    }
  }

  // ── View registry ───────────────────────────────────────────────────
  registerView(name, handler) {
    this._views[name] = handler;
  }

  callView(name, ...args) {
    if (this._views[name]) return this._views[name](...args);
  }
}
;
// modules/student/dashboard/sidebar.js — StudentDashboard sidebar lifecycle.
// Extends StudentDashboard.prototype with shell render + sidebar wiring.

Object.assign(StudentDashboard.prototype, {
  // ── Render sidebar + main shell ─────────────────────────────────────
  _renderShell() {
    render("#app", `
      <div class="sidebar-layout">
        <aside id="student-sidebar" class="sidebar">
          <div class="sidebar-header">
            <h2>Casuya</h2>
            <p>${escapeHtml(this.payload.full_name || this.payload.email || "Student")}</p>
          </div>
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--color-border)">
            <select id="form-filter" class="input" style="padding:0.4rem;font-size:0.85rem">
              <option value="">All Forms</option>
              <option value="Form I">Form I</option>
              <option value="Form II">Form II</option>
              <option value="Form III">Form III</option>
              <option value="Form IV">Form IV</option>
              <option value="Form V">Form V</option>
              <option value="Form VI">Form VI</option>
            </select>
          </div>
          <nav class="sidebar-nav" id="student-nav">
            <div class="sidebar-nav-item active" data-view="dashboard">🏠 Dashboard</div>
            <div class="sidebar-nav-item" data-view="class">🏫 My Class</div>
            <div class="sidebar-nav-item" data-view="subjects">📚 Subjects</div>
            <div class="sidebar-nav-item" data-view="progress">📊 Progress</div>
            <div class="sidebar-nav-item" data-view="bookmarks">🔖 Bookmarks</div>
            <div class="sidebar-nav-item" data-view="assignments">📋 Assignments</div>
            <div class="sidebar-nav-item" data-view="games">🎮 Games</div>
            <div class="sidebar-nav-item" data-view="downloads">📥 Downloads</div>
            <div class="sidebar-nav-item" data-view="library">📖 Reference Library</div>
            <div class="sidebar-nav-item" data-view="exams">📝 Exams</div>
            <div class="sidebar-nav-item" data-view="test-generator">📝 Test Generator</div>
            <div class="sidebar-nav-item" data-view="files">📁 Files</div>
            <div class="sidebar-nav-item" data-view="payments">💳 Payments</div>
            <div class="sidebar-nav-item" data-view="notifications">🔔 Notifications</div>
            <div class="sidebar-nav-item" data-view="settings">⚙️ Settings</div>
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-footer-row">
              <div style="position:relative;flex:1">
                <button id="notif-bell" class="icon-btn" style="width:100%;font-size:1.1rem" title="Notifications">🔔<span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-6px;background:red;color:#fff;font-size:0.6rem;padding:1px 4px;border-radius:8px;min-width:14px;text-align:center">0</span></button>
                <div id="notif-dropdown" class="notif-dropdown"></div>
              </div>
              <div style="position:relative">
                <button id="profile-btn" class="icon-btn" title="Profile">👤</button>
                <div id="profile-dropdown" class="profile-dropdown">
                  <button class="dropdown-item" id="prof-edit">Edit Profile</button>
                  <button class="dropdown-item" id="prof-logout" style="color:var(--color-danger)">Sign Out</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main class="main-content">
          <header class="main-header">
            <button id="sidebar-toggle" class="sidebar-toggle-btn">&#9776;</button>
            <div style="position:relative;flex:1;max-width:360px">
              <input id="student-search" type="search" class="input" placeholder="Search lessons..." style="padding:0.4rem 0.75rem;font-size:0.85rem">
              <div id="student-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);z-index:100;max-height:300px;overflow-y:auto"></div>
            </div>
          </header>
          <div id="student-content" class="main-body"></div>
        </main>
      </div>
    `);
  },

  // ── Sidebar styles (mobile) ─────────────────────────────────────────
  _injectSidebarStyles() {
    if (!document.getElementById("sidebar-styles")) {
      const style = document.createElement("style");
      style.id = "sidebar-styles";
      style.textContent = `@media(max-width:1024px){.sidebar{position:fixed;z-index:200;left:-260px;transition:left .25s ease;height:100vh}.sidebar.open{left:0;box-shadow:4px 0 20px rgba(0,0,0,.15)}.sidebar-toggle-btn{display:block!important}}`;
      document.head.appendChild(style);
    }
  },

  // ── Sidebar toggle (mobile) ─────────────────────────────────────────
  _setupSidebarToggle() {
    document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
      document.getElementById("student-sidebar").classList.toggle("open");
    }, { signal: _globalAbort.signal });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#student-sidebar") && !e.target.closest("#sidebar-toggle")) {
        document.getElementById("student-sidebar")?.classList.remove("open");
      }
    }, { signal: _globalAbort.signal });
  },

  // ── Sidebar navigation wiring ───────────────────────────────────────
  _setupNavigation() {
    const self = this;
    document.querySelectorAll("#student-nav .sidebar-nav-item").forEach(el => {
      el.addEventListener("click", () => {
        document.getElementById("student-sidebar")?.classList.remove("open");
        self.navigateTo(el.dataset.view);
      });
    });
  },

  // ── Profile dropdown ────────────────────────────────────────────────
  _setupProfileDropdown() {
    const self = this;
    document.getElementById("profile-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = document.getElementById("profile-dropdown");
      dd.style.display = dd.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (e) => {
      const pd = document.getElementById("profile-dropdown");
      if (pd && !e.target.closest("#profile-btn") && !e.target.closest("#profile-dropdown")) pd.style.display = "none";
    }, { signal: _globalAbort.signal });

    document.getElementById("prof-logout").addEventListener("click", handleLogout);
    document.getElementById("prof-edit").addEventListener("click", () => {
      document.getElementById("profile-dropdown").style.display = "none";
      self.callView("profile");
    });
  },
});
;
// modules/student/dashboard/bootstrap.js — StudentDashboard startup/lifecycle helpers.
// Extends StudentDashboard.prototype with init + feature setups.

Object.assign(StudentDashboard.prototype, {
  // ── Bootstrap ───────────────────────────────────────────────────────
  async init() {
    this._applyA11yPrefs();
    this._renderShell();
    this._injectSidebarStyles();
    this._setupSidebarToggle();
    this._setupFormFilter();
    this._setupSearch();
    this._setupNotifications();
    this._setupProfileDropdown();
    this._setupNavigation();
    this._applyModuleVisibility();
    this._setupHashListener();
    this._loadInitialView();
  },

  // ── Accessibility preferences ───────────────────────────────────────
  _applyA11yPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem("casuya_accessibility_prefs") || "null");
      if (prefs) {
        if (prefs.pref_dyslexia) document.body.classList.add("dyslexia-mode");
        if (prefs.pref_high_contrast) document.body.classList.add("high-contrast");
        if (prefs.pref_larger_text) document.body.style.fontSize = "1.15em";
        if (prefs.pref_tts) document.body.setAttribute("data-tts-enabled", "true");
      }
    } catch (e) {}
  },

  // ── Form filter (persisted) ─────────────────────────────────────────
  _normalizeFormFilter(value) {
    if (!value) return "";
    const roman = { I: "Form I", II: "Form II", III: "Form III", IV: "Form IV", V: "Form V", VI: "Form VI" };
    if (roman[value]) return roman[value];
    if (/^Form\s/i.test(value)) return value.replace(/^form\s/i, "Form ");
    return value;
  },

  _setupFormFilter() {
    const formFilterEl = document.getElementById("form-filter");
    const savedFormFilter = this._normalizeFormFilter(localStorage.getItem("casuya_form_filter") || "");
    if (this.payload.form_level && !savedFormFilter) {
      const normalized = this._normalizeFormFilter(this.payload.form_level);
      localStorage.setItem("casuya_form_filter", normalized);
      formFilterEl.value = normalized;
    } else if (savedFormFilter) {
      formFilterEl.value = savedFormFilter;
    }
    formFilterEl.addEventListener("change", (e) => {
      localStorage.setItem("casuya_form_filter", e.target.value);
      this.callView("subjects");
    });
  },

  // ── Search functionality ────────────────────────────────────────────
  _setupSearch() {
    const searchInput = document.getElementById("student-search");
    const searchResults = document.getElementById("student-search-results");
    let searchTimer;
    let searchSeq = 0;
    const self = this;

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (q.length < 2) { searchResults.style.display = "none"; return; }
      const mySeq = ++searchSeq;
      searchTimer = setTimeout(async () => {
        try {
          const results = await request(`/search/?q=${encodeURIComponent(q)}`);
          if (mySeq !== searchSeq) return;
          if (!Array.isArray(results) || results.length === 0) {
            searchResults.innerHTML = '<div style="padding:0.5rem;color:var(--color-text-muted)">No results</div>';
          } else {
            searchResults.innerHTML = results.map(r => `
              <div class="search-item" data-id="${escapeHtml(r.id)}" data-type="${escapeHtml(r.type)}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between">
                <span>${escapeHtml(r.title)}</span>
                <span style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(r.type)}</span>
              </div>
            `).join("");
            searchResults.querySelectorAll(".search-item").forEach(el => {
              el.addEventListener("click", () => {
                searchResults.style.display = "none";
                searchInput.value = "";
                if (el.dataset.type === "lesson") self.callView("lesson", el.dataset.id);
              });
            });
          }
          searchResults.style.display = "block";
        } catch(e) { searchResults.style.display = "none"; }
      }, 300);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#student-search") && !e.target.closest("#student-search-results")) searchResults.style.display = "none";
    }, { signal: _globalAbort.signal });
  },

  // ── Notifications bell ──────────────────────────────────────────────
  _setupNotifications() {
    const self = this;
    const notifBell = document.getElementById("notif-bell");
    const notifDropdown = document.getElementById("notif-dropdown");
    const notifBadge = document.getElementById("notif-badge");
    let notifData = [];

    async function loadNotifs() {
      try {
        const res = await request("/notifications");
        notifData = Array.isArray(res?.items) ? res.items : [];
        const unread = notifData.filter(n => !n.is_read).length;
        if (unread > 0) { notifBadge.textContent = unread; notifBadge.style.display = "inline"; }
        else notifBadge.style.display = "none";
      } catch(e) {}
    }

    notifBell.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (notifDropdown.style.display === "block") { notifDropdown.style.display = "none"; return; }
      await loadNotifs();
      if (notifData.length === 0) {
        notifDropdown.innerHTML = '<div style="padding:0.75rem;color:var(--color-text-muted)">No notifications</div>';
      } else {
        notifDropdown.innerHTML = notifData.map(n => `
          <div class="notif-item ${n.is_read ? "" : "unread"}" data-id="${escapeHtml(n.id)}" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--color-border);${n.is_read ? "opacity:0.6" : "font-weight:600"}">
            <p style="margin:0;font-size:0.85rem">${escapeHtml(n.message)}</p>
          </div>
        `).join("");
        notifDropdown.querySelectorAll(".notif-item.unread").forEach(el => {
          el.addEventListener("click", async () => {
            await request(`/notifications/${el.dataset.id}/read`, { method: "POST" });
            await loadNotifs();
          });
        });
      }
      notifDropdown.style.display = "block";
    });
    document.addEventListener("click", (e) => { if (!e.target.closest("#notif-bell") && !e.target.closest("#notif-dropdown")) notifDropdown.style.display = "none"; }, { signal: _globalAbort.signal });
  },

  // ── Module visibility (admin-controlled) ────────────────────────────
  async _applyModuleVisibility() {
    try {
      const vis = await request("/settings/modules/my");
      if (!vis || typeof vis !== "object") return;
      const items = document.querySelectorAll("#student-nav .sidebar-nav-item");
      let firstEnabled = null;
      items.forEach(el => {
        const view = el.getAttribute("data-view");
        if (vis[view] === false) {
          el.style.display = "none";
        } else if (!firstEnabled) {
          firstEnabled = view;
        }
      });
      const currentHash = location.hash.slice(1) || "dashboard";
      if (vis[currentHash] === false && firstEnabled) {
        this.navigateTo(firstEnabled);
      }
    } catch(e) {}
  },

  // ── Hash change listener ────────────────────────────────────────────
  _setupHashListener() {
    const self = this;
    window.addEventListener("hashchange", () => {
      const view = location.hash.slice(1) || "dashboard";
      if (self._views[view]) self._views[view]();
    });
  },

  // ── Load initial view from URL hash ─────────────────────────────────
  _loadInitialView() {
    const initialView = location.hash.slice(1) || "dashboard";
    if (this._views[initialView]) {
      this._views[initialView]();
    } else {
      this.callView("dashboard");
    }
  },
});
;
// modules/student/sidebar.js — sidebar helpers for student dashboard.
//
// Provides the updateNotifBadge helper used by the notifications view
// and the getFormFilter helper used by the subjects view. The sidebar
// HTML rendering and event wiring live in StudentDashboard (dashboard.js).

"use strict";

function updateNotifBadge(count) {
  const badge = document.getElementById("notif-badge");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline" : "none";
  }
}

function getFormFilter() {
  return localStorage.getItem("casuya_form_filter") || "";
}

;
// modules/student/utils.js — shared utilities for student dashboard views.
//
// Provides convenience aliases for global functions used across view modules.
// All globals (escapeHtml, request, render, showToast, etc.) are already
// available in the shared global scope — these are re-exported for clarity.

"use strict";

const studentUtils = Object.freeze({
  escapeHtml,
  decodeToken,
  render,
  request,
  showToast,
  timeAgo,
  handleLogout,
  examPaperMetaLine,
  renderExamPaper,
  bindExamScore,
  injectNodeBase,
  appearancePanelHTML,
  setupAppearanceControls,
  get API_BASE() { return API_BASE; },
  get globalAbort() { return _globalAbort; },
});

;
// modules/student/overview.js — dashboard overview with recently viewed,
// stats, class connection status, and subject cards.

"use strict";

function registerOverviewView(d) {
  async function loadStudentOverview() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading dashboard...</p></div>');
    try {
      const dash = await request("/students/me/dashboard");
      const profile = dash.profile || null;
      const classRes = dash.classroom || {};
      const subjects = dash.subjects || [];

      const isConnected = !!(classRes && classRes.classroom);
      const classTeacher = classRes?.teacher?.name || "";

      const name = profile?.full_name || d.payload.full_name || d.payload.email || "Student";
      const formLevel = profile?.form_level || "";

      const subjectList = Array.isArray(subjects) ? subjects : [];
      const iconColors = [
        { bg: "#eff6ff", color: "#2563eb", emoji: "📚" },
        { bg: "#f0fdf4", color: "#16a34a", emoji: "🧬" },
        { bg: "#fef3c7", color: "#d97706", emoji: "📐" },
        { bg: "#fce7f3", color: "#db2777", emoji: "🧪" },
        { bg: "#ede9fe", color: "#7c3aed", emoji: "🌍" },
        { bg: "#e0f2fe", color: "#0284c7", emoji: "💻" },
      ];

      let progressBySubject = [];
      let totalCompleted = 0;
      let avgScore = 0;
      let streak = 0;
      let recent = [];
      let lessonsViewed = 0;
      try {
        const stats = dash.stats || {};
        progressBySubject = Array.isArray(dash.progress_by_subject) ? dash.progress_by_subject : [];
        totalCompleted = stats.totalCompleted || progressBySubject.reduce((sum, p) => sum + (p.completed || 0), 0);
        avgScore = stats.avgScore != null ? stats.avgScore : 0;
        streak = stats.streak || 0;
        lessonsViewed = stats.lessonsViewed || 0;
        recent = Array.isArray(stats.recent) ? stats.recent : [];
      } catch(e) {}

      if (recent.length === 0) {
        try { recent = d.getRecentlyViewed(); } catch(e) {}
        lessonsViewed = recent.length;
        if (streak === 0 && recent.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let checkDate = new Date(today);
          for (let i = 0; i < 30; i++) {
            const dayStr = checkDate.toISOString().slice(0, 10);
            const hasActivity = recent.some(r => {
              const rDate = new Date(r.viewedAt);
              return rDate.toISOString().slice(0, 10) === dayStr;
            });
            if (hasActivity) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }
      }

      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      d.showView(`
        <div class="content" style="max-width:960px">
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}${formLevel ? " — " + escapeHtml(formLevel) : ""}</h2>
            <p>Ready to continue your learning journey?</p>
          </div>

          ${isConnected ? `
            <div class="card" style="margin-bottom:1.25rem;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;background:#f0fdf4;border:1px solid #bbf7d0">
              <div>
                <strong style="color:#15803d">🎓 Connected to your class</strong>
                <p style="margin:0.15rem 0 0;font-size:0.85rem;color:var(--color-text-muted)">${classTeacher ? "Teacher: " + escapeHtml(classTeacher) : "Your teacher can now see your progress and assign lessons."}</p>
              </div>
              <button class="btn btn-sm" id="ov-view-class">View My Class</button>
            </div>
          ` : `
            <div class="card" style="margin-bottom:1.25rem;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;background:#eff6ff;border:1px solid #dbeafe">
              <div>
                <strong style="color:#1e40af">🔗 Connect to your teacher</strong>
                <p style="margin:0.15rem 0 0;font-size:0.85rem;color:var(--color-text-muted)">Enter your teacher's class code so they can see your progress and share lessons.</p>
              </div>
              <button class="btn btn-primary btn-sm" id="ov-connect-class">Enter Code</button>
            </div>
          `}

          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">📚</div>
              <div class="stat-value">${subjectList.length}</div>
              <div class="stat-label">Subjects${totalCompleted > 0 ? " · " + totalCompleted + " completed" : ""}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">📈</div>
              <div class="stat-value">${avgScore != null ? avgScore + "%" : "0%"}</div>
              <div class="stat-label">Average Score</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">🔥</div>
              <div class="stat-value">${streak != null ? streak : 0}</div>
              <div class="stat-label">Day Streak</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">🔖</div>
              <div class="stat-value">${lessonsViewed}</div>
              <div class="stat-label">Lessons Viewed</div>
            </div>
          </div>

          ${recent.length > 0 ? `
            <div class="section-header">
              <h3>Continue Learning</h3>
              <button class="btn btn-sm" id="view-all-recent">View All</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;margin-bottom:1.25rem">
              ${recent.slice(0, 3).map(r => `
                <div class="recent-lesson-card" data-id="${escapeHtml(r.id)}">
                  <h4>${escapeHtml(r.title)}</h4>
                  <span class="recent-meta">${r.viewedAt ? timeAgo(r.viewedAt) : ""}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}

          <div class="section-header">
            <h3>My Subjects</h3>
            <button class="btn btn-sm" id="browse-all-subjects">Browse All</button>
          </div>
          ${subjectList.length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No subjects available yet</p></div>'
            : `<div class="subject-card-grid">
                ${subjectList.map((s, i) => {
                  const ic = iconColors[i % iconColors.length];
                  const subjProgress = progressBySubject.find(p => p.name === s.name);
                  const completedCount = subjProgress ? subjProgress.completed : 0;
                  const totalCount = subjProgress ? subjProgress.total : 0;
                  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  return `
                    <div class="subject-card-enhanced" data-id="${escapeHtml(s.id)}">
                      <div class="subject-icon" style="background:${ic.bg};color:${ic.color}">${ic.emoji}</div>
                      <h4>${escapeHtml(s.name)}</h4>
                      ${totalCount > 0 ? `
                        <div class="subject-progress">
                          <div class="subject-progress-label">
                            <span>${completedCount}/${totalCount} lessons</span>
                            <span>${pct}%</span>
                          </div>
                          <div class="progress-bar">
                            <div class="progress-bar-fill" style="width:${pct}%"></div>
                          </div>
                        </div>
                      ` : `<p style="font-size:0.8rem;color:var(--color-text-muted);margin:0">Start learning →</p>`}
                    </div>
                  `;
                }).join("")}
              </div>`
          }
        </div>
      `);

      document.querySelectorAll(".subject-card-enhanced").forEach(card => {
        card.addEventListener("click", () => d.callView("subject-topics", card.dataset.id));
      });

      document.querySelectorAll(".recent-lesson-card").forEach(card => {
        card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
      });

      document.getElementById("browse-all-subjects")?.addEventListener("click", () => {
        d.setActiveNav("subjects");
        d.callView("subjects");
      });

      document.getElementById("view-all-recent")?.addEventListener("click", () => {
        d.setActiveNav("subjects");
        d.callView("subjects");
      });

      document.getElementById("ov-view-class")?.addEventListener("click", () => {
        d.setActiveNav("class");
        d.callView("class");
      });
      document.getElementById("ov-connect-class")?.addEventListener("click", () => {
        d.setActiveNav("class");
        d.callView("class");
      });

    } catch(e) {
      d.showView('<div class="empty-state"><p>Error loading dashboard</p></div>');
    }
  }

  d.registerView("dashboard", loadStudentOverview);
}

;
// modules/student/subjects.js — subject/topic/subtopic browser.
//
// Handles the three-level drill-down: subjects → topics → subtopics → lessons.
// Also includes loadSubtopicLessons which bridges to the lessons view.

"use strict";

function registerSubjectsView(d) {
  async function loadStudentSubjects() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const filtered = Array.isArray(subjects) ? subjects : [];
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No subjects found</p></div>');
        return;
      }
      d.showView(`
        <h2>Subjects</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${filtered.map(s => `
            <div class="card subject-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.name)}</h3>
              <p style="color:var(--color-text-muted)">${escapeHtml(s.slug || "")}</p>
            </div>
          `).join("")}
        </div>
      `);
      document.querySelectorAll(".subject-card").forEach(card => {
        card.addEventListener("click", () => d.callView("subject-topics", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading subjects</p></div>'); }
  }

  async function loadSubjectTopics(subjectId) {
    d._navStack.push(() => d.callView("subjects"));
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      const topics = await request("/topics?subject_id=" + encodeURIComponent(subjectId));
      const formFilter = localStorage.getItem("casuya_form_filter") || "";
      let filtered = Array.isArray(topics) ? topics : [];
      if (formFilter) {
        const ff = formFilter.replace(/^Form /, "");
        filtered = filtered.filter(t => !t.form_level || t.form_level === formFilter || t.form_level.replace(/^Form /, "") === ff);
      }
      if (filtered.length === 0) {
        const filterHint = formFilter
          ? `<p style="color:var(--color-text-muted);font-size:0.9rem;margin-top:0.5rem">Your form filter is set to <b>${escapeHtml(formFilter)}</b>. Try <b>All Forms</b> in the sidebar, or pick the form that matches this subject.</p>`
          : "";
        d.showView(`<div class="empty-state"><p>No topics found</p>${filterHint}<button class="btn" id="back-btn">← Back</button></div>`);
        document.getElementById("back-btn")?.addEventListener("click", () => d.goBack());
        return;
      }
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Topics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(t => `
            <div class="card topic-card" data-id="${t.id}" style="cursor:pointer">
              <h3>${escapeHtml(t.title)}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      document.querySelectorAll(".topic-card").forEach(card => {
        card.addEventListener("click", () => d.callView("topic-subtopics", card.dataset.id, subjectId));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading topics</p></div>'); }
  }

  async function loadTopicSubtopics(topicId, subjectId) {
    d._navStack.push(() => d.callView("subject-topics", subjectId));
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      const [subtopics, publishedLessons] = await Promise.all([
        request("/subtopics?topic_id=" + encodeURIComponent(topicId)),
        request("/lessons/?topic_id=" + encodeURIComponent(topicId) + "&status=published").catch(() => []),
      ]);
      const filtered = Array.isArray(subtopics) ? subtopics : [];
      const lessonCounts = {};
      (Array.isArray(publishedLessons) ? publishedLessons : []).forEach((l) => {
        if (l?.subtopic_id) lessonCounts[l.subtopic_id] = (lessonCounts[l.subtopic_id] || 0) + 1;
      });
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No subtopics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.goBack());
        return;
      }
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Subtopics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(s => `
            <div class="card subtopic-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.title)}</h3>
              ${lessonCounts[s.id] ? `<p style="color:var(--color-success);font-size:0.85rem;margin-top:0.35rem">${lessonCounts[s.id]} lesson${lessonCounts[s.id] === 1 ? "" : "s"}</p>` : `<p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.35rem">No lessons yet</p>`}
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      document.querySelectorAll(".subtopic-card").forEach(card => {
        card.addEventListener("click", () => d.callView("subtopic-lessons", card.dataset.id, topicId, subjectId));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading subtopics</p></div>'); }
  }

  async function loadSubtopicLessons(subtopicId, topicId, subjectId) {
    d._navStack.push(() => d.callView("topic-subtopics", topicId, subjectId));
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      const lessons = await request("/lessons/?subtopic_id=" + encodeURIComponent(subtopicId) + "&status=published");
      const filtered = Array.isArray(lessons) ? lessons : [];
      d._subtopicLessonList = filtered;
      if (filtered.length === 0) {
        d.showView('<div class="empty-state"><p>No lessons found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.goBack());
        return;
      }
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Lessons</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(l => `
            <div class="card lesson-card" data-id="${l.id}" style="cursor:pointer">
              <h3>${escapeHtml(l.title)}</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status || "")}</p>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      document.querySelectorAll(".lesson-card").forEach(card => {
        card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  d.registerView("subjects", loadStudentSubjects);
  d.registerView("subject-topics", loadSubjectTopics);
  d.registerView("topic-subtopics", loadTopicSubtopics);
  d.registerView("subtopic-lessons", loadSubtopicLessons);
}

;
// modules/student/lessons/cache.js — next-lesson prefetch + recently viewed tracking.

function prefetchNextLesson(d, lessonId) {
  const idx = d._subtopicLessonList.findIndex((l) => l.id === lessonId);
  if (idx < 0 || idx + 1 >= d._subtopicLessonList.length) return;
  const next = d._subtopicLessonList[idx + 1];
  if (typeof getCachedLessonContent === "function" && getCachedLessonContent(next.id)) return;
  const start = typeof loadLessonHtml === "function"
    ? loadLessonHtml(next.id)
    : fetch(`${API_BASE}/lessons/${next.id}/content`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
      }).then((r) => r.ok ? r.text() : "").then((html) => {
        if (html && typeof cacheLessonContent === "function") cacheLessonContent(next.id, html);
      });
  Promise.resolve(start).catch(() => {});
}

function recordRecentLesson(d, lessonId, lesson) {
  const recent = d.getRecentlyViewed();
  const exists = recent.findIndex(r => r.id === lessonId);
  if (exists >= 0) recent.splice(exists, 1);
  recent.unshift({ id: lessonId, title: lesson.title, viewedAt: Date.now() });
  if (recent.length > 20) recent.length = 20;
  d._recentlyViewedCache = recent;
  d._recentlyViewedCacheTs = Date.now();
  localStorage.setItem("casuya_recently_viewed", JSON.stringify(recent));
  request("/progress/activity", {
    method: "POST",
    body: JSON.stringify({ student_id: d.payload.id || d.payload.sub, lesson_id: lessonId, lesson_title: lesson.title }),
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
  prefetchNextLesson(d, lessonId);
}

function dropRecentLesson(d, lessonId) {
  const recent = d.getRecentlyViewed();
  const filtered = recent.filter(r => r.id !== lessonId);
  d._recentlyViewedCache = filtered;
  d._recentlyViewedCacheTs = Date.now();
  localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
}
;
// modules/student/lessons/builders.js — quiz & games section builders for the student lesson view.

function renderStudentQuiz(quizData, lessonId, lessonLang) {
  if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
  const lang = lessonLang || "sw";
  return `
    <div class="card question-block" data-lesson-lang="${escapeHtml(lang)}" style="margin-top:0.75rem;padding:1rem">
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

function renderStudentGames(gamesData) {
  if (!Array.isArray(gamesData) || gamesData.length === 0) return "";
  return `
    <div class="card" style="margin-top:0.75rem;padding:1rem">
      <h3 style="margin:0 0 0.5rem">Games & Activities</h3>
      ${gamesData.map(g => `
        <div class="game-item" data-game-id="${escapeHtml(g.id)}" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);cursor:pointer">
          <span style="color:var(--color-primary)">${escapeHtml(g.title || "Game")}</span>
        </div>
      `).join("")}
      <div id="game-content-area" style="margin-top:1rem"></div>
    </div>
  `;
}
;
// modules/student/lessons/iframe.js — student lesson iframe + progress messaging.

async function mountStudentLessonIframe(lessonId, lessonContent) {
  const container = document.querySelector("#student-content .lesson-iframe");
  if (!container) return { iframe: null, studentId: null, sessionId: null, cleanup: function () {} };

  let handle = { cleanup: function () {}, getIframe: function () { return container.querySelector("iframe"); } };
  if (typeof mountLessonRuntime === "function") {
    handle = await mountLessonRuntime(container, lessonContent, { id: lessonId, title: "Lesson" });
  } else {
    const html = typeof injectBridgeScript === "function"
      ? injectBridgeScript(lessonContent)
      : lessonContent;
    if (container.tagName === "IFRAME") {
      container.srcdoc = injectNodeBase(html);
      handle.getIframe = function () { return container; };
    } else if (typeof mountGameSrcdoc === "function") {
      handle = mountGameSrcdoc(container, typeof injectNodeBase === "function" ? injectNodeBase(html) : html);
    }
  }

  let studentId = null;
  let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  try {
    const me = await request("/students/me");
    if (me && me.id) studentId = me.id;
  } catch(e) {}

  let progressTimer = null;
  const syncProgress = (body) => {
    if (!studentId) return;
    request("/progress/sync", {
      method: "POST",
      body: JSON.stringify(Object.assign({
        student_id: studentId,
        lesson_id: lessonId,
        session_id: sessionId,
        elapsed_ms: 0,
      }, body)),
    }).catch(() => {});
  };

  const onMessage = (e) => {
    if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
      const pct = Math.round((e.data.score / e.data.total) * 100);
      syncProgress({ completion_percentage: 100, score_percentage: pct });
    } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
      if (progressTimer) clearTimeout(progressTimer);
      const percent = e.data.percent;
      progressTimer = setTimeout(() => syncProgress({ completion_percentage: percent }), 2000);
    } else if (e.data?.type === "casuya-selection" && e.data.selected) {
      if (typeof openLessonAiChatExplain === "function") {
        openLessonAiChatExplain(e.data.selected, e.data.context || "");
      }
    }
  };
  window.addEventListener("message", onMessage);

  syncProgress({ completion_percentage: 10, score_percentage: null });

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    if (progressTimer) clearTimeout(progressTimer);
    if (handle && typeof handle.cleanup === "function") handle.cleanup();
  };

  return {
    iframe: handle.getIframe ? handle.getIframe() : null,
    getIframe: handle.getIframe,
    studentId,
    sessionId,
    cleanup,
  };
}

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
// modules/student/lessons/interactions.js — wires student lesson view buttons & listeners.

function bindStudentLessonInteractions(d, ctx) {
  const { lessonId, isBookmarked, quizData, lesson, lessonContent, iframeText } = ctx;
  window.__casuyaQuizLessonMeta = {
    lessonId: lessonId,
    title: lesson && lesson.title,
    subject_slug: lesson && lesson.subject_slug,
    form_level: lesson && lesson.form_level,
    topic: lesson && lesson.topic_title,
    subtopic: lesson && lesson.subtopic_title,
  };

  const backBtn = document.getElementById("back-btn");
  function leaveLesson() {
    if (typeof unmountLessonAiChat === "function") unmountLessonAiChat();
  }
  if (ctx.iframeCtx) {
    backBtn.addEventListener("click", () => { leaveLesson(); ctx.iframeCtx.cleanup(); d.goBack(); });
  } else {
    backBtn.addEventListener("click", () => { leaveLesson(); d.goBack(); });
  }

  const completeBtn = document.getElementById("complete-btn");
  if (completeBtn && ctx.iframeCtx?.studentId) {
    completeBtn.addEventListener("click", () => {
      request("/progress/sync", {
        method: "POST",
        body: JSON.stringify({ student_id: ctx.iframeCtx.studentId, lesson_id: lessonId, session_id: ctx.iframeCtx.sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: null }),
      }).then(() => {
        completeBtn.textContent = "Completed!";
        completeBtn.disabled = true;
        completeBtn.style.opacity = "0.6";
        showToast("Progress saved");
      }).catch(() => showToast("Failed to save progress"));
    });
  } else if (completeBtn) {
    completeBtn.style.display = "none";
  }

  document.getElementById("bookmark-btn").addEventListener("click", async () => {
    const btn = document.getElementById("bookmark-btn");
    if (isBookmarked) {
      await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
      btn.textContent = "☆";
    } else {
      await request(`/bookmarks/${lessonId}`, { method: "POST" });
      btn.textContent = "★";
    }
  });

  let noteTimer;
  document.getElementById("save-note").addEventListener("click", async () => {
    clearTimeout(noteTimer);
    const content = document.getElementById("lesson-note").value;
    await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
    showToast("Note saved");
  });

  document.getElementById("lesson-note").addEventListener("input", () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(async () => {
      const content = document.getElementById("lesson-note").value;
      await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
    }, 2000);
  });

  document.getElementById("quiz-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!quizData || !quizData.questions) return;
    const answers = {};
    quizData.questions.forEach(q => {
      const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
      if (sel) answers[q.id] = sel.value;
    });
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
      const combined = result.combined_percentage != null ? result.combined_percentage : result.percentage;
      const passed = combined >= 50;
      const hasWork = result.work_score != null;
      el.innerHTML = `
        <p style="color:${passed ? "var(--color-success)" : "var(--color-danger)"};font-weight:600">Score: ${result.score}/${result.total} (${Math.round(result.percentage)}%)</p>
        ${hasWork ? `<p style="font-size:0.85rem;color:var(--color-text-muted)">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · Combined (70/30): <strong>${Math.round(combined)}%</strong></p>` : ``}
        ${passed ? '<p style="color:var(--color-success)">Passed!</p>' : '<p style="color:var(--color-danger)">Try again</p>'}
        ${!passed ? '<button class="btn btn-sm btn-primary" id="retry-quiz-btn" style="margin-top:0.5rem">Retry Quiz</button>' : ''}
        ${hasWork && result.work_score < result.work_total ? '<p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.35rem">Tip: open "Show your work" to earn work credit.</p>' : ''}
      `;
      el.style.display = "block";
      if (!passed) {
        document.getElementById("retry-quiz-btn").addEventListener("click", () => {
          document.querySelectorAll('#quiz-form input[type="radio"]').forEach(r => r.checked = false);
          el.style.display = "none";
          const tutor = el.parentNode && el.parentNode.querySelector(".quiz-tutor");
          if (tutor) tutor.remove();
        });
        if (Array.isArray(result.wrong_questions) && result.wrong_questions.length && typeof mountLessonQuizTutor === "function") {
          mountLessonQuizTutor(el, result.wrong_questions, {
            lessonId: lessonId,
            lesson: lesson,
            lessonTitle: lesson && lesson.title,
            lessonContent: lessonContent,
            iframeText: iframeText,
            subject_slug: lesson && lesson.subject_slug,
            form_level: lesson && lesson.form_level,
            topic: lesson && lesson.topic_title,
            subtopic: lesson && lesson.subtopic_title,
          });
        }
      }
    } catch(err) {
      const el = document.getElementById("quiz-result");
      el.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`;
      el.style.display = "block";
    }
  });

  document.querySelectorAll(".game-item").forEach(item => {
    item.addEventListener("click", async () => {
      const area = document.getElementById("game-content-area");
      const gid = item.dataset.gameId;
      try {
        const html = typeof loadGameHtml === "function"
          ? await loadGameHtml(gid)
          : "";
        if (html) {
          area.innerHTML = `
            <div id="inline-game-runtime" style="width:100%;min-height:300px;height:420px"></div>
            <div style="margin-top:0.75rem">
              <details>
                <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">✏️ Scratch Pad</summary>
                <div data-blackboard data-lesson-id="game-${gid}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
              </details>
            </div>
          `;
          const mount = document.getElementById("inline-game-runtime");
          if (mount && typeof mountGameRuntime === "function") {
            await mountGameRuntime(mount, html, { id: gid, title: "Game" });
          } else if (mount && typeof mountGameSrcdoc === "function") {
            mountGameSrcdoc(mount, html);
          } else if (mount) {
            mount.innerHTML = `<iframe style="width:100%;border:none;min-height:300px" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>`;
          }
          if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
        }
      } catch(e) {}
    });
  });
}
;
// modules/student/lessons/viewer.js — lesson viewer with iframe content, quiz,
// games, notes, blackboard, bookmarking, and progress tracking.

"use strict";

var _studentBbEmbedLoading = null;
var _studentAiChatLoading = null;

function ensureStudentAiChat(ctx) {
  if (typeof mountLessonAiChat === "function") {
    mountLessonAiChat(ctx);
    return Promise.resolve(true);
  }
  if (!_studentAiChatLoading) {
    _studentAiChatLoading = loadCasuyaScript("/assets/js/student-ai-chat.js").then(function () {
      return typeof mountLessonAiChat === "function";
    }).catch(function () { return false; });
  }
  return _studentAiChatLoading.then(function (ok) {
    if (ok && typeof mountLessonAiChat === "function") mountLessonAiChat(ctx);
    return ok;
  });
}

function ensureStudentBlackboardEmbed() {
  if (window.CasuyaBlackboardEmbed) {
    window.CasuyaBlackboardEmbed.autoMount();
    return;
  }
  if (!_studentBbEmbedLoading) {
    _studentBbEmbedLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      var src = (typeof casuyaAssetUrl === "function")
        ? casuyaAssetUrl("/assets/js/blackboard-embed.js")
        : "/assets/js/blackboard-embed.js";
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }
  _studentBbEmbedLoading.then(function (ok) {
    if (ok && window.CasuyaBlackboardEmbed) window.CasuyaBlackboardEmbed.autoMount();
  });
}

function registerLessonsView(d) {
  async function viewStudentLesson(lessonId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      let lesson, isBookmarked, noteData, quizData, gamesData, lessonContent;
      try {
        const cachedHtml = typeof getCachedLessonContent === "function" ? getCachedLessonContent(lessonId) : null;
        const contentFetch = cachedHtml
          ? Promise.resolve(cachedHtml)
          : (typeof loadLessonHtml === "function"
            ? loadLessonHtml(lessonId)
            : fetch(`${API_BASE}/lessons/${lessonId}/content`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
              }).then(r => r.ok ? r.text() : "").then((html) => {
                if (html && typeof cacheLessonContent === "function") cacheLessonContent(lessonId, html);
                return html;
              }).catch(() => ""));

        const pkg = await request(`/lessons/${lessonId}/package`);
        lesson = pkg.lesson;
        isBookmarked = pkg.bookmark_status?.bookmarked || false;
        noteData = pkg.note || { content: "" };
        quizData = pkg.quiz;
        gamesData = pkg.games || [];

        lessonContent = (await contentFetch) || "<p>No content</p>";
      } catch(e) {
        dropRecentLesson(d, lessonId);
        d.showView('<div class="empty-state"><p>This lesson is no longer available.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>');
        document.getElementById("back-to-overview")?.addEventListener("click", () => d.callView("dashboard"));
        return;
      }

      recordRecentLesson(d, lessonId, lesson);

      let lessonLang = "sw";

      d.showView(`
        <div data-lesson-lang="${escapeHtml(lessonLang)}">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(lesson.title)}</h2>
          <button id="bookmark-btn" class="btn-icon" style="font-size:1.5rem" title="Bookmark">${isBookmarked ? "★" : "☆"}</button>
          <button id="lesson-listen-btn" type="button" class="casuya-listen" data-lang="${escapeHtml(lessonLang)}" data-bound="student-lesson" title="Listen to this lesson" aria-label="Listen to this lesson">🔊 Listen</button>
          <button id="complete-btn" class="btn btn-primary" style="font-size:0.85rem">Mark Complete</button>
        </div>
        <div style="width:100%">
          <div id="lesson-runtime-mount" class="lesson-iframe" style="width:100%;min-height:300px"></div>
        </div>
        <div style="margin-top:0.75rem">
          <details>
            <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
            <div class="card" style="margin-top:0.5rem">
              <textarea id="lesson-note" class="input" rows="4" placeholder="Write your notes here...">${escapeHtml(noteData?.content || "")}</textarea>
              <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">
                <button class="btn btn-primary" id="save-note">Save Note</button>
                <button type="button" class="casuya-record" data-target="#lesson-note" data-append="true" title="Speak instead of typing" aria-label="Speak instead of typing">🎤 Voice</button>
              </div>
            </div>
          </details>
          ${renderStudentQuiz(quizData, lessonId, lessonLang)}
          ${renderStudentGames(gamesData)}
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
            <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
          </div>
        </div>
        </div>
      `);

      ensureStudentBlackboardEmbed();

      const mount = document.querySelector("#student-content .lesson-iframe");
      let iframeCtx = null;
      if (mount) {
        iframeCtx = await mountStudentLessonIframe(lessonId, lessonContent);
      }
      const iframe = iframeCtx && typeof iframeCtx.getIframe === "function"
        ? iframeCtx.getIframe()
        : (iframeCtx && iframeCtx.iframe);

      const iframeBody = iframe && typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : "";
      lessonLang = typeof casuyaResolveLessonLang === "function"
        ? casuyaResolveLessonLang(lesson.title, iframeBody, quizData?.questions?.[0]?.prompt)
        : (typeof casuyaDetectLang === "function"
          ? casuyaDetectLang(String(lesson.title || "") + " " + iframeBody)
          : "sw");
      const lessonRoot = document.querySelector("[data-lesson-lang]");
      if (lessonRoot) lessonRoot.setAttribute("data-lesson-lang", lessonLang);
      const lessonListenBtn = document.getElementById("lesson-listen-btn");
      if (lessonListenBtn) lessonListenBtn.setAttribute("data-lang", lessonLang);
      document.querySelectorAll(".question-block[data-lesson-lang], .quiz-item .casuya-listen[data-lang]").forEach(function (el) {
        el.setAttribute("data-lang", lessonLang);
        if (el.classList.contains("question-block")) el.setAttribute("data-lesson-lang", lessonLang);
      });

      const prefetchLessonTts = function () {
        if (typeof casuyaPrefetchTts !== "function") return;
        casuyaPrefetchTts((lesson.title + ". " + iframeBody).trim(), { lang: lessonLang });
        if (quizData && Array.isArray(quizData.questions)) {
          quizData.questions.forEach(function (q) {
            if (q && q.prompt) casuyaPrefetchTts(String(q.prompt), { lang: lessonLang });
          });
        }
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(prefetchLessonTts, { timeout: 6000 });
      } else {
        setTimeout(prefetchLessonTts, 2500);
      }

      if (lessonListenBtn && typeof casuyaSpeakText === "function") {
        lessonListenBtn.addEventListener("click", function () {
          const body = typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : iframeBody;
          casuyaSpeakText((lesson.title + ". " + body).trim(), { lang: lessonLang });
        });
      }

      bindStudentLessonInteractions(d, {
        lessonId,
        lesson,
        isBookmarked,
        noteData,
        quizData,
        gamesData,
        iframeCtx,
        lessonContent,
        iframeText: iframeBody,
      });

      ensureStudentAiChat({
        lessonId: lessonId,
        lesson: lesson,
        lessonContent: lessonContent,
        iframeText: iframeBody,
        subject_slug: lesson.subject_slug || undefined,
        form_level: lesson.form_level || undefined,
        topic: lesson.topic_title || undefined,
        subtopic: lesson.subtopic_title || undefined,
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading lesson.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>'); document.getElementById("back-to-overview")?.addEventListener("click", () => d.callView("dashboard")); }
  }

  d.registerView("lesson", viewStudentLesson);
}
;
// modules/student/progress.js — progress tracking view.

"use strict";

function registerProgressView(d) {
  async function loadStudentProgress() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading progress...</p></div>');
    try {
      const profile = await request("/students/me");
      const studentId = profile?.id;
      if (!studentId) {
        d.showView('<div class="empty-state"><p>Could not load profile</p></div>');
        return;
      }
      const data = await request(`/progress/${studentId}`);
      const progress = typeof asProgressItems === "function" ? asProgressItems(data) : (Array.isArray(data) ? data : (data && data.items) || []);
      if (progress.length === 0) {
        d.showView('<div class="empty-state"><p>No progress recorded yet</p></div>');
        return;
      }
      const bySubject = {};
      progress.forEach(p => {
        const subj = p.subject_name || "General";
        if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
        bySubject[subj].total++;
        if (p.completion_percentage >= 100) bySubject[subj].completed++;
      });
      d.showView(`
        <h2>My Progress</h2>
        <div style="margin-top:1rem">
          ${Object.entries(bySubject).map(([name, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return `
              <div class="card" style="margin-bottom:0.75rem">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                  <strong>${escapeHtml(name)}</strong>
                  <span>${pct}%</span>
                </div>
                <div style="background:var(--color-border);height:8px;border-radius:4px">
                  <div style="background:var(--color-primary);height:100%;width:${pct}%;border-radius:4px"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `);
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading progress</p></div>'); }
  }

  d.registerView("progress", loadStudentProgress);
}

;
// modules/student/bookmarks.js — bookmarks view.

"use strict";

function registerBookmarksView(d) {
  async function loadStudentBookmarks() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading bookmarks...</p></div>');
    try {
      const data = await request("/bookmarks/");
      const bookmarks = Array.isArray(data) ? data : [];
      if (bookmarks.length === 0) {
        d.showView('<div class="empty-state"><p>No bookmarks yet</p></div>');
        return;
      }
      d.showView(`
        <h2>My Bookmarks</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${bookmarks.map(b => `
            <div class="card" style="cursor:pointer" data-id="${b.lesson_id || b.id}">
              <h3>${escapeHtml(b.lesson_title || b.title || "Untitled")}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.querySelectorAll(".card[data-id]").forEach(card => {
        card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading bookmarks</p></div>'); }
  }

  d.registerView("bookmarks", loadStudentBookmarks);
}

;
// modules/student/assignments.js — assignments list and assignment viewer.

"use strict";

function registerAssignmentsView(d) {
  async function loadStudentAssignments() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading assignments...</p></div>');
    try {
      const assignments = await request("/assignments");
      const assignmentList = Array.isArray(assignments) ? assignments : [];
      d.showView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2 style="margin:0">📋 Assignments</h2>
          </div>
          ${assignmentList.length === 0 ? '<div class="empty-state"><p>No assignments yet. Check back later.</p></div>' :
            assignmentList.map(a => `
              <div class="card" style="padding:1rem;margin-bottom:0.5rem;cursor:pointer" data-open-assignment="${a.id}">
                <div style="display:flex;justify-content:space-between;align-items:start">
                  <div>
                    <h4 style="margin:0">${escapeHtml(a.title)}</h4>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Due: ${a.due_date ? new Date(a.due_date).toLocaleDateString() : "No due date"} | ${a.status}</p>
                    ${a.paper_summary ? `<p style="color:var(--color-accent);font-size:0.78rem;margin-top:0.15rem">📄 ${examPaperMetaLine(a.paper_summary)}</p>` : ""}
                    ${a.notes ? `<p style="color:var(--color-text-muted);font-size:0.8rem;margin-top:0.15rem">${escapeHtml(a.notes)}</p>` : ""}
                  </div>
                  <span class="btn btn-sm btn-primary">Open</span>
                </div>
              </div>
            `).join("")}
        </div>
      `);
      document.querySelectorAll("[data-open-assignment]").forEach(card => {
        card.addEventListener("click", () => d.callView("open-assignment", card.dataset.openAssignment));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading assignments</p></div>'); }
  }

  async function openStudentAssignment(assignmentId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading assignment...</p></div>');
    try {
      const assignment = await request(`/assignments/${assignmentId}`);
      const lessonId = assignment.lesson_id;
      let studentId = null;
      try {
        const me = await request("/students/me");
        studentId = me && (me.id || me.user_id);
      } catch(e) {}
      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(assignment.title)}</h2>
          <button class="btn btn-primary" id="submit-assignment-btn">Submit Work</button>
        </div>
        ${assignment.notes ? `<p style="color:var(--color-text-muted);margin-bottom:1rem">${escapeHtml(assignment.notes)}</p>` : ""}
        ${assignment.paper ? `
          <div style="margin-bottom:0.75rem;display:flex;gap:0.5rem;align-items:center">
            <button class="btn btn-sm" id="toggle-paper-btn">Hide exam paper</button>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">Objective (multiple-choice) questions are auto-checked — structured and essay questions are answered on the blackboard below.</span>
          </div>
          <div id="exam-paper-box-${escapeHtml(assignment.id)}" style="margin-bottom:1rem">
            ${renderExamPaper(assignment.paper, { mode: "student", ns: "std-assignment-" + escapeHtml(assignment.id) })}
          </div>
        ` : ""}
        <div class="card" style="padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Complete on Blackboard</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Show your working below, then click Submit Work when done.</p>
          <div data-blackboard data-lesson-id="assignment-${assignmentId}" data-assignment-id="${assignmentId}" data-student-id="${escapeHtml(studentId || "")}" style="width:100%;height:480px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
        <div id="assignment-result" style="margin-top:0.75rem"></div>
      `);
      if (assignment.paper) {
        const paperBox = document.getElementById("exam-paper-box-" + assignment.id);
        if (paperBox) {
          bindExamScore(paperBox, assignment.paper);
          const toggle = document.getElementById("toggle-paper-btn");
          toggle.addEventListener("click", () => {
            const hidden = paperBox.style.display === "none";
            paperBox.style.display = hidden ? "" : "none";
            toggle.textContent = hidden ? "Hide exam paper" : "Show exam paper";
          });
        }
      }
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      document.getElementById("back-btn").addEventListener("click", () => d.callView("assignments"));
      document.getElementById("submit-assignment-btn").addEventListener("click", async () => {
        const bbEl = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
        const bb = bbEl && bbEl._casuyaBlackboard;
        if (!bb) { showToast("Blackboard not loaded"); return; }
        const btn = document.getElementById("submit-assignment-btn");
        btn.disabled = true; btn.textContent = "Submitting...";
        try {
          const elements = bb.getElements ? bb.getElements() : [];
          const mcqAnswers = {};
          document.querySelectorAll('.exam-paper input[type="radio"]:checked').forEach(radio => {
            const name = radio.getAttribute("name");
            const qNum = name ? name.replace(/^.*-/, "") : null;
            if (qNum) mcqAnswers[qNum] = parseInt(radio.value);
          });
          const structuredAnswers = {};
          document.querySelectorAll('.exam-structured-answer').forEach(ta => {
            const qNum = ta.getAttribute("data-question");
            const text = ta.value.trim();
            if (qNum && text) structuredAnswers[qNum] = text;
          });
          const submission = {
            elements: elements,
            mcq_answers: mcqAnswers,
            structured_answers: structuredAnswers,
          };
          await request(`/assignments/${assignmentId}/submit`, {
            method: "POST",
            body: JSON.stringify({
              student_id: studentId || "anonymous",
              elements_json: JSON.stringify(submission),
            }),
          });
          document.getElementById("assignment-result").innerHTML = `
            <div class="card" style="padding:1.5rem;text-align:center">
              <h3 style="color:var(--color-success);margin:0 0 0.5rem">Submitted!</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem">Your teacher can now review your work.</p>
              <button class="btn btn-primary" id="back-to-assignments" style="margin-top:1rem">Back to Assignments</button>
            </div>
          `;
          document.getElementById("back-to-assignments").addEventListener("click", () => d.callView("assignments"));
        } catch(err) {
          btn.disabled = false; btn.textContent = "Submit Work";
          document.getElementById("assignment-result").innerHTML = `<p style="color:var(--color-danger)">Failed to submit: ${escapeHtml(err.message)}</p>`;
        }
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading assignment</p></div>'); }
  }

  d.registerView("assignments", loadStudentAssignments);
  d.registerView("open-assignment", openStudentAssignment);
}

;
// modules/student/notifications.js — notifications view.

"use strict";

function registerNotificationsView(d) {
  async function loadStudentNotifications() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const data = await request("/notifications");
      const allNotifs = Array.isArray(data?.items) ? data.items : [];
      const unread = allNotifs.filter(n => !n.is_read);
      const read = allNotifs.filter(n => n.is_read);
      let showFilter = "all";

      function render() {
        let list = allNotifs;
        if (showFilter === "unread") list = unread;
        else if (showFilter === "read") list = read;
        const el = document.getElementById("student-notif-list");
        if (!el) return;
        if (list.length === 0) {
          el.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No notifications</p></div>';
          return;
        }
        el.innerHTML = list.map(n => `
          <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.5rem;${n.is_read ? "opacity:0.7" : "border-left:3px solid var(--color-primary)"}">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem">
              <div style="flex:1">
                <p style="margin:0;font-size:0.875rem;${n.is_read ? "" : "font-weight:600"}">${escapeHtml(n.message)}</p>
                <p style="margin:0.25rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">${n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
              </div>
              ${!n.is_read ? `<button class="btn btn-primary btn-xs student-notif-read" data-id="${n.id}">✓ Read</button>` : ""}
            </div>
          </div>
        `).join("");
        document.querySelectorAll(".student-notif-read").forEach(btn => {
          btn.addEventListener("click", async () => {
            await request(`/notifications/${btn.dataset.id}/read`, { method: "POST" });
            const n = allNotifs.find(x => x.id === btn.dataset.id);
            if (n) n.is_read = true;
            unread.length = 0; unread.push(...allNotifs.filter(x => !x.is_read));
            read.length = 0; read.push(...allNotifs.filter(x => x.is_read));
            updateNotifBadge(unread.length);
            render();
          });
        });
      }

      d.showView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>🔔 Notifications</h2>
            <button class="btn btn-ghost btn-sm" id="student-mark-all-read">✓ Mark All Read</button>
          </div>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter student-notif-filter active" data-filter="all">All <span class="filter-count">${allNotifs.length}</span></button>
            <button class="btn-filter student-notif-filter" data-filter="unread">🔴 Unread <span class="filter-count">${unread.length}</span></button>
            <button class="btn-filter student-notif-filter" data-filter="read">✅ Read <span class="filter-count">${read.length}</span></button>
          </div>
          <div id="student-notif-list" style="margin-top:0.75rem"></div>
        </div>
      `);
      document.querySelectorAll(".student-notif-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          showFilter = btn.dataset.filter;
          document.querySelectorAll(".student-notif-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === showFilter));
          render();
        });
      });
      document.getElementById("student-mark-all-read")?.addEventListener("click", async () => {
        await Promise.all(unread.map(n =>
          request(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {})
        ));
        unread.forEach(n => n.is_read = true);
        unread.length = 0; read.length = 0; read.push(...allNotifs);
        updateNotifBadge(0);
        render();
      });
      render();
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
  }

  d.registerView("notifications", loadStudentNotifications);
}

;
// modules/student/settings.js — settings with profile, password, and appearance tabs.

"use strict";

function registerSettingsView(d) {
  async function loadStudentSettings() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [me, profile] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/students/me").catch(() => ({})),
      ]);
      const activeTab = localStorage.getItem("student_settings_tab") || "profile";

      function renderTab(tab) {
        localStorage.setItem("student_settings_tab", tab);
        document.querySelectorAll(".student-settings-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        const panel = document.getElementById("student-settings-panel");
        if (!panel) return;

        if (tab === "profile") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">My Profile</h3>
              <form id="student-profile-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Full Name</label>
                  <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" placeholder="Your name">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Email</label>
                  <input class="input" value="${escapeHtml(me.email || "")}" disabled style="opacity:0.6">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Form Level</label>
                  <select class="input" name="form_level">
                    <option value="">Select...</option>
                    ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => `<option value="${f}" ${profile.form_level === f ? "selected" : ""}>${f}</option>`).join("")}
                  </select>
                </div>
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">💾 Save Changes</button>
              </form>
              <p id="student-profile-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
            </div>
          `;
          document.getElementById("student-profile-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("student-profile-msg");
            try {
              await request("/students/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), form_level: fd.get("form_level") }) });
              msg.textContent = "✅ Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "block";
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "block"; }
          });
        } else if (tab === "password") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Change Password</h3>
              <form id="student-pw-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Current Password</label>
                  <input class="input" name="current_password" type="password" required>
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">New Password</label>
                  <input class="input" name="new_password" type="password" required minlength="6">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Confirm New Password</label>
                  <input class="input" name="confirm_password" type="password" required>
                </div>
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">🔐 Update Password</button>
              </form>
              <p id="student-pw-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
            </div>
          `;
          document.getElementById("student-pw-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("student-pw-msg");
            if (fd.get("new_password") !== fd.get("confirm_password")) {
              msg.textContent = "❌ Passwords do not match"; msg.style.color = "var(--color-danger)"; msg.style.display = "block";
              return;
            }
            try {
              await request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), new_password: fd.get("new_password") }) });
              msg.textContent = "✅ Password updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "block";
              e.target.reset();
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "block"; }
          });
        } else if (tab === "appearance") {
          panel.innerHTML = appearancePanelHTML();
          setupAppearanceControls();
        }
      }

      d.showView(`
        <div class="content">
          <h2>⚙️ Settings</h2>
          <div class="tab-bar">
            <button class="tab-btn student-settings-tab${activeTab === "profile" ? " active" : ""}" data-tab="profile">👤 Profile</button>
            <button class="tab-btn student-settings-tab${activeTab === "password" ? " active" : ""}" data-tab="password">🔒 Password</button>
            <button class="tab-btn student-settings-tab${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">🎨 Appearance</button>
          </div>
          <div id="student-settings-panel"></div>
        </div>
      `);
      document.querySelectorAll(".student-settings-tab").forEach(btn => {
        btn.addEventListener("click", () => renderTab(btn.dataset.tab));
      });
      renderTab(activeTab);
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading settings</p></div>'); }
  }

  d.registerView("settings", loadStudentSettings);
}

;
// modules/student/class-view.js — "My Class" view (connect to teacher,
// view classmates, published lessons and assignments).

"use strict";

function registerClassView(d) {
  async function loadStudentClass() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const res = await request("/classrooms/me?_t=" + Date.now()).catch(() => null);
      const classroom = res?.classroom || null;
      const teacher = res?.teacher || null;
      const classmatesCount = res?.classmates_count ?? 0;
      const publishedLessons = Array.isArray(res?.published_lessons) ? res.published_lessons : [];
      const assignments = Array.isArray(res?.assignments) ? res.assignments : [];

      d.showView(`
        <div class="content" style="max-width:820px">
          <h2>My Class</h2>

          ${classroom ? `
            <div class="card" style="margin:1rem 0;padding:1.5rem;background:linear-gradient(135deg,#eff6ff,#ede9fe);border:1px solid #dbeafe;text-align:center">
              <div style="font-size:2rem">🎓</div>
              <h3 style="margin:0.5rem 0 0.25rem">${classroom.name ? escapeHtml(classroom.name) : "You're connected!"}</h3>
              <p style="margin:0 0 0.5rem;color:var(--color-text-muted);font-size:0.9rem">
                ${teacher?.name ? "Your teacher: <b>" + escapeHtml(teacher.name) + "</b>" : "Connected to your teacher's class."}
                ${classmatesCount > 0 ? " · <b>" + classmatesCount + "</b> classmate" + (classmatesCount === 1 ? "" : "s") : ""}
              </p>
              <div style="font-size:0.75rem;color:var(--color-text-muted);margin:0.5rem 0 0.25rem">Class Code</div>
              <div style="font-family:monospace;font-weight:800;letter-spacing:0.3em;font-size:1.6rem;color:#1e40af">${escapeHtml(classroom.code)}</div>
              <button class="btn btn-danger" id="leave-class" style="margin-top:1rem">Leave Class</button>
            </div>

            <div class="stat-grid" style="margin-bottom:1.25rem">
              <div class="stat-card">
                <div class="stat-icon" style="background:#eff6ff;color:#2563eb">👥</div>
                <div class="stat-value">${classmatesCount}</div>
                <div class="stat-label">Classmates</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">📚</div>
                <div class="stat-value">${publishedLessons.length}</div>
                <div class="stat-label">Lessons Shared</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#fef3c7;color:#d97706">📋</div>
                <div class="stat-value">${assignments.length}</div>
                <div class="stat-label">Assignments</div>
              </div>
            </div>

            ${teacher ? `
              <div class="card" style="margin-bottom:1.25rem;padding:1.25rem">
                <div style="display:flex;align-items:center;gap:0.9rem">
                  <div style="width:48px;height:48px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;flex-shrink:0">${escapeHtml((teacher.name || "T").charAt(0).toUpperCase())}</div>
                  <div style="min-width:0">
                    <h3 style="margin:0;font-size:1.05rem">${escapeHtml(teacher.name || "Your Teacher")}</h3>
                    <p style="margin:0.2rem 0 0;color:var(--color-text-muted);font-size:0.85rem">
                      ${teacher.email ? escapeHtml(teacher.email) : ""}
                      ${teacher.subjects ? " · " + escapeHtml(teacher.subjects) : ""}
                    </p>
                  </div>
                </div>
              </div>
            ` : ""}

            <div class="section-header">
              <h3>Lessons from your teacher</h3>
            </div>
            ${publishedLessons.length === 0
              ? '<div class="empty-state" style="padding:1.5rem"><p>Your teacher hasn\'t shared any lessons yet.</p></div>'
              : `<div class="card-grid" style="margin-bottom:1.25rem">
                  ${publishedLessons.map(l => `
                    <div class="card lesson-card clickable" data-id="${escapeHtml(l.id)}" style="cursor:pointer">
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.78rem;margin:0.25rem 0 0">📚 Shared lesson</p>
                    </div>
                  `).join("")}
                </div>`}

            <div class="section-header">
              <h3>Assignments from your teacher</h3>
            </div>
            ${assignments.length === 0
              ? '<div class="empty-state" style="padding:1.5rem"><p>No assignments yet. Check back later.</p></div>'
              : assignments.map(a => `
                  <div class="card" style="padding:0.9rem 1.1rem;margin-bottom:0.5rem;cursor:pointer" data-open-assignment="${escapeHtml(a.id)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
                      <div style="min-width:0">
                        <h4 style="margin:0">${escapeHtml(a.title)}</h4>
                        <p style="color:var(--color-text-muted);font-size:0.8rem;margin:0.2rem 0 0">
                          ${a.due_date ? "Due: " + new Date(a.due_date).toLocaleDateString() : "No due date"}
                          ${a.lesson_title ? " · " + escapeHtml(a.lesson_title) : ""}
                        </p>
                      </div>
                      <span class="btn btn-sm btn-primary">Open</span>
                    </div>
                  </div>
                `).join("")}
          ` : `
            <div class="card" style="margin:1rem 0;padding:1.5rem">
              <div style="font-size:2rem;text-align:center">🏫</div>
              <h3 style="text-align:center;margin:0.5rem 0">Connect to your teacher</h3>
              <p style="text-align:center;color:var(--color-text-muted);font-size:0.9rem;max-width:440px;margin:0 auto 1.25rem">
                Your teacher will give you a <b>class code</b>. Enter it below and press <b>Save</b> to join their class — then they can see your progress, publish lessons and assign work to you.
              </p>
              <form id="class-join-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:360px;margin:0 auto">
                <div>
                  <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Class Code</label>
                  <input class="input" id="class-code-input" placeholder="e.g. XK7P2M" maxlength="12" style="text-align:center;font-family:monospace;font-weight:700;letter-spacing:0.2em;text-transform:uppercase" required>
                </div>
                <button class="btn btn-primary" type="submit">Save & Connect</button>
                <p id="class-join-status" style="display:none;font-size:0.85rem;margin:0;text-align:center"></p>
              </form>
            </div>
          `}
        </div>
      `);

      if (classroom) {
        document.getElementById("leave-class")?.addEventListener("click", async () => {
          if (!confirm("Leave your teacher's class? You will need a new code to reconnect.")) return;
          try {
            await request("/classrooms/leave", { method: "POST", body: "{}" });
            loadStudentClass();
          } catch(e) { alert("Failed to leave: " + e.message); }
        });
        document.querySelectorAll(".lesson-card.clickable[data-id]").forEach(card => {
          card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
        });
        document.querySelectorAll("[data-open-assignment]").forEach(card => {
          card.addEventListener("click", () => d.callView("open-assignment", card.dataset.openAssignment));
        });
      } else {
        const form = document.getElementById("class-join-form");
        form?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const status = document.getElementById("class-join-status");
          const input = document.getElementById("class-code-input");
          const code = (input.value || "").trim().toUpperCase();
          if (!code) { status.style.display = "block"; status.style.color = "red"; status.textContent = "Please enter your class code."; return; }
          status.style.display = "block";
          status.style.color = "var(--color-text-muted)";
          status.textContent = "Connecting...";
          try {
            const res = await request("/classrooms/join", {
              method: "POST",
              body: JSON.stringify({ code }),
            });
            status.style.color = "var(--color-success)";
            status.textContent = res?.message || "Connected!";
            setTimeout(() => loadStudentClass(), 1000);
          } catch(err) {
            status.style.color = "red";
            status.textContent = err.message || "Could not connect. Check the code and try again.";
          }
        });
      }
    } catch (err) {
      d.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  d.registerView("class", loadStudentClass);
}

;
// modules/student/profile.js — profile editor (accessible from sidebar).

"use strict";

function registerProfileView(d) {
  async function showStudentProfileEditor() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading profile...</p></div>');
    try {
      const profile = await request("/students/me");
      d.showView(`
        <h2>Edit Profile</h2>
        <form id="profile-form" class="card" style="margin-top:1rem;display:flex;flex-direction:column;gap:0.75rem">
          <label>Full Name<input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}"></label>
          <label>Form Level
            <select class="input" name="form_level">
              ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => `<option ${profile.form_level === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </label>
          <button class="btn btn-primary" type="submit">Save</button>
        </form>
      `);
      document.getElementById("profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await request("/students/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), form_level: fd.get("form_level") }) });
          showToast("Profile updated");
        } catch(err) { showToast("Error: " + err.message); }
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading profile</p></div>'); }
  }

  d.registerView("profile", showStudentProfileEditor);
}

;
// modules/student/lazy-views.js — stub hash routes until student.extras.bundle.js loads.

"use strict";

var STUDENT_EXTRAS_SRC = "/assets/js/student.extras.bundle.js";

var STUDENT_LAZY_GROUPS = [
  { register: "registerGamesView", views: ["games", "game"] },
  { register: "registerExamsView", views: ["exams", "start-exam"] },
  { register: "registerTestsView", views: ["test-generator"] },
  { register: "registerFilesView", views: ["files"] },
  { register: "registerLibraryView", views: ["library"] },
  { register: "registerPaymentsView", views: ["payments"] },
  { register: "registerDownloadsView", views: ["downloads"] },
];

function registerLazyStudentViews(d) {
  function applyRegisters() {
    STUDENT_LAZY_GROUPS.forEach(function (g) {
      var fn = typeof window[g.register] === "function" ? window[g.register] : null;
      if (fn) fn(d);
    });
  }

  function loadExtras() {
    return loadCasuyaScript(STUDENT_EXTRAS_SRC).then(applyRegisters);
  }

  d._prefetchExtras = loadExtras;

  STUDENT_LAZY_GROUPS.forEach(function (g) {
    g.views.forEach(function (name) {
      function lazyStub() {
        var args = arguments;
        d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
        return loadExtras().then(function () {
          var next = d._views[name];
          if (!next || next._lazy) {
            throw new Error("Missing view " + name);
          }
          return next.apply(null, args);
        }).catch(function () {
          d.showView('<div class="empty-state"><p>Could not load this section. Check your connection and try again.</p></div>');
        });
      }
      lazyStub._lazy = true;
      d.registerView(name, lazyStub);
    });
  });
}

;
// modules/student/index.js — main entry point for student dashboard.
//
// Creates the StudentDashboard instance, registers all view modules,
// and kicks off the dashboard initialization. This replaces the old
// monolithic renderStudentDashboard() closure.

"use strict";

function renderStudentDashboard() {
  const dashboard = new StudentDashboard();
  window._casuyaStudentDashboard = dashboard;

  registerOverviewView(dashboard);
  registerSubjectsView(dashboard);
  registerLessonsView(dashboard);
  registerProgressView(dashboard);
  registerBookmarksView(dashboard);
  registerAssignmentsView(dashboard);
  registerNotificationsView(dashboard);
  registerSettingsView(dashboard);
  registerClassView(dashboard);
  registerProfileView(dashboard);
  registerLazyStudentViews(dashboard);

  dashboard.init();

  var prefetch = function () {
    if (typeof dashboard._prefetchExtras === "function") dashboard._prefetchExtras();
    if (typeof ensureSpeechBundle === "function") ensureSpeechBundle();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(prefetch, { timeout: 8000 });
  } else {
    setTimeout(prefetch, 4000);
  }
}

;
// modules/student-dashboard.js — backward-compatible wrapper.
//
// The original 2,448-line closure-based implementation has been refactored
// into a class-based module architecture under modules/student/*.js.
//
// This file preserves the original renderStudentDashboard() entry point
// so that dashboards.js and any other callers continue to work without
// changes.  The actual implementation lives in:
//
//   modules/student/index.js      — entry point
//   modules/student/dashboard/state.js  — StudentDashboard class
//   modules/student/dashboard/sidebar.js — sidebar helpers
//   modules/student/dashboard/bootstrap.js — startup & lifecycle
//   modules/student/overview.js   — dashboard overview
//   modules/student/subjects.js   — subject/topic/subtopic browser
//   modules/student/lessons/      — lesson viewer (cache/builders/iframe/interactions/viewer)
//   modules/student/progress.js   — progress tracking
//   modules/student/bookmarks.js  — bookmarks
//   modules/student/assignments.js — assignments
//   modules/student/games.js      — games
//   modules/student/exams.js      — exam papers
//   modules/student/files.js      — file management
//   modules/student/library.js    — reference library
//   modules/student/payments.js   — payments & plans
//   modules/student/downloads.js  — offline downloads
//   modules/student/notifications.js — notifications
//   modules/student/settings.js   — settings & appearance
//   modules/student/class-view.js — My Class view
//   modules/student/profile.js    — profile editor
//   modules/student/utils.js      — shared utilities
//
// When bundled, all student/*.js files are concatenated BEFORE this file,
// so renderStudentDashboard is already defined. This wrapper is kept for
// backward compatibility and as a safety net.

"use strict";

// If the new module entry point hasn't loaded yet (e.g. during testing or
// an unusual load order), fall back to an informative error.
if (typeof renderStudentDashboard !== "function") {
  var renderStudentDashboard = function () {
    console.error(
      "renderStudentDashboard is not defined. " +
      "Ensure the student/*.js modules are loaded before student-dashboard.js."
    );
  };
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
