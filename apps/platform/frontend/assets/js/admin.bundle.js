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
              renderLogin();
              return null;
            }
          }
          localStorage.removeItem("casuya_token");
          localStorage.removeItem("casuya_refresh_token");
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
    html += "<thead><tr>" + headers.map(h => `<th>${h.trim()}</th>`).join("") + "</tr></thead>";
    html += "<tbody>" + rows.map(r =>
      "<tr>" + r.map((c, i) => `<td data-label="${escapeHtml(headers[i] || "")}">${c.trim()}</td>`).join("") + "</tr>"
    ).join("") + "</tbody></table>";
    return html;
  });

  // NECTA Exam Tip blocks (💡 line followed by content until *** or blank line)
  text = text.replace(/^(.*💡\s*(?:NECTA\s+(?:Examination\s+)?Tip|Mtihani).*)\n((?:(?!\*\*\*).+\n?)*)/gim, (_, tipLine, body) => {
    const cleanBody = body.trim().replace(/\n/g, "<br>");
    return `<div class="tutor-necta-tip"><div class="tutor-necta-tip-label">💡 NECTA Examination Tip</div><p>${cleanBody}</p></div>`;
  });

  // Blockquotes > ... → context blockquote
  text = text.replace(/^>\s*(.+)$/gm, (_, content) => {
    // Check if it looks like a Tanzania/local context
    const isLocal = /tanzan|serengeti|kilimanjaro|lake victoria|dodoma|dar|kenya|uganda|east africa|africa|mwanza|arusha|mbeya|ruaha|rufiji/i.test(content);
    const badge = isLocal ? "🌍 Tanzania Context" : "📖 Context";
    return `<div class="tutor-context-blockquote"><div class="tutor-context-badge">${badge}</div><p>${content}</p></div>`;
  });
  // Remove duplicate blockquote wrappers (if multiple > lines were wrapped individually)
  text = text.replace(/(<div class="tutor-context-blockquote">[\s\S]*?<\/div>\n?)+/g, (match) => {
    // Keep as-is, each > line is its own block
    return match;
  });

  // Horizontal rules ***
  text = text.replace(/^\*\*\*\s*$/gm, "<hr>");

  // Headers
  text = text.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold + italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code (but not inside code blocks)
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Unordered lists
  text = text.replace(/^(?:- (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${l.replace(/^- /, "")}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  text = text.replace(/^(?:\d+\. (.+)\n?)+/gm, (match) => {
    const items = match.trim().split("\n").map(l => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: double newline → paragraph break
  text = text.replace(/\n{2,}/g, "\n\n");
  const paragraphs = text.split("\n\n");
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    // Don't wrap if it's already an HTML block
    if (/^<(div|table|ul|ol|h[1-6]|hr|pre)/.test(p)) return p;
    // Wrap plain text in paragraphs, converting single newlines to <br>
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
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

async function viewLessonContent(containerId, lessonId, backFn) {
  const container = document.querySelector(containerId);
  if (!container) return;
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
        setInterval(function() { if (maxPct > 0) parent.postMessage({type:'casuya-progress', percent:Math.min(maxPct + 10, 100)}, '*'); }, 5000);
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
    html += '<div class="exam-answer-line"></div>';
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
// modules/admin-dashboard.js — extracted from main.js (classic script, shared global scope)
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
          <div class="sidebar-nav-item" data-view="games">🎮 Games</div>
          <div class="sidebar-nav-item" data-view="users">👥 Users</div>
          <div class="sidebar-nav-item" data-view="progress">📈 Progress</div>
          <div class="sidebar-nav-item" data-view="analytics">📉 Analytics</div>
          <div class="sidebar-nav-item" data-view="payments">💳 Payments</div>
          <div class="sidebar-nav-item" data-view="notifications">🔔 Notifications</div>
          <div class="sidebar-nav-item" data-view="uploads">📤 Uploads</div>
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

  adminSearchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = adminSearchInput.value.trim();
    if (q.length < 2) { adminSearchResults.style.display = "none"; return; }
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
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
  function setActiveNav(viewId) {
    document.querySelectorAll("#admin-nav .sidebar-nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  function showAdminView(content) {
    const el = document.getElementById("admin-content");
    if (!el) return;
    el.innerHTML = content;
  }

  const navHandlers = {
    dashboard: () => { setActiveNav("dashboard"); loadAdminOverview(); },
    subjects: () => { setActiveNav("subjects"); loadAdminSubjects(); },
    topics: () => { setActiveNav("topics"); loadAdminTopics(); },
    subtopics: () => { setActiveNav("subtopics"); loadAdminSubtopics(); },
    lessons: () => { setActiveNav("lessons"); loadAdminLessons(); },
    quizzes: () => { setActiveNav("quizzes"); loadAdminQuizzes(); },
    games: () => { setActiveNav("games"); loadAdminGames(); },
    users: () => { setActiveNav("users"); loadAdminUsers(); },
    progress: () => { setActiveNav("progress"); loadAdminProgress(); },
    analytics: () => { setActiveNav("analytics"); loadAdminAnalytics(); },
    payments: () => { setActiveNav("payments"); loadAdminPayments(); },
    notifications: () => { setActiveNav("notifications"); loadAdminNotifications(); },
    uploads: () => { setActiveNav("uploads"); loadAdminUploads(); },
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
  async function loadAdminProgress() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const [students, teachers, subjects, distribution] = await Promise.all([
        request("/students"),
        request("/teachers"),
        request("/subjects"),
        request("/analytics/lesson-distribution"),
      ]);

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
            <form id="create-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="subtopic_id" required><option value="">Select subtopic...</option></select>
              <input class="input" name="title" placeholder="Lesson title" required>
              <textarea class="input" name="content" rows="6" placeholder="Lesson content (HTML supported)"></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/subtopics").then(subs => {
          const sel = document.querySelector('[name="subtopic_id"]');
          if (sel && Array.isArray(subs)) subs.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.title; sel.appendChild(o); });
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-lesson-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          try {
            await request("/lessons", { method: "POST", body: JSON.stringify({ title, slug, html_content: fd.get("content"), subtopic_id: fd.get("subtopic_id") }) });
            loadAdminLessons();
          } catch(err) { showToast("Error: " + err.message); }
        });
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
                  <option value="biology">Biology</option>
                  <option value="chemistry">Chemistry</option>
                  <option value="physics">Physics</option>
                  <option value="english">English</option>
                  <option value="kiswahili">Kiswahili</option>
                  <option value="geography">Geography</option>
                  <option value="history">History</option>
                  <option value="civics">Civics</option>
                  <option value="computing">Computing</option>
                </select>
                <select class="input" name="form_level" style="flex:0.5">
                  <option value="1">Form I</option>
                  <option value="2">Form II</option>
                  <option value="3">Form III</option>
                  <option value="4">Form IV</option>
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
          resultDiv.style.display = "block";
          textDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Generating...</div>';
          try {
            const result = await request("/ai/questions/generate", {
              method: "POST",
              body: JSON.stringify({
                lesson_html: fd.get("lesson_html"),
                count: parseInt(fd.get("count")) || 5,
                subject_slug: fd.get("subject_slug"),
                form_level: parseInt(fd.get("form_level")) || 2,
              }),
            });
            const questions = result?.questions || result;
            if (Array.isArray(questions) && questions.length) {
              textDiv.innerHTML = renderQuizQuestions(questions, {
                subject: fd.get("subject_slug"),
                formLevel: fd.get("form_level"),
                topic: questions[0]?.topic || "",
              });
              window.renderMath(textDiv);
            } else {
              textDiv.innerHTML = '<p style="color:var(--color-text-muted)">No questions generated. Try different content.</p>';
            }
          } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  async function viewAdminLesson(lessonId, lessonTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      const lesson = await request(`/lessons/${lessonId}`);
      if (!lesson) return;
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
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
          const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
          if (resp.ok) currentHtml = await resp.text();
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
        const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
        if (resp.ok) {
          const html = await resp.text();
          const iframe = document.getElementById("lesson-frame");
          iframe.srcdoc = injectNodeBase(html);
          iframe.onload = () => {
            try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
          };
        }
      } catch(e) {}
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lesson</p></div>'); }
  }

  async function loadAdminQuizzes() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading quizzes...</p></div>');
    try {
      const quizzes = await request("/quizzes/");
      const list = Array.isArray(quizzes) ? quizzes : [];
      const lessons = await request("/lessons/");
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
      if (quiz.slug) {
        try {
          const resp = await fetch(`${API_BASE}/quizzes/${quizId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
          if (resp.ok) htmlContent = await resp.text();
        } catch(e) {}
      }
      let questionsHtml = "";
      if (!quiz.slug) {
        const fullQuiz = await request(`/quizzes/by-lesson/${quiz.lesson_id}`).catch(() => null);
        if (fullQuiz && Array.isArray(fullQuiz.questions)) {
          questionsHtml = fullQuiz.questions.map((q, i) => `
            <div class="card" style="padding:0.75rem;margin-bottom:0.5rem">
              <p style="font-weight:600;margin-bottom:0.5rem">${i + 1}. ${escapeHtml(q.prompt)}</p>
              ${q.options.map(o => `<p style="font-size:0.85rem;margin:0.15rem 0;padding-left:1rem">• ${escapeHtml(o.text)}</p>`).join("")}
            </div>
          `).join("");
        }
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
  async function loadAdminGames() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games/");
      const list = Array.isArray(games?.items) ? games.items : [];
      const lessons = await request("/lessons/");
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
          const resp = await fetch(`${API_BASE}/games/${gameId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
          if (resp.ok) htmlContent = await resp.text();
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

  async function loadAdminUsers() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>');
    try {
      const [students, teachers] = await Promise.all([request("/students"), request("/teachers")]);
      const sList = Array.isArray(students?.items) ? students.items : [];
      const tList = Array.isArray(teachers?.items) ? teachers.items : [];
      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Users</h2>
            <button class="btn btn-primary" id="register-user-btn">+ Register User</button>
          </div>
          <div id="user-form-area"></div>

          <div class="section-header" style="margin-top:1.5rem">
            <h3>Students (${sList.length})</h3>
          </div>
          <div class="card-grid">
            ${sList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No students registered</p></div>' :
              sList.map(s => `
                <div class="card user-card" data-id="${escapeHtml(s.id || s.user_id)}" data-type="student" data-name="${escapeHtml(s.full_name || '')}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${escapeHtml((s.full_name || "S").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h4 style="margin:0;font-size:0.9rem">${escapeHtml(s.full_name || "Unnamed")}</h4>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.email || "")} ${s.form_level ? "· " + escapeHtml(s.form_level) : ""}</p>
                    </div>
                  </div>
                </div>
              `).join("")}
          </div>

          <div class="section-header" style="margin-top:1.5rem">
            <h3>Teachers (${tList.length})</h3>
          </div>
          <div class="card-grid">
            ${tList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No teachers registered</p></div>' :
              tList.map(t => `
                <div class="card user-card" data-id="${escapeHtml(t.id || t.user_id)}" data-type="teacher" data-name="${escapeHtml(t.full_name || '')}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${escapeHtml((t.full_name || "T").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h4 style="margin:0;font-size:0.9rem">${escapeHtml(t.full_name || "Unnamed")}</h4>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.email || "")} ${t.subjects ? "· " + escapeHtml(t.subjects) : ""}</p>
                    </div>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .user-card").forEach(card => {
        card.addEventListener("click", () => viewAdminUser(card.dataset.id, card.dataset.type, card.dataset.name));
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
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading users</p></div>'); }
  }

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

      const progressList = Array.isArray(progressData) ? progressData : [];
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
                  <div style="flex:1;min-width:160px"><label class="field-label">Name</label><input class="input" name="name" required></div>
                  <div style="flex:1;min-width:160px"><label class="field-label">Description</label><input class="input" name="description"></div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
                  <div style="min-width:130px"><label class="field-label">Amount (TZS)</label><input class="input" name="amount_tzs" type="number" min="100" required></div>
                  <div style="min-width:130px"><label class="field-label">Audience</label><select class="input" name="audience"><option value="both">Both</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>
                  <div style="min-width:130px"><label class="field-label">Active</label><select class="input" name="is_active"><option value="true">Yes</option><option value="false">No</option></select></div>
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

  async function loadAdminNotifications() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const [data, users] = await Promise.all([
        request("/notifications"),
        request("/users"),
      ]);
      const allNotifs = Array.isArray(data) ? data : [];
      const userList = Array.isArray(users) ? users : [];
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
            <input type="search" class="input" id="notif-search" placeholder="Search notifications..." style="max-width:240px;padding:0.35rem 0.6rem;font-size:0.85rem">
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
  async function loadAdminBranding() {
    const API = window.casuyaApiBase ? window.casuyaApiBase() : ((window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80") ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:8765`);
    const token = localStorage.getItem("casuya_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    // Check what's currently uploaded
    let logoExists = false, faviconExists = false;
    try {
      const lr = await fetch(`${API}/branding/logo`);
      logoExists = lr.ok;
    } catch {}
    try {
      const fr = await fetch(`${API}/branding/favicon`);
      faviconExists = fr.ok;
    } catch {}

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

  async function loadAdminAnalytics() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading analytics...</p></div>');
    try {
      const [overview, distribution] = await Promise.all([
        request("/analytics/overview"),
        request("/analytics/lesson-distribution").catch(() => []),
      ]);
      const lessons = await request("/lessons").catch(() => []);
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const lessonAnalytics = [];
      for (const l of lessonList.slice(0, 10)) {
        try {
          const a = await request(`/analytics/lessons/${l.id}`);
          if (a) lessonAnalytics.push({ ...a, title: l.title });
        } catch(e) {}
      }
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

  async function loadAdminSettings() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [profile, branding, platformStatus] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/branding/logo").catch(() => null),
        request("/settings/platform-status").catch(() => null),
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
              var studentLabels = {dashboard:"Dashboard",subjects:"Subjects",progress:"Progress",bookmarks:"Bookmarks",assignments:"Assignments",games:"Games",downloads:"Downloads",exams:"Exams",files:"Files",payments:"Payments",notifications:"Notifications",settings:"Settings"};
              var teacherLabels = {overview:"Overview",students:"Students",lessons:"Lessons",assignments:"Assignments",reports:"Reports","ai-assistant":"AI Assistant",bookmarks:"Bookmarks",files:"Files",payments:"Payments",notifications:"Notifications",settings:"Settings"};
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
        } else if (tab === "appearance") {
          panel.innerHTML = appearancePanelHTML();
          setupAppearanceControls();
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

  // Load initial view from URL hash, fallback to dashboard
  const initialView = location.hash.slice(1) || "dashboard";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadAdminOverview();
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
document.addEventListener("DOMContentLoaded", () => {
  applyAppearance();
  const token = localStorage.getItem("casuya_token");
  if (token) {
    renderApp();
  } else {
    renderLogin();
  }
});
