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
// modules/api.js — extracted from main.js (classic script, shared global scope)
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

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

const requestCache = new Map();

const inFlight = new Map();

function clearRequestCaches() {
  requestCache.clear();
  inFlight.clear();
}
window.clearRequestCaches = clearRequestCaches;

const CACHE_TTL = 30000;

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = `${method}:${path}`;

  if (method === "GET") {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }
  } else {
    requestCache.clear();
  }

  const doFetch = async () => {
    const token = localStorage.getItem("casuya_token");
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
      try {
        let fetchUrl = `${API_BASE}${path}`;
        const resp = await fetch(fetchUrl, { ...options, headers });
        if (resp.status === 401) {
          if (!options._retried) {
            try {
              const newToken = await refreshAuthToken();
              headers["Authorization"] = `Bearer ${newToken}`;
              const retryResp = await fetch(fetchUrl, { ...options, headers, _retried: true });
              if (retryResp.status === 401) throw new Error("Session expired. Please sign in again.");
              if (!retryResp.ok) {
                const err = await retryResp.json().catch(() => ({ detail: retryResp.statusText }));
                throw new Error(err.detail || "Request failed");
              }
              const retryData = await retryResp.json();
              if (method === "GET") requestCache.set(cacheKey, { data: retryData, timestamp: Date.now() });
              return retryData;
            } catch (refreshErr) {
              localStorage.removeItem("casuya_token");
              localStorage.removeItem("casuya_refresh_token");
              clearRequestCaches();
              renderLogin();
              return null;
            }
          }
          localStorage.removeItem("casuya_token");
          localStorage.removeItem("casuya_refresh_token");
          clearRequestCaches();
          renderLogin();
          return null;
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: resp.statusText }));
          if (resp.status >= 500 && attempt < 2) continue;
          throw new Error(err.detail || "Request failed");
        }
        const data = await resp.json();
        if (method === "GET") {
          requestCache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
      } catch (err) {
        lastErr = err;
        if ((err.name !== "TypeError" && err.name !== "SyntaxError") || attempt >= 2) break;
      }
    }
    throw lastErr;
  };

  const promise = doFetch().finally(() => inFlight.delete(cacheKey));
  if (method === "GET") {
    inFlight.set(cacheKey, promise);
  }
  return promise;
}

async function refreshAuthToken() {
  const refreshToken = localStorage.getItem("casuya_refresh_token");
  if (!refreshToken) throw new Error("No refresh token");
  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) throw new Error("Refresh failed");
  const data = await resp.json();
  if (data.access_token) localStorage.setItem("casuya_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("casuya_refresh_token", data.refresh_token);
  return data.access_token;
}

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

/* ── Tutoring Markdown Renderer ─────────────────────────────────────── */
function renderTutorMarkdown(raw) {
  if (!raw) return "";
  let text = raw;

  // Strip <think>...</think> tags (some models leak these)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Fences ``` ... ``` → scrollable code block
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<div class="tutor-code-block"><pre><code>${escapeHtml(code.trimEnd())}</code></pre></div>`;
  });

  // Tables: detect markdown tables and convert
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

  // NECTA Exam Tip blocks (💡 line followed by content until *** or blank line)
  text = text.replace(/^(.*💡\s*(?:NECTA\s+(?:Examination\s+)?Tip|Mtihani).*)\n((?:(?!\*\*\*).+\n?)*)/gim, (_, tipLine, body) => {
    const cleanBody = escapeHtml(body.trim()).replace(/\n/g, "<br>");
    return `<div class="tutor-necta-tip"><div class="tutor-necta-tip-label">💡 NECTA Examination Tip</div><p>${cleanBody}</p></div>`;
  });

  // Blockquotes > ... → context blockquote
  text = text.replace(/^>\s*(.+)$/gm, (_, content) => {
    const isLocal = /tanzan|serengeti|kilimanjaro|lake victoria|dodoma|dar|kenya|uganda|east africa|africa|mwanza|arusha|mbeya|ruaha|rufiji/i.test(content);
    const badge = isLocal ? "🌍 Tanzania Context" : "📖 Context";
    return `<div class="tutor-context-blockquote"><div class="tutor-context-badge">${badge}</div><p>${escapeHtml(content)}</p></div>`;
  });
  // Remove duplicate blockquote wrappers (if multiple > lines were wrapped individually)
  text = text.replace(/(<div class="tutor-context-blockquote">[\s\S]*?<\/div>\n?)+/g, (match) => {
    return match;
  });

  // Horizontal rules ***
  text = text.replace(/^\*\*\*\s*$/gm, "<hr>");

  // Headers — escape capture groups
  text = text.replace(/^#### (.+)$/gm, (_, t) => `<h4>${escapeHtml(t)}</h4>`);
  text = text.replace(/^### (.+)$/gm, (_, t) => `<h3>${escapeHtml(t)}</h3>`);
  text = text.replace(/^## (.+)$/gm, (_, t) => `<h2>${escapeHtml(t)}</h2>`);
  text = text.replace(/^# (.+)$/gm, (_, t) => `<h1>${escapeHtml(t)}</h1>`);

  // Bold + italic — escape capture groups
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => `<strong><em>${escapeHtml(t)}</em></strong>`);
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
  text = text.replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`);

  // Inline code — escape capture group
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);

  // Unordered lists — escape capture groups
  text = text.replace(/^(?:- (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${escapeHtml(l.replace(/^- /, ""))}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists — escape capture groups
  text = text.replace(/^(?:\d+\. (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${escapeHtml(l.replace(/^\d+\. /, ""))}</li>`).join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: double newline → paragraph break
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

/* ── Quiz Questions Renderer ───────────────────────────────────────── */
function renderQuizQuestions(questions, meta = {}) {
  if (!Array.isArray(questions) || !questions.length) {
    return '<p style="color:var(--color-text-muted)">No questions generated.</p>';
  }
  const subject = meta.subject || "General";
  const formLevel = meta.formLevel || "";
  const topic = meta.topic || "";
  const subjectLabels = { mathematics:"Mathematics", biology:"Biology", chemistry:"Chemistry", physics:"Physics", english:"English", kiswahili:"Kiswahili", geography:"Geography", history:"History", civics:"Civics", computing:"Computing" };
  const subjectLabel = subjectLabels[subject] || subject;
  const formLabel = formLevel ? `Form ${["I","II","III","IV"][Number(formLevel)-1] || formLevel}` : "";
  const badgeParts = [subjectLabel, formLabel].filter(Boolean).join(" \u2022 ");
  const quizId = "quiz-" + Date.now();

  let html = `<div class="quiz-container" id="${quizId}">`;

  // Header
  html += `<div class="quiz-header">
    <span class="quiz-badge">${escapeHtml(badgeParts)}</span>
    <span class="quiz-counter">Question 1 of ${questions.length}</span>
    ${topic ? `<div class="quiz-topic">Topic: ${escapeHtml(topic)}</div>` : ""}
  </div>`;

  // Question cards
  html += '<div class="quiz-card">';
  questions.forEach((q, i) => {
    const letters = ["A","B","C","D"];
    const options = q.options || [];
    const correctAnswer = (q.correctAnswer || "").trim().toUpperCase();
    const explanation = q.explanation || "";

    html += `<div class="quiz-question" data-index="${i}" data-correct="${escapeHtml(correctAnswer)}">`;
    html += `<div class="quiz-question-num">Question ${i+1}</div>`;
    html += `<div class="quiz-question-text">${escapeHtml(q.text || "")}</div>`;
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

    // Explanation (hidden until submit)
    if (explanation) {
      html += `<div class="quiz-explanation" id="${quizId}-exp-${i}">
        <strong>Explanation:</strong> ${escapeHtml(explanation)}
      </div>`;
    }
    html += '</div>';
  });

  // Submit + Download buttons
  html += `<div class="quiz-btn-row">
    <button class="btn btn-primary quiz-submit-all" onclick="window._quizSubmit('${quizId}', ${questions.length})">Submit Answers</button>
    <button class="btn quiz-download-btn" onclick="window._quizDownloadWord('${quizId}')">📄 Word</button>
    <button class="btn quiz-download-btn" onclick="window._quizDownloadPdf('${quizId}')">📋 PDF</button>
  </div>`;

  // Score banner
  html += `<div class="quiz-score" id="${quizId}-score">
    <div class="quiz-score-num" id="${quizId}-score-num"></div>
    <div class="quiz-score-label" id="${quizId}-score-label"></div>
  </div>`;

  html += '</div></div>';
  return html;
}

/* ── Math (KaTeX) Rendering ───────────────────────────────────────── */
// Render any LaTeX inside an element with KaTeX auto-render when available.
// Safe no-op if KaTeX is not loaded (e.g. offline before first successful
// contact with /static/lib/katex). Primarily used for AI-generated quizzes,
// which contain math the raw-text renderer would otherwise show as source.
window.renderMath = function (el) {
  if (!el || typeof window.renderMathInElement !== "function") return;
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

    // Track wrong/blank questions for the AI tutor
    if (selectedVal !== correctAnswer) {
      wrong.push(i);
    }

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

  // AI step-by-step tutor for any wrong/blank answers
  if (wrong.length) {
    _tutorWrongQuestions(quizId, total, wrong);
  }
};

/* ── AI Step-by-Step Tutor (on wrong answers) ───────────────────────── */
function _tutorWrongQuestions(quizId, total, wrongIndexes) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions || !wrongIndexes.length) return;

  var subjectSlug = "";
  var formLevel = "";
  var slugMap = { mathematics:"mathematics", math:"mathematics", biology:"biology", chemistry:"chemistry", physics:"physics", english:"english", kiswahili:"kiswahili", geography:"geography", history:"history", civics:"civics", computing:"computing" };
  var m = (data.meta || "").match(/^([A-Za-z ]+)\s*(\u2022)?\s*Form\s*([IVX]+)/i);
  if (m) {
    var label = slugMap[m[1].trim().toLowerCase()];
    if (label) subjectSlug = label;
    var roman = m[3];
    formLevel = (roman === "I") ? "1" : (roman === "II") ? "2" : (roman === "III") ? "3" : "4";
  }

  // Build a compact markdown prompt describing each wrong question
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

  // Build the tutor card
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

  var payload = {
    question: question,
    lesson_context: data.topic
      ? "Topic: " + data.topic
      : (data.meta ? "Subject: " + data.meta : ""),
    subject_slug: subjectSlug || undefined,
    form_level: formLevel ? Number(formLevel) : undefined
  };

  request("/ai/tutoring/explain", {
    method: "POST",
    body: JSON.stringify(payload)
  }).then(function(result) {
    var response = (result && result.response) ? result.response : "";
    if (!response) {
      body.innerHTML = '<div class="tutor-fallback">The AI tutor is temporarily unavailable. Please review the explanations above or ask your teacher for help.</div>';
      return;
    }
    body.innerHTML = '<div class="tutor-response">' + renderTutorMarkdown(response) + '</div>';
  }).catch(function() {
    body.innerHTML = '<div class="tutor-fallback">The AI tutor could not be reached. Please review the explanations above or ask your teacher for help.</div>';
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
            if (data.done) { if (onDone) onDone(); return; }
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
  localStorage.removeItem("casuya_token");
  window.location.href = "/index.html#features";
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
// modules/lesson.js — extracted from main.js (classic script, shared global scope)
const lessonContentCache = new Map();
let _currentLessonIframe = null;

async function viewLessonContent(containerId, lessonId, backFn) {
  const container = document.querySelector(containerId);
  if (!container) return;

  if (_currentLessonIframe) {
    try {
      const prevIvs = _currentLessonIframe.contentWindow?.casuya?._intervals || [];
      prevIvs.forEach(id => _currentLessonIframe.contentWindow.clearInterval(id));
    } catch(e) {}
    _currentLessonIframe = null;
  }

  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>`;

  let html;
  if (lessonContentCache.has(lessonId)) {
    html = lessonContentCache.get(lessonId);
  }
  try {

    const token = localStorage.getItem("casuya_token");
    const payload = decodeToken(token);
    const isStudent = payload?.role === "student";
    const canBookmark = isStudent || payload?.role === "teacher";

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
    try {
      const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      const idx = recent.findIndex(r => r.id === lessonId);
      if (idx >= 0) { recent[idx].title = lessonTitle; localStorage.setItem("casuya_recently_viewed", JSON.stringify(recent)); }
    } catch(e) {}

    if (!html) {
      const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      });
      if (resp.status === 404) {
        const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
        const filtered = recent.filter(r => r.id !== lessonId);
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        container.innerHTML = '<div class="empty-state"><p>This lesson is no longer available.</p></div>';
        return;
      }
      if (!resp.ok) throw new Error("Failed to load lesson");
      html = await resp.text();
      lessonContentCache.set(lessonId, html);
      if (lessonContentCache.size > 50) {
        const key = lessonContentCache.keys().next().value;
        lessonContentCache.delete(key);
      }
    }

    const lessonStart = Date.now();
    let studentId = null;
    let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    let quizScoreSent = false;
    let lastSentCompletion = -1;
    let lastSentScore = -1;
    let progressTimer = null;

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
      if (completionPct <= lastSentCompletion && (scorePct == null || scorePct <= lastSentScore)) return;
      lastSentCompletion = Math.max(lastSentCompletion, completionPct);
      if (scorePct != null) lastSentScore = Math.max(lastSentScore, scorePct);
      if (progressTimer) clearTimeout(progressTimer);
      progressTimer = setTimeout(() => {
        const elapsed = Date.now() - lessonStart;
        request("/progress/sync", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            lesson_id: lessonId,
            session_id: sessionId,
            elapsed_ms: elapsed,
            completion_percentage: lastSentCompletion,
            score_percentage: lastSentScore >= 0 ? lastSentScore : null,
          }),
        }).then(() => showToast("Progress saved")).catch(() => {});
      }, 2000);
    }

    // Inject bridge script
    const bridgeScript = `
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
  function initBridge() {
    if (!document.body) { setTimeout(initBridge, 100); return; }
    upgradeAdaptiveVideos(document.body);
    trackVideos(document.body);
    detectScore();
    var obs = new MutationObserver(function() { detectScore(); upgradeAdaptiveVideos(document.body); trackVideos(document.body); });
    obs.observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBridge);
  else initBridge();
})();
<\/script>`;
    const bodyIdx = html.lastIndexOf("</body>");
    if (bodyIdx !== -1) {
      html = html.slice(0, bodyIdx) + bridgeScript + html.slice(bodyIdx);
    } else {
      html = html.replace("</html>", bridgeScript + "</html>");
    }

    // Use pkgData from the earlier aggregated call (P2-3) — no second request needed.
    let bookmarked = false;
    let quizData = null;
    let gamesData = [];
    let noteData = { content: "" };
    if (pkgData) {
      bookmarked = pkgData.bookmark_status?.bookmarked || false;
      quizData = isStudent ? pkgData.quiz : null;
      gamesData = isStudent ? (pkgData.games || []) : [];
      noteData = isStudent ? (pkgData.note || { content: "" }) : { content: "" };
    }

    const renderQuiz = () => {
      if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
      return `
        <div class="card" style="margin-top:1rem;padding:1rem">
          <h3 style="margin:0 0 0.75rem">${escapeHtml(quizData.title || "Quiz")}</h3>
          <form id="quiz-form">
            ${quizData.questions.map((q, qi) => `
              <div style="margin-bottom:1rem">
                <p style="font-weight:600;margin:0 0 0.5rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
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
    };

    const renderGames = () => {
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
    };

    container.innerHTML = `
      <div class="content" style="max-width:100%;padding:0">
        <div style="padding:0.75rem 1rem;display:flex;align-items:center;gap:0.5rem;background:var(--color-surface);border-bottom:1px solid var(--color-border);flex-wrap:wrap">
          <button class="btn btn-primary lesson-back-btn" style="margin-bottom:0">&larr; Back</button>
          <span style="flex:1;font-weight:600;font-size:0.95rem">${escapeHtml(lessonTitle)}</span>
          ${canBookmark ? `
            <button class="btn btn-sm lesson-bookmark-btn" style="${bookmarked ? 'background:var(--color-warning);color:#fff' : ''};margin-bottom:0">${bookmarked ? "★" : "☆"}</button>
          ` : ""}
          ${isStudent ? `
            <button class="btn btn-success btn-sm lesson-complete-btn" style="margin-bottom:0">Mark Complete</button>
          ` : ""}
        </div>
        <div style="width:100%">
          <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
        </div>
        ${isStudent ? `
          <div style="padding:0 1rem">
            <details style="margin-top:0.75rem">
              <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
              <div style="margin-top:0.5rem">
                <textarea id="lesson-notes" rows="4" style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:var(--radius);font-size:0.85rem">${escapeHtml(noteData?.content || "")}</textarea>
                <button class="btn btn-sm btn-primary" id="notes-save-btn" style="margin-top:0.35rem">Save Notes</button>
                <span id="notes-status" style="font-size:0.8rem;color:var(--color-text-muted);margin-left:0.5rem"></span>
              </div>
            </details>
            ${renderQuiz()}
            ${renderGames()}
            <div class="card" style="margin-top:0.75rem;padding:1rem">
              <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
              <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
            </div>
          </div>
        ` : ""}
      </div>
    `;

    const iframe = container.querySelector(".lesson-iframe");
    _currentLessonIframe = iframe;
    iframe.srcdoc = injectNodeBase(html);
    let heightSet = false;
    const setHeight = () => {
      if (heightSet) return;
      try {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
          heightSet = true;
        }
      } catch(e) {}
    };
    iframe.addEventListener("load", setHeight);
    const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
    setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "800px"; }, 10000);

    const onMessage = (e) => {
      if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
        quizScoreSent = true;
        const pct = Math.round((e.data.score / e.data.total) * 100);
        sendProgress(100, pct);
      } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
        sendProgress(e.data.percent, null);
      }
    };
    window.addEventListener("message", onMessage);

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
            if (bookmarked) {
              await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
              bookmarked = false; bmBtn.textContent = "☆"; bmBtn.style.background = "";
              showToast("Bookmark removed");
            } else {
              await request(`/bookmarks/${lessonId}`, { method: "POST" });
              bookmarked = true; bmBtn.textContent = "★"; bmBtn.style.background = "var(--color-warning)"; bmBtn.style.color = "#fff";
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
          sendProgress(100, pct);
          quizScoreSent = true;
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
          const resp = await fetch(`/games/${gameId}/content`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
          });
          if (!resp.ok) throw new Error("Failed to load game content");
          const html = await resp.text();
          area.innerHTML = `<iframe style="width:100%;min-height:400px;border:none;border-radius:var(--radius)" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>`;
        } catch(err) {
          area.innerHTML = `<p style="color:var(--color-danger)">Error loading game: ${escapeHtml(err.message)}</p>`;
        }
      });
    });

    const backBtn = container.querySelector(".lesson-back-btn");
    backBtn.addEventListener("click", () => {
      if (isStudent && !quizScoreSent) sendProgress(80, null);
      window.removeEventListener("message", onMessage);
      if (progressTimer) clearTimeout(progressTimer);
      try {
        const ivs = iframe.contentWindow?.casuya?._intervals || [];
        ivs.forEach(id => iframe.contentWindow.clearInterval(id));
      } catch(e) {}
      _currentLessonIframe = null;
      backFn();
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
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
      html += '<textarea class="exam-structured-answer" data-question="' + escapeHtml(q.number) + '" placeholder="Write your answer here..." style="width:100%;min-height:80px;padding:0.5rem;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;font-size:0.9rem;resize:vertical;margin-top:0.4rem"></textarea>';
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
// i18n.js — English/Swahili translation system for Casuya Platform.
// Uses data-i18n attributes on HTML elements. Toggle stores preference in localStorage.

(function () {
  "use strict";

  var STORAGE_KEY = "casuya_lang";

  // ── Swahili translations ──────────────────────────────────────────────
  // Real Swahili used in Tanzanian educational context.
  var SW = {
    // Navigation
    "nav.features": "Vipengele",
    "nav.subjects": "Masomo",
    "nav.about": "Kuhusu",
    "nav.login": "Ingia",
    "nav.get_started": "Anza Sasa",
    "nav.start": "Anza",
    "nav.create_account": "Fungua Akaunti",
    "nav.users": "Watumiaji",

    // Accessibility toolbar
    "a11y.skip": "Ruka hadi kwenye maudhui makuu",
    "a11y.region": "Chaguzi za ufikiaji",
    "a11y.open": "Fungua mipangilio ya ufikiaji",
    "a11y.panel": "Jopo la mipangilio ya ufikiaji",
    "a11y.settings": "Mipangilio ya Ufikiaji",
    "a11y.dyslexia": "Maandishi ya Wenye Changamoto ya Kusoma (Dyslexia)",
    "a11y.toggle_dyslexia": "Washa/zima font ya wenye changamoto ya kusoma",
    "a11y.high_contrast": "Ung'avu wa Juu",
    "a11y.toggle_contrast": "Washa/zima hali ya ung'avu wa juu",
    "a11y.large_text": "Maandishi Makubwa",
    "a11y.toggle_large_text": "Washa/zima hali ya maandishi makubwa",
    "a11y.wide_spacing": "Nafasi Kubwa Kati ya Maandishi",
    "a11y.toggle_wide_spacing": "Washa/zima nafasi kubwa kati ya mistari na maandishi",
    "a11y.size": "Ukubwa",
    "a11y.fontsize_pct": "Asilimia ya ukubwa wa fonti",
    "a11y.tts": "Kusoma kwa Sauti",
    "a11y.toggle_tts": "Washa/zima usomaji kwa sauti",
    "a11y.speech_rate": "Kasi ya usomaji",
    "a11y.play": "Cheza usomaji",
    "a11y.pause": "Simamisha usomaji",
    "a11y.stop": "Acha usomaji",
    "a11y.ready": "Tayari",

    // Hero
    "hero.badge": "Kwa wanafunzi na walimu wa Tanzania",
    "hero.title1": "Shule unayotamani kuwa nayo —<br>kwenye simu inayoshirikiwa.",
    "hero.title2": "Fundisha Bora.",
    "hero.title3": "Jenga Mustakabali.",
    "hero.clarity": "Masomo, majaribio na matokeo — yaliyojengwa kwa mtaala wa kidato cha kwanza hadi cha sita.",
    "hero.desc": "Casuya hukuletea kujifunza nyumbani: nje ya mtandao, kwa Kiswahili na Kiingereza, kwenye simu ambazo Watanzania wanatumia.",
    "hero.off_excuse": "Jifunze ulipo — hata mtandao usipokuwapo.",
    "hero.start": "Karibu — ingia kufungulia wiki yako",
    "hero.demo": "Twende — angalia jinsi inavyofanya kazi",

    // Hero "your week" card
    "hero_week_sub": "wiki yako ya kujifunza",
    "hero_week_greet": "Habari za asubuhi 👋",
    "hero_week_streak": "Mfuatano wa kujifunza",
    "hero_week_day0": "Siku 0",
    "hero_week_streakline": "Anza mfuatano wako — somo moja kwa siku, hata mtandao usipokuwepo.",
    "hero_week_lesson": "Somo la leo",
    "hero_week_continue": "Endelea →",
    "hero_week_offline": "Imehifadhiwa nje ya mtandao",
    "hero_week_offlineline": "Jiunge kupakua masomo na kujifunza mahali ambapo mtandao haufiki.",
    "hero_week_unlock": "Ingia kufungulia wiki yako",
    "hero_week_honest": "Bure kuanza · Inafanya kazi kwenye simu ya RAM ya GB 2 · Inahifadhi kazi yako hata mtandao usipokuwepo.",

    // Hero mock UI
    "hero.today_lesson": "Masomo ya Leo",
    "hero.dive_into": "\"Zama katika mazoezi ya kushirikiana yenye maswali na ufuatiliaji wa maendeleo kwa wakati halisi.\"",
    "hero.class_sync": "Usawazishaji wa Darasa",
    "hero.offline_ready": "Tayari Kwa Mtandao 100%",
    "hero.avg_score": "Wastani wa Alama",
    "hero.progress": "+18% Maendeleo",

    // Trusted
    "trusted.title": "Imejengwa hapa, kwa hapa",
    "trust.t2gb": "Inafanya kazi kwenye simu ya RAM ya GB 2",
    "trust.offline": "Inafanya kazi nje ya mtandao",
    "trust.curriculum": "Imetengenezwa kwa mtaala wa Tanzania · Kidato cha 1 hadi 6",
    "trust.free": "Bure kuanza — hakuna kadi inayohitajika",
    "trust.lang": "Jifunze kwa Kiingereza na Kiswahili",
    "trust.data": "Alama na data zako zinabaki kuwa zako salama",

    // Features
    "features.badge": "Casuya hufanya nini siku ya kawaida",
    "features.title": "Zana ndogo, siku za kweli",
    "features.desc": "Hakuna mambo ya sifa tu — ni vitu vinavyorahisisha maisha ya shule, hata kama simu ni ya zamani na mtandao ni dhaifu.",
    "feature.interactiveLessons.title": "Masomo Shirikishi",
    "feature.interactiveLessons.blurb": "Masomo yenye mvuto kama mchezo — chemsha bongo na mazoezi yanayojisahihisha yenyewe unapofanya. Unaweza kurudia mada mpaka uelewe vizuri.",
    "feature.offlineLearning.title": "Kujifunza Nje ya Mtandao",
    "feature.offlineLearning.blurb": "Umeme umekatika? Safari ndefu ya daladala? Pakua mada mara moja kukiwa na mtandao mzuri, kisha soma popote — hata mahali ambapo hakuna mawimbi kabisa.",
    "feature.aiAssistant.title": "Msaidizi wa Walimu wa AI",
    "feature.aiAssistant.blurb": "Unaandaa chemsha bongo usiku wa manane? Mwombe Casuya aiandae kwa dakika chache — kwa Kiingereza au Kiswahili. Msaidizi wa ziada kwa walimu wenye majukumu mengi.",
    "feature.analytics.title": "Maendeleo Yanayoonekana",
    "feature.analytics.blurb": "Kwa mtazamo mmoja tu, ona mada inayowatatiza wanafunzi darasani — hakuna haja ya kupekua rundo la karatasi zilizosahihishwa mwisho wa muhula.",
    "feature.assessments.title": "Tathmini na Mitihani",
    "feature.assessments.blurb": "Andaa chemsha bongo, hojaji na kazi za masomo kwa dakika chache — zilizoundwa kuendana na jinsi masomo yanavyofundishwa darasani.",
    "feature.cloudSync.title": "Uhifadhi wa Kidijitali (Cloud)",
    "feature.cloudSync.blurb": "Alama na maendeleo yako yanahifadhiwa salama, na yanasawazishwa mara tu mtandao unapopatikana. Hakuna kinachopotea simu ikizima.",
    "feature.digitalExaminations.title": "Mitihani ya Kidijitali",
    "feature.digitalExaminations.blurb": "Endesha mitihani salama kwenye kivinjari inayojisahihisha na kutunza matokeo salama — kukiwa na usahihishaji wa papo hapo na matokeo ya uaminifu.",
    "feature.aiLessonCreation.title": "Maandalizi ya Masomo kwa AI",
    "feature.aiLessonCreation.blurb": "Tengeneza muhtasari wa masomo, chemsha bongo na vifaa vya kujifunzia kwa dakika chache — msaidizi imara pale siku ya shule inapokuwa ndefu.",

    // Subjects
    "subjects.badge": "Kidato cha 1–6 · Mtalaa wa Tanzania",
    "subjects.title": "Masomo unayofanya — yote mahali pamoja",
    "subjects.desc": "Kuanzia Kiswahili na Civics hadi Hisabati na Sayansi — masomo yale yale unayofanya darasani, tayari kwa kidato cha kwanza hadi cha sita.",
    "subjects.kiswahili": "Kiswahili",
    "subjects.english": "English / Kiingereza",
    "subjects.maths": "Hisabati",
    "subjects.civics": "Uraia na Maadili",
    "subjects.history": "Historia",
    "subjects.geography": "Jiografia",
    "subjects.physics": "Fizikia",
    "subjects.chemistry": "Kemia",
    "subjects.biology": "Biolojia",
    "subjects.mathematics": "Hisabati za Msingi",
    "subjects.more": "... na zaidi kwenye mtaala. Jifunze kidogo kila siku, uweke darasa zima live, na uikabili Mitihani ya Taifa kwa imani — si kwa hofu.",

    // Audiences
    "audiences.badge": "Watu halisi, siku halisi",
    "audiences.title": "Imetengenezwa kwa madarasa kama yako",
    "audiences.desc": "Mwalimu, wanafunzi na baba — watu wa kawaida ambao Casuya imewajengewa. Kama inafanya kazi kwa simu ya kushirikiwa kijijini, inafanya kazi kwako.",

    // People (users of Casuya, not builders)
    "people.cosmas": "Cosmas Dismas",
    "people.cosmas_role": "Mwalimu · Geita",
    "people.cosmas_story": "Cosmas husahihisha karatasi hamsini au sitini za Kidato cha Tatu baada ya shule, mara nyingi kwa taa ya mafuta umeme unapokatika. Kwa Casuya anaanzisha majaribio mara moja na yanajisahihisha yenyewe — ili aokoe muda jioni wa kuwasaidia wanafunzi wanaomhitaji.",
    "people.bahati": "Bahati Abeld Chusi",
    "people.bahati_role": "Mwanafunzi · Iringa",
    "people.bahati_story": "Bahati anashiriki simu. Anapakua maelezo yake ya Civics Kidato cha Pili kwenye mtandao mzuri wa shule, kisha anasoma akirudi nyumbani kwa daladala — bila mtandao, bila shida.",
    "people.nickson": "Nickson Kasmir Tlanka",
    "people.nickson_role": "Mwanafunzi · Karatu",
    "people.nickson_story": "Nickson anaona masomo mengine ni magumu kufuata darasani kukiwa na wanafunzi wengi. Masomo shirikishi ya Casuya yanamruhusu kurudi nyuma na kujifunza kwa kasi yake, mara kwa mara, mpaka aelewe.",
    "people.shedrack": "Shedrack Peam Laurent",
    "people.shedrack_role": "Mwanafunzi · Arusha",
    "people.shedrack_story": "Shedrack anataka kufuatilia maendeleo yake, somo kwa somo, bila kusubiri mwisho wa muhula. Casuya inamuonyesha anapokua kila wiki.",
    "people.eliya": "Eliya Kikoti",
    "people.eliya_role": "Baba · Iringa",
    "people.eliya_story": "Eliya anataka kujua kama mtoto wake anajifunza kweli, si tu 'kupita.' Kwa Casuya anaweza kuona maendeleo halisi — jaribio kwa jaribio, somo kwa somo — hata kwenye simu ya kushirikiwa ya mtoto wake.",

    // Mid-page re-ask
    "reask.title": "Anza mfuatano wako leo — siku ya kwanza ni bure",
    "reask.desc": "Somo moja kwa siku linatosha kuanza. Maendeleo yako yanahifadhiwa papo hapo unapojiunga.",
    "reask.cta": "Anza bure →",

    // CTA
    "cta.letterlabel": "Neno kutoka Casuya",
    "cta.letter": "\"Casuya ilijengwa kwa watu halisi kama <strong>Cosmas</strong>, mwalimu; <strong>Bahati</strong>, <strong>Nickson</strong> na <strong>Shedrack</strong>, wanafunzi; na <strong>Eliya</strong>, baba — watu wanaoshiriki simu, wanaosoma wakati umeme ukipita, na ambao daima waliweza zaidi ya hali zao zilivyoruhusu.<br><br>Shule hii ni yako. Ni nyepesi kwa simu uliyo nayo, na inafanya kazi hata mahali mtandao usipofika — ili kizuizi pekee cha mafanikio yako kiondoke. Karibu — sasa wewe ni sehemu ya Casuya.\"",
    "cta.how": "Karibu — angalia jinsi inavyofanya kazi",

    // Demo modal
    "demo.step1": "Hatua ya 1 — Ingia",
    "demo.step2": "Hatua ya 2 — Umesahau Nenosiri",
    "demo.step3": "Hatua ya 3 — Jisajili",
    "demo.step4": "Hatua ya 4 — Dashibodi",
    "demo.welcome_back": "Karibu Tena",
    "demo.sign_in_continue": "Ingia ili kuendelea na safari yako ya kujifunza",
    "demo.email": "Barua Pepe",
    "demo.password": "Nenosiri",
    "demo.forgot_password": "Umesahau nenosiri?",
    "demo.remember_me": "Nikumbuke",
    "demo.sign_in": "Ingia",
    "demo.no_account": "Huna akaunti?",
    "demo.sign_up_free": "Jisajili bure",
    "demo.forgot_title": "Umesahau Nenosiri?",
    "demo.forgot_desc": "Weka barua pepe yako na tutakutumia kiungo cha kurejesha.",
    "demo.send_reset": "Tuma Kiungo cha Kurejesha",
    "demo.link_sent": "Kiungo Kimetumwa!",
    "demo.check_email": "Angalia barua pepe yako kwa kiungo.",
    "demo.remember_password": "Unakumbuka nenosiri lako?",
    "demo.create_account_title": "Fungua akaunti yako",
    "demo.join_desc": "Jiunge na Casuya na uanze kujifunza leo.",
    "demo.full_name": "Jina Kamili",
    "demo.role": "Jukumu",
    "demo.student": "Mwanafunzi",
    "demo.phone": "Simu",
    "demo.confirm_password": "Thibitisha Nenosiri",
    "demo.create_btn": "Fungua Akaunti",
    "demo.create_account": "Fungua Akaunti",
    "demo.create_account_desc": "Jiunge na Casuya na uanze kujifunza leo.",
    "demo.has_account": "Tayari una akaunti? ",
    "demo.sign_in_desc": "Ingia kuendelea na safari yako ya kujifunza",
    "demo.progress": "65% Imekamilika",
    "demo.chem_organic": "Kemia - Misombo ya Kikaboni",
    "demo.chapter_time": "Sura ya 3 • Dakika 45",
    "demo.subject_chem": "Kemia",
    "demo.subject_bio": "Biolojia",
    "demo.subject_math": "Hisabati",
    "demo.already_account": "Tayari una akaunti?",
    "demo.sign_in_link": "Ingia",
    "demo.welcome": "Karibu tena",
    "demo.ready_continue": "Tayari kuendelea na safari yako ya kujifunza?",
    "demo.lessons": "Masomo",
    "demo.avg_score": "Wastani wa Alama",
    "demo.streak": "Mfuatano",
    "demo.my_subjects": "Masomo Yangu",

    // Footer
    "footer.platform": "Jukwaa",
    "footer.features": "Vipengele",
    "footer.docs": "Nyaraka",
    "footer.subjects": "Masomo",
    "footer.support": "Msaada",
    "footer.help": "Kituo cha Msaada",
    "footer.contact": "Wasiliana Nasi",
    "footer.whatsapp": "WhatsApp",
    "footer.legal": "Kisheria",
    "footer.privacy": "Sera ya Faragha",
    "footer.terms": "Masharti ya Huduma",
    "footer.links": "Viungo",
    "footer.github": "Mitandao ya GitHub",
    "footer.copyright": "© 2026 Jukwaa la Casuya. Haki zote zimehifadhiwa.",
    "footer.built": "Imetengenezwa kwa upendo kwa ajili ya shule za Tanzania",
    "footer.chat": "Ongea nasi kupitia WhatsApp",

    // Login
    "login.title": "Karibu Tena",
    "login.desc": "Ingia ili kuendelea na safari yako ya kujifunza",
    "login.email_label": "Barua Pepe",
    "login.email_placeholder": "Weka barua pepe yako",
    "login.password_label": "Nenosiri",
    "login.password_placeholder": "Weka nenosiri lako",
    "login.show_password": "Onyesha nenosiri",
    "login.hide_password": "Ficha nenosiri",
    "login.forgot": "Umesahau nenosiri?",
    "login.remember": "Nikumbuke barua pepe yangu",
    "login.remember_desc": "Nibaki nimeingia kwa siku 30",
    "login.or": "AU",
    "login.google": "Ingia na Google",
    "login.facebook": "Ingia na Facebook",
    "login.submit": "Ingia kwenye akaunti yako ya Casuya",
    "login.no_account": "Huna akaunti?",
    "login.signup_free": "Jisajili bure",
    "login.signing_in": "Inaingia...",
    "login.success": "Umeingia kwa mafanikio. Inaelekeza...",

    // Register
    "register.title": "Fungua akaunti yako",
    "register.desc": "Jiunge na Casuya na endelea na lango lako la mwanafunzi au mwalimu.",
    "register.fullname_label": "Jina Kamili",
    "register.fullname_placeholder": "Weka jina lako kamili",
    "register.email_label": "Barua Pepe",
    "register.email_placeholder": "mfano@barua pepe.com",
    "register.phone_label": "Nambari ya Simu",
    "register.phone_placeholder": "+255...",
    "register.account_type": "Aina ya Akaunti",
    "register.student": "Mwanafunzi",
    "register.teacher": "Mwalimu",
    "register.special_needs": "Mahitaji Maalum / Msomaji Mwengine",
    "register.account_type_desc": "Chagua aina ya akaunti inayoelezea vyema.",
    "register.accessibility": "Mapendeleo ya Upatikanaji",
    "register.accessibility_desc": "Chagua kitakachokusaidia kujifunza vizuri. Unaweza kubadilisha hii wakati wowote kwenye Mipangilio.",
    "register.reading_support": "Msaada wa Kusoma",
    "register.dyslexia_font": "Fonti rafiki kwa wasomaji",
    "register.larger_text": "Ukubwa mkubwa wa maandishi",
    "register.listening_support": "Msaada wa Kusikiliza",
    "register.tts_enabled": "Uwezeshaji wa maandishi kuwa sauti",
    "register.visual_support": "Msaada wa Kuona",
    "register.high_contrast": "Hali ya tofauti kubwa",
    "register.password_label": "Nenosiri",
    "register.password_placeholder": "Herufi 8 au zaidi",
    "register.strength": "Nguvu ya nenosiri",
    "register.req_8char": "Herufi 8+",
    "register.req_upper": "Herufi kubwa",
    "register.req_lower": "Herufi ndogo",
    "register.req_number": "Nambari",
    "register.req_special": "Herufi maalum",
    "register.confirm_label": "Thibitisha Nenosiri",
    "register.confirm_placeholder": "Weka nenosiri lako tena",
    "register.terms_prefix": "Ninakubali",
    "register.terms_link": "Masharti ya Huduma",
    "register.privacy_link": "Sera ya Faragha",
    "register.terms_summary": "Soma kwa lugha rahisi",
    "register.what_collect": "Tunachokusanya:",
    "register.collect_desc": "Jina lako, barua pepe, simu (hiari), na maendeleo ya kujifunza.",
    "register.how_use": "Tunavyotumia:",
    "register.use_desc": "Kufuatilia masomo yako, maswali, na kutoa kujifunza kwa kibinafsi.",
    "register.your_data": "Data yako:",
    "register.data_desc": "Unaweza kuomba tufute akaunti yako na data yako wakati wowote.",
    "register.payments": "Malipo:",
    "register.payments_desc": "Hatuwezi kuhifadhi kadi yako. Malipo yanashughulikiwa na watoa huduma wa kuaminika.",
    "register.safety": "Usalama:",
    "register.safety_desc": "Tunafuata sheria za ulinzi wa data za Tanzania na kuhifadhi data yako salama.",
    "register.submit": "Fungua akaunti yako ya Casuya",
    "register.has_account": "Tayari una akaunti?",
    "register.signin_link": "Ingia kwenye akaunti yako",
    "register.creating": "Inaunda akaunti...",
    "register.success": "Akaunti imeundwa kwa mafanikio. Inaelekeza...",

    // Forgot password
    "forgot.title": "Umesahau Nenosiri?",
    "forgot.desc": "Weka barua pepe au nambari ya simu na tutakusaidia kurejesha nenosiri lako.",
    "forgot.tab_email": "Barua Pepe",
    "forgot.tab_phone": "Nambari ya Simu",
    "forgot.email_label": "Barua Pepe",
    "forgot.email_placeholder": "mfano@barua pepe.com",
    "forgot.phone_label": "Nambari ya Simu",
    "forgot.phone_placeholder": "+255 7XX XXX XXX",
    "forgot.submit_email": "Nitumie kiungo cha kurejesha nenosiri",
    "forgot.submit_phone": "Tuma nambari ya kurejesha kupitia SMS",
    "forgot.link_sent": "Kiungo Kimetumwa!",
    "forgot.check_email": "Angalia barua pepe yako kwa kiungo. Inaweza kuchukua dakika chache kufika.",
    "forgot.next_steps": "Nini cha kufanya baadae:",
    "forgot.step1": "Fungua kisanduku chako cha barua pepe",
    "forgot.step2": "Pata barua pepe kutoka Jukwaa la Casuya",
    "forgot.step3": "Bofya kiungo la \"Kurejesha Nenosiri\" kwenye barua pepe",
    "forgot.step4": "Fungua nenosiri lako jipya",
    "forgot.spam": "Hujapokea? Angalia folda yako ya au jaribu tena.",
    "forgot.return": "Rudi kwenye Uingizaji",
    "forgot.remember": "Unakumbuka nenosiri lako?",
    "forgot.signin": "Ingia kwenye akaunti yako",

    // Accessibility
    "a11y.title": "Mipangilio ya Upatikanaji",
    "a11y.dyslexia": "Fonti ya Wasomaji",
    "a11y.contrast": "Tofauti Kubwa",
    "a11y.large_text": "Maandishi Makubwa",
    "a11y.wide_spacing": "Nafasi Pana",
    "a11y.size": "Ukubwa",
    "a11y.tts": "Maandishi kuwa Sauti",
    "a11y.ready": "Tayari",
    "a11y.speaking": "Inasema...",
    "a11y.done": "Imekamilika",
    "a11y.error": "Hitilafu",
    "a11y.paused": "Imesimamishwa",
    "a11y.stopped": "Imesimama",

    // Password strength
    "strength.weak": "Dhaifu",
    "strength.fair": "Wastani",
    "strength.good": "Nzuri",
    "strength.strong": "Imara",
    "strength.very_strong": "Imara Sana",

    // Validation errors
    "error.fullname_required": "Jina kamili linahitajika.",
    "error.email_required": "Barua pepe inahitajika.",
    "error.email_invalid": "Tafadhali weka barua pepe sahihi.",
    "error.phone_invalid": "Tafadhali weka nambari ya simu sahihi.",
    "error.password_required": "Nenosiri linahitajika.",
    "error.password_min8": "Nenosiri lazima liwe na herufi 8 au zaidi.",
    "error.password_strong": "Tafadhali chagua nenosiri dhabihu.",
    "error.password_mismatch": "Nenosiri hazifanani.",
    "error.terms_required": "Lazima ukubali Masharti ya Huduma na Sera ya Faragha.",
    "error.server": "Haiwezi kufikia seva. Tafadhali jaribu tena baadaye.",
    "error.phone_required": "Nambari ya simu inahitajika.",
    "error.phone_format": "Tafadhali weka nambari ya simu sahihi (herufi 10-15).",
    "error.something_wrong": "Kuna kitu kimeenda vibaya.",

    // Misc
    "skip.main_content": "Ruka hadi maandishi makuu",
    "skip.login_form": "Ruka hadi fomu ya kuingia",
    "skip.register_form": "Ruka hadi fomu ya usajili",
    "skip.forgot_form": "Ruka hadi fomu ya kusahau nenosiri",
  };

  // ── Init ──────────────────────────────────────────────────────────────

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || "en";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "sw" ? "sw" : "en";
    applyTranslations(lang);
    updateToggleButtons(lang);
  }

  function t(key) {
    var lang = getLang();
    if (lang === "sw" && SW[key]) return SW[key];
    // Fallback: return the element's original English text (stored as data-i18n-en)
    return null;
  }

  // ── Apply translations ────────────────────────────────────────────────

  function applyTranslations(lang) {
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute("data-i18n");

      // Store original English text on first run
      if (!el.getAttribute("data-i18n-en")) {
        el.setAttribute("data-i18n-en", el.textContent);
      }

      if (lang === "sw" && SW[key]) {
        el.textContent = SW[key];
      } else {
        // Restore English
        var en = el.getAttribute("data-i18n-en");
        if (en) el.textContent = en;
      }
    }

    // HTML content (data-i18n-html)
    var htmlEls = document.querySelectorAll("[data-i18n-html]");
    for (var ih = 0; ih < htmlEls.length; ih++) {
      var htmlEl = htmlEls[ih];
      var htmlKey = htmlEl.getAttribute("data-i18n-html");
      if (!htmlEl.getAttribute("data-i18n-html-en")) {
        htmlEl.setAttribute("data-i18n-html-en", htmlEl.innerHTML);
      }
      if (lang === "sw" && SW[htmlKey]) {
        htmlEl.innerHTML = SW[htmlKey];
      } else {
        var htmlEn = htmlEl.getAttribute("data-i18n-html-en");
        if (htmlEn) htmlEl.innerHTML = htmlEn;
      }
    }

    // Placeholders
    var phEls = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phEls.length; j++) {
      var phEl = phEls[j];
      var phKey = phEl.getAttribute("data-i18n-ph");
      if (!phEl.getAttribute("data-i18n-ph-en")) {
        phEl.setAttribute("data-i18n-ph-en", phEl.placeholder || "");
      }
      if (lang === "sw" && SW[phKey]) {
        phEl.placeholder = SW[phKey];
      } else {
        var phEn = phEl.getAttribute("data-i18n-ph-en");
        if (phEn !== null) phEl.placeholder = phEn;
      }
    }

    // aria-labels
    var ariaEls = document.querySelectorAll("[data-i18n-aria]");
    for (var k = 0; k < ariaEls.length; k++) {
      var ariaEl = ariaEls[k];
      var ariaKey = ariaEl.getAttribute("data-i18n-aria");
      if (!ariaEl.getAttribute("data-i18n-aria-en")) {
        ariaEl.setAttribute("data-i18n-aria-en", ariaEl.getAttribute("aria-label") || "");
      }
      if (lang === "sw" && SW[ariaKey]) {
        ariaEl.setAttribute("aria-label", SW[ariaKey]);
      } else {
        var ariaEn = ariaEl.getAttribute("data-i18n-aria-en");
        if (ariaEn) ariaEl.setAttribute("aria-label", ariaEn);
      }
    }
  }

  // ── Toggle buttons ────────────────────────────────────────────────────

  function updateToggleButtons(lang) {
    var btns = document.querySelectorAll("[data-lang-toggle]");
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (lang === "sw") {
        btn.textContent = "EN";
        btn.title = "Switch to English";
        btn.setAttribute("aria-label", "Switch to English");
      } else {
        btn.textContent = "SW";
        btn.title="Badilisha Kiswahili";
        btn.setAttribute("aria-label", "Badilisha Kiswahili");
      }
    }
  }

  function toggleLang() {
    var current = getLang();
    setLang(current === "en" ? "sw" : "en");
  }

  // ── Expose globals ────────────────────────────────────────────────────
  window.CasuyaI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    toggle: toggleLang,
    apply: function () {
      applyTranslations(getLang());
      updateToggleButtons(getLang());
    },
  };

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    var lang = getLang();
    document.documentElement.lang = lang === "sw" ? "sw" : "en";
    applyTranslations(lang);
    updateToggleButtons(lang);

    // Bind all toggle buttons
    var btns = document.querySelectorAll("[data-lang-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", toggleLang);
    }
  }

  // Run immediately if DOM is already ready (script loaded late), otherwise wait.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

;
// Single source of truth for which capabilities the Casuya platform actually
// exposes. The homepage renders from this so a feature is only shown when the
// system genuinely provides it — no marketing claims for un-wired features.
//
// `enabled: true` means a corresponding backend router/endpoint exists.
// `aiAssistant` is enabled — the AI service is available and mounted.

const FEATURES = {
  interactiveLessons: {
    enabled: true,
    icon: "📚",
    title: "Interactive Lessons",
    blurb: "Lessons that feel more like a game — quizzes and activities that mark themselves as you go. You can re-read a topic until it truly sticks.",
    hero: true,
    trusted: false,
  },
  offlineLearning: {
    enabled: true,
    icon: "📶",
    title: "Offline Learning",
    blurb: "Power cut? Long daladala ride? Download a topic once when the network is good, then study it anywhere — even where the signal never reaches.",
    hero: true,
    trusted: true,
  },
  aiAssistant: {
    enabled: true,
    icon: "🤖",
    title: "AI Teacher Assistant",
    blurb: "Preparing a quiz late at night? Ask Casuya to draft it in minutes — in English or Kiswahili. A second pair of hands for busy teachers.",
    hero: true,
    trusted: false,
  },
  analytics: {
    enabled: true,
    icon: "📊",
    title: "Progress You Can See",
    blurb: "At a glance, see which topic the class is struggling with — no digging through stacks of marked papers at the end of term.",
    hero: true,
    trusted: false,
  },
  assessments: {
    enabled: true,
    icon: "📝",
    title: "Assessments",
    blurb: "Set quizzes, questionnaires and modular assignments in a couple of minutes — built to fit how lessons actually run in class.",
    hero: false,
    trusted: false,
  },
  cloudSync: {
    enabled: true,
    icon: "☁️",
    title: "Cloud Sync",
    blurb: "Your marks and progress are kept safe, and sync the moment a connection appears. Nothing is lost when the phone restarts.",
    hero: false,
    trusted: true,
  },
  digitalExaminations: {
    enabled: true,
    icon: "🧪",
    title: "Digital Examinations",
    blurb: "Run secure, browser-based exams that grade themselves and keep results safe — with automatic marking and instant, honest results.",
    hero: false,
    trusted: true,
  },
  aiLessonCreation: {
    enabled: true,
    icon: "✨",
    title: "AI Lesson Creation",
    blurb: "Generate lesson outlines, quizzes and study materials in minutes — a steady helper when the school day has already been long.",
    hero: false,
    trusted: true,
  },
};

// Personas shown in the "Tailored Experiences" section. Parents/Schools are
// served through the student/teacher experience, not separate account roles.
const PERSONAS = [
  { icon: "👨‍🏫", title: "Teachers", points: ["Create rich digital content", "Coordinate modular cohorts", "Evaluate metrics streams"] },
  { icon: "👩‍🎓", title: "Students", points: ["Study from any location", "Interact with tests offline", "Monitor learning records"] },
  { icon: "👨‍👩‍👧", title: "Parents", points: ["Observe progress trackers", "View localized updates"] },
  { icon: "🏫", title: "Schools", points: ["Optimize staff delegation", "Export complex analytical datasets"] },
];

function enabledFeatures() {
  return Object.values(FEATURES).filter((f) => f.enabled);
}

;
// Shared auth UI helpers for the marketing/auth pages (index, login, register).
// Single source of truth so the entry-point experience never contradicts
// the role-based portals (which live under /admin, /teacher, /student and
// enforce their own guards).

const PORTAL_LABELS = {
  admin: "Admin Dashboard",
  teacher: "Teacher Portal",
  student: "Student Portal",
};

function decodeTokenRole(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

function isAuthenticated() {
  const auth = getStoredAuth();
  if (!auth.accessToken || !auth.role) return false;
  return decodeTokenRole(auth.accessToken) !== null;
}

// If the visitor is already signed in, send them straight to their portal.
// Used by login/register so an authenticated user never sees the auth form.
function redirectIfAuthed() {
  const auth = getStoredAuth();
  if (auth.accessToken && auth.role) {
    const decodedRole = decodeTokenRole(auth.accessToken);
    if (decodedRole) {
      window.location.replace(getPortalPath(decodedRole));
      return true;
    }
    clearAuth();
  }
  return false;
}

// Render auth-aware navigation buttons into the given container element.
// When signed in: a "Dashboard" button (role-specific) + "Log out".
// When signed out: "Login" + "Get Started".
function applyAuthChrome(container) {
  if (!container) return;
  const auth = getStoredAuth();
  if (auth.accessToken && auth.role) {
    const label = PORTAL_LABELS[auth.role] || "Dashboard";
    container.innerHTML = `
      <a href="${getPortalPath(auth.role)}" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">${label}</a>
      <button type="button" id="auth-logout-btn" class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-slate-100 transition-all hover:-translate-y-0.5">Log out</button>
    `;
    container.querySelector("#auth-logout-btn")?.addEventListener("click", () => {
      clearAuth();
      window.location.replace("/index.html#features");
    });
  } else {
    container.innerHTML = `
      <a href="/login.html" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">Login</a>
      <a href="/register.html" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 transition-all hover:-translate-y-0.5">Get Started</a>
    `;
  }
}

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

  const response = await fetch(buildApiUrl("/auth/refresh", "POST"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

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
      if (!state.tts && window.speechSynthesis) window.speechSynthesis.cancel();
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

  // Voice selection — prefer East African English
  function findVoice() {
    var voices = window.speechSynthesis.getVoices();
    var preferred = ['en-TZ', 'en-KE', 'en-UG', 'en-GH', 'en-ZA', 'en-GB', 'en-US'];
    for (var i = 0; i < preferred.length; i++) {
      var match = voices.filter(function (v) { return v.lang === preferred[i]; });
      if (match.length) return match[0];
    }
    for (var j = 0; j < voices.length; j++) {
      if (voices[j].lang.indexOf('en') === 0) return voices[j];
    }
    return null;
  }

  function getSelectedText() {
    var sel = window.getSelection();
    if (sel && sel.toString().trim()) return sel.toString().trim();
    return document.body.textContent.substring(0, 2000);
  }

  function speak(text) {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var voice = findVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-TZ'; }
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
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        speak(getSelectedText());
      }
    });
  }
  if (speechPause) {
    speechPause.addEventListener('click', function () {
      window.speechSynthesis.pause();
    });
  }
  if (speechStop) {
    speechStop.addEventListener('click', function () {
      window.speechSynthesis.cancel();
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
// modules/student-dashboard.js — extracted from main.js (classic script, shared global scope)
  // Holds the lessons currently shown in a subtopic so we can prefetch the
  // next one's content while the student reads the current lesson (P1-6).
  let _subtopicLessonList = [];

  async function renderStudentDashboard() {
  // Apply stored accessibility preferences (special needs / neurodivergent).
  try {
    var _a11yPrefs = JSON.parse(localStorage.getItem("casuya_accessibility_prefs") || "null");
    if (_a11yPrefs) {
      if (_a11yPrefs.pref_dyslexia) document.body.classList.add("dyslexia-mode");
      if (_a11yPrefs.pref_high_contrast) document.body.classList.add("high-contrast");
      if (_a11yPrefs.pref_larger_text) document.body.style.fontSize = "1.15em";
      if (_a11yPrefs.pref_tts) { document.body.setAttribute("data-tts-enabled", "true"); }
    }
  } catch (e) {}

  const token = localStorage.getItem("casuya_token");
  const payload = decodeToken(token);
  const _navStack = [];

  function goBack() {
    if (_navStack.length > 0) {
      const prev = _navStack.pop();
      prev();
    } else {
      loadStudentOverview();
    }
  }

  render("#app", `
    <div class="sidebar-layout">
      <aside id="student-sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2>Casuya</h2>
          <p>${escapeHtml(payload.full_name || payload.email || "Student")}</p>
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

  // Inject sidebar styles (duplicate prevention)
  if (!document.getElementById("sidebar-styles")) {
    const style = document.createElement("style");
    style.id = "sidebar-styles";
    style.textContent = `@media(max-width:1024px){.sidebar{position:fixed;z-index:200;left:-260px;transition:left .25s ease;height:100vh}.sidebar.open{left:0;box-shadow:4px 0 20px rgba(0,0,0,.15)}.sidebar-toggle-btn{display:block!important}}`;
    document.head.appendChild(style);
  }

  // Sidebar toggle (mobile)
  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("student-sidebar").classList.toggle("open");
  }, { signal: _globalAbort.signal });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#student-sidebar") && !e.target.closest("#sidebar-toggle")) {
      document.getElementById("student-sidebar")?.classList.remove("open");
    }
  }, { signal: _globalAbort.signal });

  // Form filter (persisted). Pre-select the student's own form level when known.
  const formFilterEl = document.getElementById("form-filter");
  const savedFormFilter = localStorage.getItem("casuya_form_filter") || "";
  if (payload.form_level && !savedFormFilter) {
    localStorage.setItem("casuya_form_filter", payload.form_level);
    formFilterEl.value = payload.form_level;
  } else if (savedFormFilter) {
    formFilterEl.value = savedFormFilter;
  }
  formFilterEl.addEventListener("change", (e) => {
    localStorage.setItem("casuya_form_filter", e.target.value);
    loadStudentSubjects();
  });

  // Search functionality
  const searchInput = document.getElementById("student-search");
  const searchResults = document.getElementById("student-search-results");
  let searchTimer;
  let searchSeq = 0;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.style.display = "none"; return; }
    const mySeq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
        if (mySeq !== searchSeq) return; // stale response, discard
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
              if (el.dataset.type === "lesson") viewStudentLesson(el.dataset.id);
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

  // Notifications
  const notifBell = document.getElementById("notif-bell");
  const notifDropdown = document.getElementById("notif-dropdown");
  const notifBadge = document.getElementById("notif-badge");
  let notifData = [];

  async function loadNotifs() {
    try {
      notifData = await request("/notifications");
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

  // Profile dropdown
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
    showStudentProfileEditor();
  });

  // Navigation
  function setActiveNav(viewId) {
    document.querySelectorAll("#student-nav .sidebar-nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  function showStudentView(content) {
    const el = document.getElementById("student-content");
    if (el) el.innerHTML = content;
  }

  const navHandlers = {
    dashboard: () => { setActiveNav("dashboard"); loadStudentOverview(); },
    class: () => { setActiveNav("class"); loadStudentClass(); },
    subjects: () => { setActiveNav("subjects"); loadStudentSubjects(); },
    progress: () => { setActiveNav("progress"); loadStudentProgress(); },
    bookmarks: () => { setActiveNav("bookmarks"); loadStudentBookmarks(); },
    assignments: () => { setActiveNav("assignments"); loadStudentAssignments(); },
    games: () => { setActiveNav("games"); loadStudentGames(); },
    downloads: () => { setActiveNav("downloads"); loadStudentDownloads(); },
    library: () => { setActiveNav("library"); loadStudentLibrary(); },
    exams: () => { setActiveNav("exams"); loadStudentExams(); },
    files: () => { setActiveNav("files"); loadStudentFiles(); },
    payments: () => { setActiveNav("payments"); loadStudentPayments(); },
    notifications: () => { setActiveNav("notifications"); loadStudentNotifications(); },
    settings: () => { setActiveNav("settings"); loadStudentSettings(); },
  };

  function navigateTo(view) {
    if (navHandlers[view]) {
      location.hash = view;
      navHandlers[view]();
    }
  }

  document.querySelectorAll("#student-nav .sidebar-nav-item").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("student-sidebar")?.classList.remove("open");
      navigateTo(el.dataset.view);
    });
  });

  (async function applyModuleVisibility() {
    try {
      var vis = await request("/settings/modules/my");
      if (!vis || typeof vis !== "object") return;
      var items = document.querySelectorAll("#student-nav .sidebar-nav-item");
      var firstEnabled = null;
      items.forEach(function(el) {
        var view = el.getAttribute("data-view");
        if (vis[view] === false) {
          el.style.display = "none";
        } else if (!firstEnabled) {
          firstEnabled = view;
        }
      });
      var currentHash = location.hash.slice(1) || "dashboard";
      if (vis[currentHash] === false && firstEnabled) {
        navigateTo(firstEnabled);
      }
    } catch(e) {}
  })();

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "dashboard";
    if (navHandlers[view]) navHandlers[view]();
  });

  async function loadStudentClass() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const res = await request("/classrooms/me?_t=" + Date.now()).catch(() => null);
      const classroom = res?.classroom || null;
      const teacher = res?.teacher || null;

      showStudentView(`
        <div class="content" style="max-width:720px">
          <h2>My Class</h2>

          ${classroom ? `
            <div class="card" style="margin:1rem 0;padding:1.5rem;background:linear-gradient(135deg,#eff6ff,#ede9fe);border:1px solid #dbeafe;text-align:center">
              <div style="font-size:2rem">🎓</div>
              <h3 style="margin:0.5rem 0 0.25rem">You're connected!</h3>
              <p style="margin:0 0 0.5rem;color:var(--color-text-muted);font-size:0.9rem">
                ${teacher?.name ? "Your teacher: <b>" + escapeHtml(teacher.name) + "</b>" : "Connected to your teacher's class."}
              </p>
              <div style="font-size:0.75rem;color:var(--color-text-muted);margin:0.5rem 0 0.25rem">Class Code</div>
              <div style="font-family:monospace;font-weight:800;letter-spacing:0.3em;font-size:1.6rem;color:#1e40af">${escapeHtml(classroom.code)}</div>
              <button class="btn btn-danger" id="leave-class" style="margin-top:1rem">Leave Class</button>
            </div>
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
      showStudentView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  // Load dashboard overview
  async function loadStudentOverview() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading dashboard...</p></div>');
    try {
      const [subjects, profile, classRes] = await Promise.all([
        request("/subjects"),
        request("/students/me").catch(() => null),
        request("/classrooms/me").catch(() => null),
      ]);

      const isConnected = !!(classRes && classRes.classroom);
      const classTeacher = classRes?.teacher?.name || "";

      const name = profile?.full_name || payload.full_name || payload.email || "Student";
      const formLevel = profile?.form_level || "";

      // Build subject list with icon colors
      const subjectList = Array.isArray(subjects) ? subjects : [];
      const iconColors = [
        { bg: "#eff6ff", color: "#2563eb", emoji: "📚" },
        { bg: "#f0fdf4", color: "#16a34a", emoji: "🧬" },
        { bg: "#fef3c7", color: "#d97706", emoji: "📐" },
        { bg: "#fce7f3", color: "#db2777", emoji: "🧪" },
        { bg: "#ede9fe", color: "#7c3aed", emoji: "🌍" },
        { bg: "#e0f2fe", color: "#0284c7", emoji: "💻" },
      ];

      // Fetch progress data + server-side stats in parallel
      let progressData = [];
      let totalCompleted = 0;
      let avgScore = 0;
      let streak = 0;
      let recent = [];
      let lessonsViewed = 0;
      try {
        if (profile?.id) {
          const [progressResult, statsResult] = await Promise.all([
            request(`/progress/${profile.id}`).catch(() => []),
            request(`/progress/${profile.id}/stats`).catch(() => null),
          ]);

          progressData = Array.isArray(progressResult) ? progressResult : [];
          if (progressData.length > 0) {
            totalCompleted = progressData.filter(p => p.completion_percentage >= 100).length;
            const scores = progressData.filter(p => p.score_percentage != null && p.score_percentage > 0);
            if (scores.length > 0) {
              avgScore = Math.round(scores.reduce((sum, p) => sum + p.score_percentage, 0) / scores.length);
            }
          }

          // Server-side stats override localStorage values
          if (statsResult) {
            streak = statsResult.streak || 0;
            lessonsViewed = statsResult.lessonsViewed || 0;
            recent = Array.isArray(statsResult.recent) ? statsResult.recent : [];
            if (statsResult.avgScore != null) avgScore = statsResult.avgScore;
          }
        }
      } catch(e) {}

      // Fallback: if server stats unavailable, use localStorage (legacy)
      if (recent.length === 0) {
        try { recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]"); } catch(e) {}
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

      // Get greeting based on time
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      showStudentView(`
        <div class="content" style="max-width:960px">
          <!-- Welcome Banner -->
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}${formLevel ? " — " + escapeHtml(formLevel) : ""}</h2>
            <p>Ready to continue your learning journey?</p>
          </div>

          <!-- Class connection status -->
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

          <!-- Stats -->
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

          <!-- Continue Learning -->
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

          <!-- My Subjects -->
          <div class="section-header">
            <h3>My Subjects</h3>
            <button class="btn btn-sm" id="browse-all-subjects">Browse All</button>
          </div>
          ${subjectList.length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No subjects available yet</p></div>'
            : `<div class="subject-card-grid">
                ${subjectList.map((s, i) => {
                  const ic = iconColors[i % iconColors.length];
                  // Calculate progress for this subject
                  const subjProgress = progressData.filter(p => p.subject_name === s.name);
                  const completedCount = subjProgress.filter(p => p.completion_percentage >= 100).length;
                  const totalCount = subjProgress.length;
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

      // Wire up subject clicks
      document.querySelectorAll(".subject-card-enhanced").forEach(card => {
        card.addEventListener("click", () => loadSubjectTopics(card.dataset.id));
      });

      // Wire up recent lesson clicks
      document.querySelectorAll(".recent-lesson-card").forEach(card => {
        card.addEventListener("click", () => viewStudentLesson(card.dataset.id));
      });

      // Wire up "Browse All" to subjects view
      document.getElementById("browse-all-subjects")?.addEventListener("click", () => {
        setActiveNav("subjects");
        loadStudentSubjects();
      });

      // Wire up "View All" to show more recent
      document.getElementById("view-all-recent")?.addEventListener("click", () => {
        setActiveNav("subjects");
        loadStudentSubjects();
      });

      document.getElementById("ov-view-class")?.addEventListener("click", () => {
        setActiveNav("class");
        loadStudentClass();
      });
      document.getElementById("ov-connect-class")?.addEventListener("click", () => {
        setActiveNav("class");
        loadStudentClass();
      });

    } catch(e) {
      showStudentView('<div class="empty-state"><p>Error loading dashboard</p></div>');
    }
  }

  // Load subjects
  async function loadStudentSubjects() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const filtered = Array.isArray(subjects) ? subjects : [];
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No subjects found</p></div>');
        return;
      }
      showStudentView(`
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
        card.addEventListener("click", () => loadSubjectTopics(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading subjects</p></div>'); }
  }

  async function loadSubjectTopics(subjectId) {
    _navStack.push(() => loadStudentSubjects());
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      // Server-side filter by subject (don't pull the whole topic catalog on 2G/3G).
      const topics = await request("/topics?subject_id=" + encodeURIComponent(subjectId));
      const formFilter = localStorage.getItem("casuya_form_filter") || "";
      let filtered = Array.isArray(topics) ? topics : [];
      if (formFilter) {
        const ff = formFilter.replace(/^Form /, "");
        // Only FILTER when a form is explicitly chosen, and never hide topics that
        // have no form_level set (they apply to everyone). This prevents published
        // lessons from disappearing just because a topic's form_level doesn't match.
        filtered = filtered.filter(t => !t.form_level || t.form_level === formFilter || t.form_level.replace(/^Form /, "") === ff);
      }
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No topics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", goBack);
        return;
      }
      showStudentView(`
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
      document.getElementById("back-btn").addEventListener("click", goBack);
      document.querySelectorAll(".topic-card").forEach(card => {
        card.addEventListener("click", () => loadTopicSubtopics(card.dataset.id, subjectId));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading topics</p></div>'); }
  }

  async function loadTopicSubtopics(topicId, subjectId) {
    _navStack.push(() => loadSubjectTopics(subjectId));
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      // Server-side filter by topic (don't pull the whole subtopic catalog on 2G/3G).
      const subtopics = await request("/subtopics?topic_id=" + encodeURIComponent(topicId));
      const filtered = Array.isArray(subtopics) ? subtopics : [];
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No subtopics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", goBack);
        return;
      }
      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Subtopics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(s => `
            <div class="card subtopic-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.title)}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", goBack);
      document.querySelectorAll(".subtopic-card").forEach(card => {
        card.addEventListener("click", () => loadSubtopicLessons(card.dataset.id, topicId, subjectId));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading subtopics</p></div>'); }
  }

  async function loadSubtopicLessons(subtopicId, topicId, subjectId) {
    _navStack.push(() => loadTopicSubtopics(topicId, subjectId));
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      // Server-side filter by subtopic + published status (only this branch is fetched).
      const lessons = await request("/lessons/?subtopic_id=" + encodeURIComponent(subtopicId) + "&status=published");
      const filtered = Array.isArray(lessons) ? lessons : [];
      _subtopicLessonList = filtered;
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No lessons found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", goBack);
        return;
      }
      showStudentView(`
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
      document.getElementById("back-btn").addEventListener("click", goBack);
      document.querySelectorAll(".lesson-card").forEach(card => {
        card.addEventListener("click", () => viewStudentLesson(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  // Progress
  async function loadStudentProgress() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading progress...</p></div>');
    try {
      // Get student ID from profile
      const profile = await request("/students/me");
      const studentId = profile?.id;
      if (!studentId) {
        showStudentView('<div class="empty-state"><p>Could not load profile</p></div>');
        return;
      }
      const data = await request(`/progress/${studentId}`);
      const progress = Array.isArray(data) ? data : [];
      if (progress.length === 0) {
        showStudentView('<div class="empty-state"><p>No progress recorded yet</p></div>');
        return;
      }
      const bySubject = {};
      progress.forEach(p => {
        const subj = p.subject_name || "General";
        if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
        bySubject[subj].total++;
        if (p.completion_percentage >= 100) bySubject[subj].completed++;
      });
      showStudentView(`
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
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading progress</p></div>'); }
  }

  // Bookmarks
  async function loadStudentBookmarks() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading bookmarks...</p></div>');
    try {
      const data = await request("/bookmarks/");
      const bookmarks = Array.isArray(data) ? data : [];
      if (bookmarks.length === 0) {
        showStudentView('<div class="empty-state"><p>No bookmarks yet</p></div>');
        return;
      }
      showStudentView(`
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
        card.addEventListener("click", () => viewStudentLesson(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading bookmarks</p></div>'); }
  }

  // Assignments
  async function loadStudentAssignments() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading assignments...</p></div>');
    try {
      const assignments = await request("/assignments");
      const assignmentList = Array.isArray(assignments) ? assignments : [];
      showStudentView(`
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
        card.addEventListener("click", () => openStudentAssignment(card.dataset.openAssignment));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading assignments</p></div>'); }
  }

  async function openStudentAssignment(assignmentId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading assignment...</p></div>');
    try {
      const assignment = await request(`/assignments/${assignmentId}`);
      const lessonId = assignment.lesson_id;
      let studentId = null;
      try {
        const me = await request("/students/me");
        studentId = me && (me.id || me.user_id);
      } catch(e) {}
      showStudentView(`
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
      document.getElementById("back-btn").addEventListener("click", loadStudentAssignments);
      document.getElementById("submit-assignment-btn").addEventListener("click", async () => {
        const bbEl = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
        const bb = bbEl && bbEl._casuyaBlackboard;
        if (!bb) { showToast("Blackboard not loaded"); return; }
        const btn = document.getElementById("submit-assignment-btn");
        btn.disabled = true; btn.textContent = "Submitting...";
        try {
          // Collect blackboard elements
          const elements = bb.getElements ? bb.getElements() : [];
          // Collect MCQ radio answers
          const mcqAnswers = {};
          document.querySelectorAll('.exam-paper input[type="radio"]:checked').forEach(radio => {
            const name = radio.getAttribute("name");
            const qNum = name ? name.replace(/^.*-/, "") : null;
            if (qNum) mcqAnswers[qNum] = parseInt(radio.value);
          });
          // Collect structured/essay textarea answers
          const structuredAnswers = {};
          document.querySelectorAll('.exam-structured-answer').forEach(ta => {
            const qNum = ta.getAttribute("data-question");
            const text = ta.value.trim();
            if (qNum && text) structuredAnswers[qNum] = text;
          });
          // Combine into a single submission object
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
          document.getElementById("back-to-assignments").addEventListener("click", loadStudentAssignments);
        } catch(err) {
          btn.disabled = false; btn.textContent = "Submit Work";
          document.getElementById("assignment-result").innerHTML = `<p style="color:var(--color-danger)">Failed to submit: ${escapeHtml(err.message)}</p>`;
        }
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading assignment</p></div>'); }
  }

  // Games
  async function loadStudentGames() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games");
      const gameList = Array.isArray(games?.items) ? games.items : [];

      // Recently viewed from localStorage
      let recent = [];
      try { recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]"); } catch(e) {}

      if (gameList.length === 0 && recent.length === 0) {
        showStudentView(`
          <h2>Games</h2>
          <div class="empty-state" style="margin-top:1rem">
            <p>No games available yet.</p>
            <p style="color:var(--color-text-muted);font-size:0.85rem">Games are added by your teacher and appear inside lessons.</p>
            <button class="btn btn-primary" id="browse-lessons-btn" style="margin-top:1rem">Browse Lessons</button>
          </div>
        `);
        document.getElementById("browse-lessons-btn")?.addEventListener("click", () => {
          setActiveNav("subjects");
          loadStudentSubjects();
        });
        return;
      }

      showStudentView(`
        <h2>Games</h2>
        ${gameList.length > 0 ? `
          <div class="card-grid" style="margin-top:1rem">
            ${gameList.map(g => `
              <div class="card game-card" data-id="${escapeHtml(g.id)}" style="cursor:pointer;position:relative">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                  <span style="font-size:1.5rem">🎮</span>
                  <h3 style="margin:0">${escapeHtml(g.title || "Untitled Game")}</h3>
                </div>
                <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(g.lesson_title || "Standalone game")}</p>
                <span style="display:inline-block;margin-top:0.5rem;font-size:0.75rem;padding:0.2rem 0.6rem;background:var(--color-bg);border-radius:var(--radius);color:var(--color-text-muted)">${escapeHtml(g.status || "active")}</span>
              </div>
            `).join("")}
          </div>
        ` : `
          <div class="empty-state" style="padding:2rem">
            <p>No standalone games found.</p>
          </div>
        `}
      `);

      document.querySelectorAll(".game-card").forEach(card => {
        card.addEventListener("click", () => viewStudentGame(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading games</p></div>'); }
  }

  // View a single game
  async function viewStudentGame(gameId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>');
    try {
      const game = await request(`/games/${gameId}`);
      const contentResp = await fetch(`${API_BASE}/games/${gameId}/content`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      }).then(r => r.ok ? r.text() : "").catch(() => "");

      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(game.title || "Game")}</h2>
        </div>
        <div style="width:100%">
          <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
        </div>
        <div class="card" style="margin-top:0.75rem;padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Scratch Pad</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out problems here while you play.</p>
          <div data-blackboard data-lesson-id="game-${gameId}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
      `);

      const iframe = document.querySelector("#student-content .lesson-iframe");
      if (iframe && contentResp) {
        iframe.srcdoc = injectNodeBase(contentResp);
        let heightSet = false;
        const setHeight = () => {
          if (heightSet) return;
          try {
            const doc = iframe.contentWindow?.document;
            if (doc) {
              iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
              heightSet = true;
            }
          } catch(e) {}
        };
        iframe.addEventListener("load", setHeight);
        const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
        setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "600px"; }, 8000);
      } else if (iframe) {
        iframe.style.height = "400px";
        iframe.srcdoc = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-family:sans-serif"><p>Game content not available</p></div>';
      }

      document.getElementById("back-btn").addEventListener("click", goBack);
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading game</p><button class="btn" id="back-btn">← Back</button></div>'); document.getElementById("back-btn")?.addEventListener("click", goBack); }
  }

  // Profile editor
  async function showStudentProfileEditor() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading profile...</p></div>');
    try {
      const profile = await request("/students/me");
      showStudentView(`
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
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading profile</p></div>'); }
  }

  // View lesson content
  // P1-6 — warm the service worker / CDN cache with the next lesson's content
  // while the student is reading the current one, so "next" opens instantly.
  function _prefetchNextLesson(lessonId) {
    const idx = _subtopicLessonList.findIndex((l) => l.id === lessonId);
    if (idx < 0 || idx + 1 >= _subtopicLessonList.length) return;
    const next = _subtopicLessonList[idx + 1];
    fetch(`${API_BASE}/lessons/${next.id}/content`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
    }).catch(() => {});
  }

  async function viewStudentLesson(lessonId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      let lesson, isBookmarked, noteData, quizData, gamesData, lessonContent;
      try {
        // P2-3 — fetch package + content in parallel instead of sequentially
        const contentFetch = fetch(`${API_BASE}/lessons/${lessonId}/content`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
        }).then(r => r.ok ? r.text() : "").catch(() => "");

        const pkg = await request(`/lessons/${lessonId}/package`);
        lesson = pkg.lesson;
        isBookmarked = pkg.bookmark_status?.bookmarked || false;
        noteData = pkg.note || { content: "" };
        quizData = pkg.quiz;
        gamesData = pkg.games || [];

        lessonContent = (await contentFetch) || "<p>No content</p>";
      } catch(e) {
        const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
        const filtered = recent.filter(r => r.id !== lessonId);
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        showStudentView('<div class="empty-state"><p>This lesson is no longer available.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>');
        document.getElementById("back-to-overview")?.addEventListener("click", loadStudentOverview);
        return;
      }

      // Track recently viewed (localStorage + server-side)
      const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      const exists = recent.findIndex(r => r.id === lessonId);
      if (exists >= 0) recent.splice(exists, 1);
      recent.unshift({ id: lessonId, title: lesson.title, viewedAt: Date.now() });
      if (recent.length > 20) recent.length = 20;
      localStorage.setItem("casuya_recently_viewed", JSON.stringify(recent));
      // Fire-and-forget: record activity server-side for streak/stats
      request("/progress/activity", {
        method: "POST",
        body: JSON.stringify({ student_id: payload.id || payload.sub, lesson_id: lessonId, lesson_title: lesson.title }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
      _prefetchNextLesson(lessonId);

      const renderStudentQuiz = () => {
        if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
        return `
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.75rem">${escapeHtml(quizData.title || "Quiz")}</h3>
            <form id="quiz-form">
              ${quizData.questions.map((q, qi) => `
                <div style="margin-bottom:1rem">
                  <p style="font-weight:600;margin:0 0 0.5rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
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
      };

      const renderStudentGames = () => {
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
      };

      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(lesson.title)}</h2>
          <button id="bookmark-btn" class="btn-icon" style="font-size:1.5rem" title="Bookmark">${isBookmarked ? "★" : "☆"}</button>
          <button id="complete-btn" class="btn btn-primary" style="font-size:0.85rem">Mark Complete</button>
        </div>
        <div style="width:100%">
          <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
        </div>
        <div style="margin-top:0.75rem">
          <details>
            <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
            <div class="card" style="margin-top:0.5rem">
              <textarea id="lesson-note" class="input" rows="4" placeholder="Write your notes here...">${escapeHtml(noteData?.content || "")}</textarea>
              <button class="btn btn-primary" id="save-note" style="margin-top:0.5rem">Save Note</button>
            </div>
          </details>
          ${renderStudentQuiz()}
          ${renderStudentGames()}
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
            <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
          </div>
        </div>
      `);

      // Mount blackboard for student lesson
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }

      // Render lesson content in iframe
      const iframe = document.querySelector("#student-content .lesson-iframe");
      if (iframe) {
        iframe.srcdoc = injectNodeBase(lessonContent);
        let heightSet = false;
        const setHeight = () => {
          if (heightSet) return;
          try {
            const doc = iframe.contentWindow?.document;
            if (doc) {
              iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
              heightSet = true;
            }
          } catch(e) {}
        };
        iframe.addEventListener("load", setHeight);
        const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
        setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "800px"; }, 10000);

        // Bridge for quiz scores and progress
        const studentTokenPayload = decodeToken(localStorage.getItem("casuya_token"));
        let studentId = null;
        let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        try {
          const me = await request("/students/me");
          if (me && me.id) studentId = me.id;
        } catch(e) {}
        const onMessage = (e) => {
          if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
            const pct = Math.round((e.data.score / e.data.total) * 100);
            request("/progress/sync", {
              method: "POST",
              body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: pct }),
            }).catch(() => {});
          } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
            request("/progress/sync", {
              method: "POST",
              body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: e.data.percent }),
            }).catch(() => {});
          }
        };
        window.addEventListener("message", onMessage);

        // Sync initial progress (10%) when lesson opens
        if (studentId) {
          request("/progress/sync", {
            method: "POST",
            body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 10, score_percentage: null }),
          }).catch(() => {});
        }

        // Cleanup function for navigation away
        const cleanupLesson = () => {
          window.removeEventListener("message", onMessage);
          clearInterval(poll);
          clearTimeout(poll);
        };
        document.getElementById("back-btn").addEventListener("click", () => { cleanupLesson(); goBack(); });

        // Mark Complete button
        const completeBtn = document.getElementById("complete-btn");
        if (completeBtn && studentId) {
          completeBtn.addEventListener("click", () => {
            request("/progress/sync", {
              method: "POST",
              body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: null }),
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
      } else {
        document.getElementById("back-btn").addEventListener("click", goBack);
      }

      // Bookmark toggle
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

      // Save note
      let noteTimer;
      document.getElementById("save-note").addEventListener("click", async () => {
        clearTimeout(noteTimer);
        const content = document.getElementById("lesson-note").value;
        await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
        showToast("Note saved");
      });

      // Auto-save notes on typing
      document.getElementById("lesson-note").addEventListener("input", () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(async () => {
          const content = document.getElementById("lesson-note").value;
          await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
        }, 2000);
      });

      // Quiz submit — wired to Show your work
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
            });
          }
        } catch(err) {
          const el = document.getElementById("quiz-result");
          el.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`;
          el.style.display = "block";
        }
      });

      // Game items
      document.querySelectorAll(".game-item").forEach(item => {
        item.addEventListener("click", async () => {
          const area = document.getElementById("game-content-area");
          const gid = item.dataset.gameId;
          try {
            const resp = await fetch(`${API_BASE}/games/${gid}/content`, {
              headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
            });
            if (resp.ok) {
              const html = await resp.text();
              area.innerHTML = `
                <iframe style="width:100%;border:none;min-height:300px" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>
                <div style="margin-top:0.75rem">
                  <details>
                    <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">✏️ Scratch Pad</summary>
                    <div data-blackboard data-lesson-id="game-${gid}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
                  </details>
                </div>
              `;
              if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
            }
          } catch(e) {}
        });
      });

    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading lesson.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>'); document.getElementById("back-to-overview")?.addEventListener("click", loadStudentOverview); }
  }

  async function loadStudentDownloads() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading downloads...</p></div>');
    try {
      const lessons = await request("/lessons");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      let cachedIds = [];
      try { cachedIds = JSON.parse(localStorage.getItem("casuya_downloaded_lessons") || "[]"); } catch(e) {}
      const cachedLessons = lessonList.filter(l => cachedIds.includes(l.id));
      const availableLessons = lessonList.filter(l => !cachedIds.includes(l.id));

      showStudentView(`
        <div class="content">
          <h2>Downloads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Save lessons for offline viewing. Cached lessons are stored locally in your browser.</p>
          ${cachedLessons.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Cached Lessons (${cachedLessons.length})</h3>
            <div class="card-grid">
              ${cachedLessons.map(l => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-success);font-size:0.75rem;margin-top:0.25rem">Available offline</p>
                    </div>
                    <button class="btn btn-sm btn-danger" data-remove-download="${l.id}">Remove</button>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ''}
          <h3 style="margin:1.5rem 0 0.75rem">Available Lessons</h3>
          <div class="card-grid">
            ${availableLessons.length === 0 ? '<div class="empty-state"><p>All lessons are cached or none available.</p></div>' :
              availableLessons.map(l => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(l.status)}</p>
                    </div>
                    <button class="btn btn-sm btn-primary" data-download-lesson="${l.id}" data-title="${escapeHtml(l.title)}">Download</button>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("[data-download-lesson]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const lessonId = btn.dataset.downloadLesson;
          const title = btn.dataset.title;
          btn.disabled = true;
          btn.textContent = "Saving...";
          try {
            const contentResp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, {
              headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
            });
            if (contentResp.ok) {
              const html = await contentResp.text();
              const contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}");
              contentCache[lessonId] = { html, title, savedAt: Date.now() };
              localStorage.setItem("casuya_lesson_content_cache", JSON.stringify(contentCache));
              if (!cachedIds.includes(lessonId)) {
                cachedIds.push(lessonId);
                localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(cachedIds));
              }
              showToast("Lesson saved for offline viewing");
              loadStudentDownloads();
            }
          } catch(e) {
            showToast("Failed to save lesson");
            btn.disabled = false;
            btn.textContent = "Download";
          }
        });
      });
      document.querySelectorAll("[data-remove-download]").forEach(btn => {
        btn.addEventListener("click", () => {
          const lessonId = btn.dataset.removeDownload;
          const contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}");
          delete contentCache[lessonId];
          localStorage.setItem("casuya_lesson_content_cache", JSON.stringify(contentCache));
          cachedIds = cachedIds.filter(id => id !== lessonId);
          localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(cachedIds));
          loadStudentDownloads();
        });
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading downloads</p></div>'); }
  }

  // ── Reference Library (student — visible_to_students only) ──────
  async function loadStudentLibrary() {
    const SUBJECTS = [
      { slug: "mathematics", name: "Mathematics" },
      { slug: "biology", name: "Biology" },
      { slug: "chemistry", name: "Chemistry" },
      { slug: "physics", name: "Physics" },
      { slug: "english", name: "English" },
      { slug: "kiswahili", name: "Kiswahili" },
      { slug: "geography", name: "Geography" },
      { slug: "history", name: "History" },
      { slug: "history_civics", name: "Civics" },
      { slug: "computing", name: "Computing & ICT" },
    ];
    let docs = [];
    let total = 0;
    let filters = { doc_type: "", subject_slug: "", form_level: "", query: "" };
    let page = 0;
    const PAGE_SIZE = 20;

    function subjectOpts() {
      return '<option value="">All Subjects</option>' +
        SUBJECTS.map(s => `<option value="${s.slug}">${escapeHtml(s.name)}</option>`).join("");
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
        const res = await request("/reference-docs/student?" + params.toString());
        docs = res.items || [];
        total = res.total || 0;
      } catch (e) { docs = []; total = 0; }
    }

    function renderDocList() {
      const el = document.getElementById("lib-results");
      if (!el) return;
      if (!docs.length) {
        el.innerHTML = '<div class="tdocs-empty"><div class="tdocs-empty-icon">📖</div><p>No reference documents available yet. Your teacher will publish them here.</p></div>';
        return;
      }
      const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
      el.innerHTML = docs.map(d => {
        const typeLabel = d.doc_type === "scheme_of_work" ? "Scheme of Work" : "Lesson Plan";
        const typeCls = d.doc_type === "scheme_of_work" ? "tdocs-status-info" : "tdocs-status-success";
        const form = d.form_level ? "Form " + (ROMAN[d.form_level] || d.form_level) : "";
        return `
          <div class="lib-card" data-lib-view="${d.id}">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem">
              <span class="tdocs-status ${typeCls}">${typeLabel}</span>
              ${form ? `<span class="tdocs-status" style="background:var(--color-bg);color:var(--color-text-muted)">${form}</span>` : ""}
            </div>
            <h4 style="margin:0;font-size:0.88rem;font-weight:600">${escapeHtml(d.title)}</h4>
            <p style="margin:0.2rem 0 0;font-size:0.72rem;color:var(--color-text-muted)">${escapeHtml(d.subject_name || "")}</p>
          </div>`;
      }).join("");
      const totalPages = Math.ceil(total / PAGE_SIZE);
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

    async function viewDoc(id) {
      const el = document.getElementById("lib-viewer");
      if (!el) return;
      el.innerHTML = '<div class="tdocs-loading"><div class="spinner"></div>Loading document...</div>';
      el.style.display = "block";
      try {
        const resp = await fetch("/reference-docs/" + id + "/render");
        const html = await resp.text();
        el.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
            <h4 style="margin:0;font-size:0.9rem;font-weight:700">Reference Document</h4>
            <button class="btn btn-sm btn-outline" id="lib-close-viewer">✕ Close</button>
          </div>
          <iframe srcdoc="${escapeHtml(html).replace(/"/g, '&quot;')}" style="width:100%;min-height:500px;border:1px solid var(--color-border);border-radius:8px;background:#fff"></iframe>`;
        document.getElementById("lib-close-viewer")?.addEventListener("click", () => { el.style.display = "none"; });
      } catch (e) {
        el.innerHTML = '<p style="color:var(--color-danger)">Error loading document.</p>';
      }
    }

    showStudentView(`
      <div class="content">
        <h2 class="tdocs-page-title">Reference Library</h2>
        <p class="tdocs-page-desc">Browse official TIE lesson plans and schemes of work published by your teacher.</p>

        <div style="display:grid;gap:0.6rem;margin-top:1.25rem">
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
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
            </select>
            <input class="input" id="lib-search" type="search" placeholder="Search titles..." style="max-width:220px;padding:0.45rem 0.6rem;font-size:0.85rem">
          </div>
          <div id="lib-results"></div>
          <div id="lib-pagination"></div>
        </div>

        <div id="lib-viewer" style="display:none;margin-top:1.5rem"></div>
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

    document.getElementById("lib-results")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lib-view]");
      if (btn) viewDoc(btn.dataset.libView);
    });
    document.getElementById("lib-pagination")?.addEventListener("click", (e) => {
      if (e.target.id === "lib-prev") { page--; loadDocs().then(renderDocList); }
      if (e.target.id === "lib-next") { page++; loadDocs().then(renderDocList); }
    });

    await loadDocs();
    renderDocList();
  }

  async function loadStudentExams() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading exams...</p></div>');
    try {
      const quizzes = await request("/quizzes");
      const quizList = Array.isArray(quizzes) ? quizzes : [];
      let examHistory = [];
      try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}

      showStudentView(`
        <div class="content">
          <h2>Exams</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Take timed exams. Your progress is saved automatically.</p>
          ${quizList.length === 0 ? '<div class="empty-state" style="margin-top:1rem"><p>No exams available yet.</p></div>' : `
            <div class="card-grid" style="margin-top:1rem">
              ${quizList.map(q => {
                const history = examHistory.filter(h => h.quizId === q.id);
                const bestScore = history.length > 0 ? Math.max(...history.map(h => h.combined_percentage != null ? h.combined_percentage : h.percentage)) : null;
                const bestWork = history.length > 0 ? Math.max(...history.map(h => h.work_percentage ?? 0)) : 0;
                return `
                  <div class="card" style="padding:1rem">
                    <h3 style="margin:0">${escapeHtml(q.title || "Exam")}</h3>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${q.question_count ?? q.questions?.length ?? 0} questions</p>
                    ${bestScore !== null ? `<p style="color:var(--color-success);font-size:0.85rem;margin-top:0.15rem">Best: ${bestScore}%${bestWork ? ` <span style="color:var(--color-text-muted);font-size:0.75rem">(work ${bestWork}%)</span>` : ''}</p>` : ''}
                    <button class="btn btn-primary btn-sm start-exam-btn" data-quiz-id="${q.id}" style="margin-top:0.5rem">Start Exam</button>
                  </div>
                `;
              }).join("")}
            </div>
          `}
          ${examHistory.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Exam History</h3>
            <div class="card" style="padding:1rem">
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
                  <tr style="border-bottom:1px solid var(--color-border)">
                    <th style="padding:0.5rem;text-align:left">Quiz</th>
                    <th style="padding:0.5rem;text-align:left">Score</th>
                    <th style="padding:0.5rem;text-align:left">Date</th>
                  </tr>
                  ${examHistory.slice(-10).reverse().map(h => {
                    const dispPct = h.combined_percentage != null ? h.combined_percentage : h.percentage;
                    const workInfo = h.work_percentage != null ? ` + work ${h.work_score}/${h.work_total}` : '';
                    return `
                    <tr style="border-bottom:1px solid var(--color-border)">
                      <td style="padding:0.5rem">${escapeHtml(h.quizTitle || "Quiz")}</td>
                      <td style="padding:0.5rem;color:${dispPct >= 50 ? 'var(--color-success)' : 'var(--color-danger)'}">${h.score}/${h.total} (${h.percentage}%${workInfo} → <strong>${dispPct}%</strong>)</td>
                      <td style="padding:0.5rem;color:var(--color-text-muted)">${new Date(h.takenAt).toLocaleDateString()}</td>
                    </tr>
                  `}).join("")}
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      `);
      document.querySelectorAll(".start-exam-btn").forEach(btn => {
        btn.addEventListener("click", () => startExam(btn.dataset.quizId));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading exams</p></div>'); }
  }

  async function startExam(quizId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading exam...</p></div>');
    try {
      const quizData = await request(`/quizzes/${quizId}`);
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        showStudentView('<div class="empty-state"><p>No questions in this exam.</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", loadStudentExams);
        return;
      }

      let timeLimit = quizData.time_limit || 30 * 60;
      let timeLeft = timeLimit;
      let examSubmitted = false;

      const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

      showStudentView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding:0.75rem 1rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)">
            <h2 style="margin:0;font-size:1rem">${escapeHtml(quizData.title || "Exam")}</h2>
            <div style="display:flex;align-items:center;gap:1rem">
              <span id="exam-timer" style="font-size:1.1rem;font-weight:700;color:var(--color-primary);font-variant-numeric:tabular-nums">${formatTime(timeLeft)}</span>
              <button class="btn btn-danger btn-sm" id="submit-exam-btn">Submit</button>
            </div>
          </div>
          <form id="exam-form">
            ${quizData.questions.map((q, qi) => `
              <div class="card" style="padding:1rem;margin-bottom:0.75rem">
                <p style="font-weight:600;margin:0 0 0.75rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
                ${q.options.map(o => `
                  <label style="display:block;padding:0.5rem 0.75rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.35rem;transition:background 0.15s">
                    <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required style="margin-right:0.5rem"> ${escapeHtml(o.text)}
                  </label>
                `).join("")}
                <details style="margin-top:0.5rem">
                  <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
                  <div data-blackboard data-lesson-id="exam-${quizId}-${escapeHtml(q.id)}" data-exam-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
                </details>
              </div>
            `).join("")}
          </form>
          <div id="exam-result" style="display:none;margin-top:1rem"></div>
        </div>
      `);

      // Mount blackboards for Show your work (exam)
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      // Add live badge on each Show your work details when work is drawn
      document.querySelectorAll("details").forEach(d => {
        const bbDiv = d.querySelector("[data-blackboard]");
        if (!bbDiv) return;
        const summ = d.querySelector("summary");
        if (!summ) return;
        const baseLabel = summ.textContent.trim();
        bbDiv.addEventListener("casuya:blackboard-ready", () => {});
        // Poll for hasWork to update badge (lightweight)
        const check = () => {
          const bb = bbDiv._casuyaBlackboard;
          const has = bb && bb.getElements && bb.getElements().length > 0;
          summ.textContent = has ? `${baseLabel} — ✅ work captured` : baseLabel;
          summ.style.color = has ? "var(--color-success)" : "var(--color-text-muted)";
          summ.style.fontWeight = has ? "600" : "";
        };
        bbDiv.addEventListener("click", () => setTimeout(check, 100));
        // Hook blackboard change event if available
        const hook = setInterval(() => {
          const bb = bbDiv._casuyaBlackboard;
          if (bb && bb.on) { bb.on("change", check); clearInterval(hook); }
          if (!document.body.contains(bbDiv)) clearInterval(hook);
        }, 500);
        setTimeout(check, 800);
      });

      const timerEl = document.getElementById("exam-timer");
      const timerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = formatTime(timeLeft);
        if (timeLeft <= 0 && !examSubmitted) {
          clearInterval(timerInterval);
          submitExam();
        }
        if (timeLeft <= 60 && timerEl) timerEl.style.color = "var(--color-danger)";
      }, 1000);

      async function submitExam() {
        if (examSubmitted) return;
        examSubmitted = true;
        clearInterval(timerInterval);
        const submitBtn = document.getElementById("submit-exam-btn");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting..."; }
        const answers = {};
        quizData.questions.forEach(q => {
          const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
          if (sel) answers[q.id] = sel.value;
        });
        // Collect Show your work per exam question (data-exam-question)
        let work = null;
        try {
          if (window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.collectWorkMap) {
            work = window.CasuyaBlackboardEmbed.collectWorkMap("[data-exam-question]");
          } else {
            work = {};
            document.querySelectorAll("[data-exam-question]").forEach(el => {
              const qid = el.dataset.examQuestion;
              const bb = el._casuyaBlackboard;
              if (bb && bb.getWorkSnapshot) work[qid] = bb.getWorkSnapshot();
              else if (bb && bb.getElements) { const els = bb.getElements(); work[qid] = { elements: els, hasWork: els.length>0, recognizedLatex: els.length>0?"__drawing__":"" }; }
            });
          }
          if (work && Object.keys(work).length === 0) work = null;
        } catch {}
        try {
          const body = work ? { answers, work } : { answers };
          const result = await request(`/quizzes/${quizId}/submit`, {
            method: "POST", body: JSON.stringify(body),
          });
          // Also attempt step-grading via the dedicated grading engine for richer feedback (best-effort).
          let extraStepFeedback = null;
          if (work && window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.gradeWorkMap) {
            try { extraStepFeedback = await window.CasuyaBlackboardEmbed.gradeWorkMap(work, null); } catch {}
          }
          let examHistory = [];
          try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}
          const finalPct = result.combined_percentage != null ? result.combined_percentage : result.percentage;
          examHistory.push({
            quizId,
            quizTitle: quizData.title,
            score: result.score,
            total: result.total,
            percentage: Math.round(result.percentage),
            work_score: result.work_score,
            work_total: result.work_total,
            work_percentage: result.work_percentage,
            combined_percentage: result.combined_percentage != null ? Math.round(result.combined_percentage) : Math.round(result.percentage),
            timeSpent: timeLimit - timeLeft,
            takenAt: Date.now(),
          });
          localStorage.setItem("casuya_exam_history", JSON.stringify(examHistory));

          const passed = finalPct >= 50;
          const hasWork = result.work_score != null;
          document.getElementById("exam-result").innerHTML = `
            <div class="card" style="padding:1.5rem;text-align:center">
              <h3 style="color:${passed ? 'var(--color-success)' : 'var(--color-danger)'};margin:0 0 0.5rem">Exam ${passed ? 'Passed!' : 'Not Passed'}</h3>
              <p style="font-size:1.5rem;font-weight:700;margin:0.5rem 0">Score: ${result.score}/${result.total} (${Math.round(result.percentage)}%)</p>
              ${hasWork ? `<p style="font-size:0.95rem;margin:0.25rem 0">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · <strong>Combined: ${Math.round(finalPct)}%</strong> <span style="font-size:0.8rem;color:var(--color-text-muted)">(70% answer + 30% work)</span></p>` : ``}
              ${hasWork && result.work_score < result.work_total ? `<p style="font-size:0.8rem;color:var(--color-text-muted)">You left ${result.work_total - result.work_score} "Show your work" board(s) empty.</p>` : ``}
              ${extraStepFeedback && extraStepFeedback.stepResults && extraStepFeedback.stepResults.length ? `<div style="text-align:left;margin-top:0.75rem;font-size:0.85rem">${extraStepFeedback.stepResults.map((s,i)=>`<div style="padding:0.25rem 0;border-bottom:1px solid var(--color-border)"><span style="font-weight:600">Q${i+1} work:</span> ${escapeHtml(s.feedback)} ${s.hasWork ? '✅' : '⬜'}</div>`).join("")}</div>` : ``}
              <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">Time: ${formatTime(timeLimit - timeLeft)}</p>
              <button class="btn btn-primary" id="back-to-exams" style="margin-top:1rem">Back to Exams</button>
            </div>
          `;
          document.getElementById("exam-result").style.display = "block";
          document.getElementById("exam-form").style.display = "none";
          document.getElementById("back-to-exams")?.addEventListener("click", loadStudentExams);
        } catch(err) {
          document.getElementById("exam-result").innerHTML = `<div class="card" style="padding:1rem"><p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p></div>`;
          document.getElementById("exam-result").style.display = "block";
        }
      }

      document.getElementById("submit-exam-btn")?.addEventListener("click", () => {
        if (!examSubmitted && confirm("Submit exam?")) submitExam();
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading exam</p></div>'); }
  }

  async function loadStudentFiles() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading files...</p></div>');
    try {
      const files = await request("/uploads/public").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];
      let activeFilter = "all";

      function renderStudentFiles() {
        let filtered = fileList;
        if (activeFilter !== "all") {
          const ext = { images: "image", documents: "doc", media: "media" }[activeFilter];
          if (ext === "image") filtered = fileList.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.filename || f.path || ""));
          else if (ext === "doc") filtered = fileList.filter(f => /\.(pdf|doc|docx|txt)$/i.test(f.filename || f.path || ""));
          else if (ext === "media") filtered = fileList.filter(f => /\.(mp4|webm|mp3|wav|ogg)$/i.test(f.filename || f.path || ""));
        }
        const grid = document.getElementById("student-files-grid");
        if (!grid) return;
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No files available</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(f => {
          const name = f.filename || f.path || "unknown";
          const displayName = f.display_name || name;
          const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);
          const isVideo = /\.(mp4|webm)$/i.test(name);
          const isAudio = /\.(mp3|wav|ogg)$/i.test(name);
          const icon = isImage ? "🖼️" : isVideo ? "🎬" : isAudio ? "🎵" : "📄";
          return `
            <div class="card" style="padding:0.75rem;cursor:pointer" onclick="window.open('${API_BASE}/uploads/${encodeURIComponent(name)}', '_blank')">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(displayName)}</p>
                  <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${f.size ? (f.size / 1024).toFixed(1) + " KB" : ""}</p>
                </div>
              </div>
            </div>
          `;
        }).join("");
      }

      showStudentView(`
        <div class="content">
          <h2>📂 Files & Resources</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Browse and download files uploaded by your teachers.</p>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn-filter student-files-filter active" data-filter="all">All</button>
            <button class="btn-filter student-files-filter" data-filter="images">🖼️ Images</button>
            <button class="btn-filter student-files-filter" data-filter="documents">📄 Documents</button>
            <button class="btn-filter student-files-filter" data-filter="media">🎬 Media</button>
          </div>
          <div id="student-files-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.5rem"></div>
        </div>
      `);
      document.querySelectorAll(".student-files-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".student-files-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderStudentFiles();
        });
      });
      renderStudentFiles();
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading files</p></div>'); }
  }

  async function loadStudentPayments() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
    try {
      const [history, subs, invoices] = await Promise.all([
        request("/payments/my-history").catch(() => ({ transactions: [], total_paid: 0, pending_amount: 0, total_transactions: 0 })),
        request("/payments/subscriptions").catch(() => []),
        request("/payments/invoices").catch(() => []),
      ]);
      const txList = Array.isArray(history.transactions) ? history.transactions : [];
      const subList = Array.isArray(subs) ? subs : [];
      const invList = Array.isArray(invoices) ? invoices : [];
      const totalPaid = history.total_paid || 0;
      const pendingAmount = history.pending_amount || 0;
      const totalTx = history.total_transactions || 0;

      function renderTab(tabId) {
        if (tabId === "payments") {
          return `
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3>Available Plans</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Pay a plan fee to Casuya (Admin) via mobile money.</p>
              <div id="student-plans-list"><div class="loading-state"><div class="spinner"></div></div></div>
            </div>
            <div class="card" style="padding:0;max-width:560px;margin-top:1rem;overflow:hidden">
              <div class="checkout-header">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <h3>Make a Payment</h3>
              </div>
              <form id="student-payment-form" class="checkout-body">
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
                    <label class="provider-card"><input type="radio" name="provider" value="m-pesa" required><span class="provider-dot" style="background:#16a34a"></span><span>M-Pesa</span></label>
                    <label class="provider-card"><input type="radio" name="provider" value="tigo-pesa"><span class="provider-dot" style="background:#2563eb"></span><span>Tigo Pesa</span></label>
                    <label class="provider-card"><input type="radio" name="provider" value="halopesa"><span class="provider-dot" style="background:#d97706"></span><span>HaloPesa</span></label>
                    <label class="provider-card"><input type="radio" name="provider" value="azampay"><span class="provider-dot" style="background:#8b5cf6"></span><span>AzamPay</span></label>
                  </div>
                </div>
                <button class="btn btn-success btn-block" type="submit" id="student-payment-submit-btn">Pay Now</button>
              </form>
              <div id="student-payment-result" style="padding:0 1.5rem 1.5rem"></div>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                <h3>Payment History</h3>
                <button class="btn btn-sm" id="student-refresh-tx-btn">Refresh</button>
              </div>
              ${txList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No payments yet</p></div>' : `<div style="overflow-x:auto"><table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem"><thead><tr style="border-bottom:2px solid var(--color-border)"><th style="padding:0.6rem;text-align:left;font-weight:600">Date</th><th style="padding:0.6rem;text-align:left;font-weight:600">Provider</th><th style="padding:0.6rem;text-align:right;font-weight:600">Amount</th><th style="padding:0.6rem;text-align:center;font-weight:600">Status</th></tr></thead><tbody>${txList.map(t => `<tr style="border-bottom:1px solid var(--color-border)"><td style="padding:0.6rem;color:var(--color-text-muted)">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "\u2014"}</td><td style="padding:0.6rem">${escapeHtml(t.provider || "\u2014")}</td><td style="padding:0.6rem;text-align:right;font-weight:600">${(t.amount_tzs || 0).toLocaleString()} TZS</td><td style="padding:0.6rem;text-align:center"><span class="badge badge-${t.status || 'pending'}">${escapeHtml(t.status || "unknown")}</span></td></tr>`).join("")}</tbody></table></div>`}
            </div>`;
        }
        if (tabId === "subscriptions") {
          return subList.length === 0
            ? '<div class="empty-state" style="padding:3rem"><p>No active subscriptions</p></div>'
            : `<div style="display:grid;gap:0.75rem;margin-top:1rem">${subList.map(s => `
              <div class="card" style="padding:1rem;display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-weight:600">${escapeHtml(s.plan_id)}</div><div style="font-size:0.8rem;color:var(--color-text-muted)">Since ${new Date(s.created_at).toLocaleDateString()}</div></div>
                <div style="text-align:right"><div style="font-weight:600">${(s.amount || 0).toLocaleString()} TZS</div><span class="badge badge-${s.status === 'active' ? 'completed' : 'pending'}">${escapeHtml(s.status)}</span></div>
              </div>`).join("")}</div>`;
        }
        if (tabId === "invoices") {
          return invList.length === 0
            ? '<div class="empty-state" style="padding:3rem"><p>No invoices yet</p></div>'
            : `<div style="overflow-x:auto;margin-top:1rem"><table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem"><thead><tr style="border-bottom:2px solid var(--color-border)"><th style="padding:0.6rem;text-align:left;font-weight:600">Invoice #</th><th style="padding:0.6rem;text-align:right;font-weight:600">Amount</th><th style="padding:0.6rem;text-align:left;font-weight:600">Due Date</th><th style="padding:0.6rem;text-align:center;font-weight:600">Status</th></tr></thead><tbody>${invList.map(inv => `<tr style="border-bottom:1px solid var(--color-border)"><td style="padding:0.6rem;font-weight:500">${escapeHtml(inv.invoice_number || "\u2014")}</td><td style="padding:0.6rem;text-align:right;font-weight:600">${(inv.total_amount || 0).toLocaleString()} TZS</td><td style="padding:0.6rem;color:var(--color-text-muted)">${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "\u2014"}</td><td style="padding:0.6rem;text-align:center"><span class="badge badge-${inv.status === 'paid' ? 'completed' : inv.status === 'pending' ? 'pending' : 'failed'}">${escapeHtml(inv.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
        }
        return "";
      }

      showStudentView(`
        <div class="content">
          <h2>Payments</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Manage your payments, subscriptions and invoices</p>
          <div class="stat-grid" style="margin-top:1rem">
            <div class="stat-card"><div class="stat-icon" style="background:#f0fdf4;color:#16a34a">💰</div><div class="stat-value">${totalPaid.toLocaleString()}</div><div class="stat-label">Total Paid (TZS)</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;color:#d97706">⏳</div><div class="stat-value">${pendingAmount.toLocaleString()}</div><div class="stat-label">Pending (TZS)</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#eff6ff;color:#2563eb">📊</div><div class="stat-value">${totalTx}</div><div class="stat-label">Transactions</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#ede9fe;color:#7c3aed">🔄</div><div class="stat-value">${subList.filter(s => s.status === "active").length}</div><div class="stat-label">Active Subs</div></div>
          </div>
          <div class="tab-bar" style="margin-top:1rem">
            <button class="tab-btn active" data-stab="payments">💳 Payments</button>
            <button class="tab-btn" data-stab="subscriptions">🔄 Subscriptions</button>
            <button class="tab-btn" data-stab="invoices">📄 Invoices</button>
          </div>
          <div id="student-payment-tab-content">${renderTab("payments")}</div>
        </div>
      `);

      // Tab switching
      document.querySelectorAll("[data-stab]").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("[data-stab]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          document.getElementById("student-payment-tab-content").innerHTML = renderTab(btn.dataset.stab);
          bindStudentPaymentForm();
          loadStudentPlans();
        });
      });

      function bindStudentPaymentForm() {
        let studentPaymentInProgress = false;
        document.getElementById("student-payment-form")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const btn = document.getElementById("student-payment-submit-btn");
          if (studentPaymentInProgress) return;
          studentPaymentInProgress = true;
          btn.innerHTML = '<span class="btn-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg> Processing...</span>';
          btn.disabled = true;
          const fd = new FormData(ev.target);
          try {
            const result = await request("/payments/checkout", {
              method: "POST",
              body: JSON.stringify({
                mobile_number: fd.get("mobile_number"),
                amount_tzs: parseInt(fd.get("amount_tzs"), 10),
                provider: fd.get("provider"),
                idempotency_key: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
              }),
            });
            if (result === null) return;
            document.getElementById("student-payment-result").innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(result.id || "")}</span></div></div>`;
            loadStudentPayments();
          } catch (err) {
            document.getElementById("student-payment-result").innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
          }
          studentPaymentInProgress = false;
          btn.innerHTML = 'Pay Now';
          btn.disabled = false;
        });
      }
      bindStudentPaymentForm();
      loadStudentPlans();
      document.getElementById("student-refresh-tx-btn")?.addEventListener("click", loadStudentPayments);
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
  }

  async function loadStudentPlans() {
    const el = document.getElementById("student-plans-list");
    if (!el) return;
    try {
      const plans = await request("/payments/plans").catch(() => []);
      if (!Array.isArray(plans) || plans.length === 0) {
        el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>No payment plans available right now.</p></div>';
        return;
      }
      el.innerHTML = plans.map(p => `
        <div class="plan-card" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:1rem;margin-top:0.75rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">
            <div>
              <div style="font-weight:600;font-size:1rem">${escapeHtml(p.name)}</div>
              <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem">${escapeHtml(p.description || "")}</div>
              <div style="font-weight:700;font-size:1.1rem;margin-top:0.5rem">${Number(p.amount_tzs).toLocaleString()} ${escapeHtml(p.currency || "TZS")}</div>
            </div>
            <span class="badge badge-completed" style="text-transform:capitalize">${escapeHtml(p.audience)}</span>
          </div>
          <form class="student-plan-form" data-plan-id="${p.id}" style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:end">
            <div style="flex:1;min-width:140px">
              <label class="field-label">Mobile Number</label>
              <input class="input" name="mobile_number" placeholder="0712345678" required>
            </div>
            <div style="min-width:130px">
              <label class="field-label">Provider</label>
              <select class="input" name="provider" required>
                <option value="m-pesa">M-Pesa</option>
                <option value="tigo-pesa">Tigo Pesa</option>
                <option value="halopesa">HaloPesa</option>
                <option value="azampay">AzamPay</option>
              </select>
            </div>
            <button class="btn btn-success" type="submit">Pay ${Number(p.amount_tzs).toLocaleString()} ${escapeHtml(p.currency || "TZS")}</button>
          </form>
          <div class="student-plan-result" data-plan-id="${p.id}" style="margin-top:0.5rem"></div>
        </div>
      `).join("");
      bindStudentPlanForms();
    } catch (e) {
      el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>Could not load plans.</p></div>';
    }
  }

  function bindStudentPlanForms() {
    document.querySelectorAll(".student-plan-form").forEach(form => {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const planId = form.getAttribute("data-plan-id");
        const btn = form.querySelector("button[type=submit]");
        const resultEl = document.querySelector(`.student-plan-result[data-plan-id="${planId}"]`);
        const fd = new FormData(ev.target);
        btn.disabled = true; btn.innerHTML = '<span class="btn-spinner">Processing...</span>';
        try {
          const result = await request(`/payments/plans/${planId}/checkout`, {
            method: "POST",
            body: JSON.stringify({
              mobile_number: fd.get("mobile_number"),
              provider: fd.get("provider"),
              idempotency_key: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            }),
          });
          if (result === null) return;
          resultEl.innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(result.id || "")}</span></div></div>`;
          loadStudentPayments();
        } catch (err) {
          resultEl.innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
        } finally {
          btn.disabled = false; btn.textContent = "Pay";
        }
      });
    });
  }

  async function loadStudentNotifications() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const data = await request("/notifications");
      const allNotifs = Array.isArray(data) ? data : [];
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
            const badge = document.getElementById("notif-badge");
            if (badge) { const c = unread.length; badge.textContent = c; badge.style.display = c > 0 ? "inline" : "none"; }
            render();
          });
        });
      }

      showStudentView(`
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
        const badge = document.getElementById("notif-badge");
        if (badge) badge.style.display = "none";
        render();
      });
      render();
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
  }

  async function loadStudentSettings() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
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

      showStudentView(`
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
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading settings</p></div>'); }
  }

  // Load initial view from URL hash, fallback to dashboard
  const initialView = location.hash.slice(1) || "dashboard";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadStudentOverview();
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
    try {
      const data = await request("/settings/maintenance");
      if (data && data.enabled === true && localStorage.getItem("casuya_role") !== "admin") {
        renderMaintenanceScreen(data);
        return;
      }
    } catch (_) {}
    renderApp();
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
