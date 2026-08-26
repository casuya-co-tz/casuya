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
    window.CASUYA_API_URL = "https://casuya-backend.onrender.com";
  }
})();

;
(function () {
  // casuya-config.js — central API base resolution for the static frontend.
  //
  // In production, point the frontend at your Render backend by setting the
  // global CASUYA_API_URL (e.g. https://casuya-backend.onrender.com) in a small
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

  // Register the offline/performance service worker (same-origin only; safe no-op
  // on browsers without support or on insecure origins).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
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

window._quizSubmit = function(quizId, total) {
  var correct = 0;
  var i, container, correctAnswer, selected, selectedVal, exp;
  var scoreEl, scoreNum, scoreLabel, pct, msg, btn;

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
};

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
    // Fetch lesson metadata for title
    let lessonMeta = {};
    try { lessonMeta = await request(`/lessons/${lessonId}`); } catch(e) {}
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

    const token = localStorage.getItem("casuya_token");
    const payload = decodeToken(token);
    const isStudent = payload?.role === "student";
    const canBookmark = isStudent || payload?.role === "teacher";
    const lessonStart = Date.now();
    let studentId = null;
    let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    let quizScoreSent = false;
    let lastSentCompletion = -1;
    let lastSentScore = -1;
    let progressTimer = null;

    if (isStudent) {
      try {
        const students = await request("/students");
        if (Array.isArray(students)) {
          const my = students.find(s => s.user_id === payload.sub || s.id === payload.sub);
          if (my) studentId = my.id || my.user_id;
        }
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

    // Fetch bookmark, quiz, games, notes in ONE call (P2-3 aggregated endpoint).
    let bookmarked = false;
    let quizData = null;
    let gamesData = [];
    let noteData = { content: "" };
    if (canBookmark) {
      try {
        const pkg = await request(`/lessons/${lessonId}/package`);
        bookmarked = pkg.bookmark_status?.bookmarked || false;
        quizData = isStudent ? pkg.quiz : null;
        gamesData = isStudent ? (pkg.games || []) : [];
        noteData = isStudent ? (pkg.note || { content: "" }) : { content: "" };
      } catch(e) {}
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
    iframe.srcdoc = html.replace("<head>", `<head><base href="${API_BASE}/">`);
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
          area.innerHTML = `<iframe style="width:100%;min-height:400px;border:none;border-radius:var(--radius)" srcdoc="${escapeHtml(html)}"></iframe>`;
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

    // Hero
    "hero.badge": "Elimu Ilivyobadilishwa",
    "hero.title1": "Jifunze kwa Akili.",
    "hero.title2": "Fundisha Bora.",
    "hero.title3": "Jenga Mustakabali.",
    "hero.desc": "Mfumo wa elimu wenye akili unaounganisha walimu, wanafunzi, na shule kwa zana za kidijitali za kisasa zilizojengwa kwa miundombinu yoyote.",
    "hero.start": "Anza Kujifunza",
    "hero.demo": "Angalia Onyesho",

    // Hero mock UI
    "hero.today_lesson": "Masomo ya Leo",
    "hero.dive_into": "\"Zama katika mazoezi ya kushirikiana yenye maswali na ufuatiliaji wa maendeleo kwa wakati halisi.\"",
    "hero.class_sync": "Usawazishaji wa Darasa",
    "hero.offline_ready": "Tayari Kwa Mtandao 100%",
    "hero.avg_score": "Wastani wa Alama",
    "hero.progress": "+18% Maendeleo",

    // Trusted
    "trusted.title": "Kuwezesha Mifumo ya Elimu ya Kisasa",

    // Features
    "features.badge": "Uwezo wa Jukwaa",
    "features.title": "Kwa Nini Shule Zinachagua Casuya",
    "features.desc": "Kila moduli imeboreshwa kwa kasi ya umeme na utendaji wa kuaminika kwa vifaa vya chini.",

    // Subjects
    "subjects.badge": "Muundo wa Mtaala",
    "subjects.title": "Chunguza Masomo Kote Kwenye Mfumo",
    "subjects.physics": "Fizikia",
    "subjects.chemistry": "Kemikali",
    "subjects.biology": "Biolojia",
    "subjects.math": "Hisabati",

    // Audiences
    "audiences.badge": "Uzoefu Maalum",
    "audiences.title": "Imejengwa kwa Kila Mtu Shuleni",
    "audiences.desc": "Akaunti za usajili zinapatikana kama Mwanafunzi au Mwalimu. Wazazi na shule wanafaidika kupitia uzoefu wa mwanafunzi na mwalimu.",

    // Audience cards
    "audiences.teachers": "Walimu",
    "audiences.teachers.f1": "Unda maudhui tajiri ya kidijitali",
    "audiences.teachers.f2": "Simamia vikundi vya masomo",
    "audiences.teachers.f3": "Tathmini miongozo ya data",
    "audiences.students": "Wanafunzi",
    "audiences.students.f1": "Soma popote pale",
    "audiences.students.f2": "Fanya mitihani nje ya mtandao",
    "audiences.students.f3": "Fuatilia rekodi za kujifunza",
    "audiences.parents": "Wazazi",
    "audiences.parents.f1": "Angalia viashiria vya maendeleo",
    "audiences.parents.f2": "Tazama sasisha za eneo",
    "audiences.schools": "Shule",
    "audiences.schools.f1": "Boresha ugavi wa kazi kwa wafanyakazi",
    "audiences.schools.f2": "Hamisha data ngumu za uchambuzi",

    // CTA
    "cta.title": "Tayari Kubadilisha Elimu?",
    "cta.desc": "Junge na maelfu ya walimu, wanafunzi, na wasimamizi wa mfumo wanaosanidi mitandao ya shule ya akili leo.",

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
    "footer.github": "Shirika la GitHub",
    "footer.copyright": "© 2026 Jukwaa la Casuya. Haki zote zimehifadhiwa.",
    "footer.built": "Imeundwa kwa utunzaji kwa shule za Tanzania",
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
    blurb: "Create rich operational HTML lessons bundled with videos, interactive quizzes, and modern rich animations.",
    hero: true,
    trusted: false,
  },
  offlineLearning: {
    enabled: true,
    icon: "📶",
    title: "Offline Learning",
    blurb: "Seamlessly download full structured courses locally and continue learning dynamically even without Internet infrastructure.",
    hero: true,
    trusted: true,
  },
  aiAssistant: {
    enabled: true,
    icon: "🤖",
    title: "AI Teacher Assistant",
    blurb: "Instantly generate balanced grading frameworks, structural lesson descriptions, and sample interactive workflows.",
    hero: true,
    trusted: false,
  },
  analytics: {
    enabled: true,
    icon: "📊",
    title: "Analytics",
    blurb: "Track comprehensive student performance curves utilizing direct, visual metrics panels.",
    hero: true,
    trusted: false,
  },
  assessments: {
    enabled: true,
    icon: "📝",
    title: "Assessments",
    blurb: "Design specialized dynamic questionnaires, modular assignments, and enterprise testing criteria on the fly.",
    hero: false,
    trusted: false,
  },
  cloudSync: {
    enabled: true,
    icon: "☁️",
    title: "Cloud Sync",
    blurb: "Securely back up all grades, configurations, and core parameters instantly whenever a connection activates.",
    hero: false,
    trusted: true,
  },
  digitalExaminations: {
    enabled: true,
    icon: "🧪",
    title: "Digital Examinations",
    blurb: "Conduct secure, browser-based examinations with automatic grading, anti-cheat measures, and instant result analytics.",
    hero: false,
    trusted: true,
  },
  aiLessonCreation: {
    enabled: true,
    icon: "✨",
    title: "AI Lesson Creation",
    blurb: "Generate lesson outlines, quizzes, and study materials using AI-powered content creation tools.",
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

async function login({ email, password }) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
// modules/teacher-dashboard.js — extracted from main.js (classic script, shared global scope)
async function renderTeacherDashboard() {
  const token = localStorage.getItem("casuya_token");
  const payload = decodeToken(token);

  render("#app", `
    <div class="sidebar-layout">
      <aside id="teacher-sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2>Casuya</h2>
          <p>${escapeHtml(payload.full_name || payload.email || "Teacher")}</p>
        </div>
        <nav class="sidebar-nav" id="teacher-nav">
          <div class="sidebar-nav-item active" data-view="overview">📊 Overview</div>
          <div class="sidebar-nav-item" data-view="students">👥 Students</div>
          <div class="sidebar-nav-item" data-view="lessons">📝 Lessons</div>
          <div class="sidebar-nav-item" data-view="assignments">📋 Assignments</div>
          <div class="sidebar-nav-item" data-view="reports">📈 Reports</div>
          <div class="sidebar-nav-item" data-view="ai-assistant">🤖 AI Assistant</div>
          <div class="sidebar-nav-item" data-view="bookmarks">🔖 Bookmarks</div>
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
            <input id="teacher-search" type="search" class="input" placeholder="Search lessons, students..." style="padding:0.4rem 0.75rem;font-size:0.85rem">
            <div id="teacher-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);z-index:100;max-height:300px;overflow-y:auto"></div>
          </div>
        </header>
        <div id="teacher-content" class="main-body"></div>
      </main>
    </div>
  `);
  // Sidebar toggle (mobile)
  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("teacher-sidebar").classList.toggle("open");
  }, { signal: _globalAbort.signal });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#teacher-sidebar") && !e.target.closest("#sidebar-toggle")) {
      document.getElementById("teacher-sidebar")?.classList.remove("open");
    }
  }, { signal: _globalAbort.signal });

  // Search functionality
  const teacherSearchInput = document.getElementById("teacher-search");
  const teacherSearchResults = document.getElementById("teacher-search-results");
  let searchTimer;

  teacherSearchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = teacherSearchInput.value.trim();
    if (q.length < 2) { teacherSearchResults.style.display = "none"; return; }
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
        if (!Array.isArray(results) || results.length === 0) {
          teacherSearchResults.innerHTML = '<div style="padding:0.5rem;color:var(--color-text-muted)">No results</div>';
        } else {
          teacherSearchResults.innerHTML = results.map(r => `
            <div class="teacher-search-item" data-id="${escapeHtml(r.id)}" data-type="${escapeHtml(r.type)}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between">
              <span>${escapeHtml(r.title)}</span>
              <span style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(r.type)}</span>
            </div>
          `).join("");
          teacherSearchResults.querySelectorAll(".teacher-search-item").forEach(el => {
            el.addEventListener("click", () => {
              teacherSearchResults.style.display = "none";
              teacherSearchInput.value = "";
              const type = el.dataset.type;
              const id = el.dataset.id;
              if (type === "lesson") {
                viewLessonContent("#teacher-content", id, loadTeacherLessons);
              } else if (type === "student") {
                viewTeacherStudent(id, el.querySelector("span")?.textContent || "Student");
              } else {
                navHandlers.overview();
              }
            });
          });
        }
        teacherSearchResults.style.display = "block";
      } catch(e) { teacherSearchResults.style.display = "none"; }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#teacher-search") && !e.target.closest("#teacher-search-results")) teacherSearchResults.style.display = "none";
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
    showTeacherProfileEditor();
  });

  // Navigation
  function setActiveNav(viewId) {
    document.querySelectorAll("#teacher-nav .sidebar-nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  function showTeacherView(content) {
    const el = document.getElementById("teacher-content");
    if (el) el.innerHTML = content;
  }

  const navHandlers = {
    overview: () => { setActiveNav("overview"); loadTeacherOverview(); },
    dashboard: () => { setActiveNav("overview"); loadTeacherOverview(); },
    students: () => { setActiveNav("students"); loadTeacherStudents(); },
    lessons: () => { setActiveNav("lessons"); loadTeacherLessons(); },
    assignments: () => { setActiveNav("assignments"); loadTeacherAssignments(); },
    reports: () => { setActiveNav("reports"); loadTeacherReports(); },
    "ai-assistant": () => { setActiveNav("ai-assistant"); loadTeacherAIAssistant(); },
    bookmarks: () => { setActiveNav("bookmarks"); loadTeacherBookmarks(); },
    files: () => { setActiveNav("files"); loadTeacherFiles(); },
    payments: () => { setActiveNav("payments"); loadTeacherPayments(); },
    notifications: () => { setActiveNav("notifications"); loadTeacherNotifications(); },
    settings: () => { setActiveNav("settings"); loadTeacherSettings(); },
  };

  function navigateTo(view) {
    if (navHandlers[view]) {
      location.hash = view;
      navHandlers[view]();
    }
  }

  document.querySelectorAll("#teacher-nav .sidebar-nav-item").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("teacher-sidebar")?.classList.remove("open");
      navigateTo(el.dataset.view);
    });
  });

  (async function applyModuleVisibility() {
    try {
      var vis = await request("/settings/modules/my");
      if (!vis || typeof vis !== "object") return;
      var items = document.querySelectorAll("#teacher-nav .sidebar-nav-item");
      var firstEnabled = null;
      items.forEach(function(el) {
        var view = el.getAttribute("data-view");
        if (vis[view] === false) {
          el.style.display = "none";
        } else if (!firstEnabled) {
          firstEnabled = view;
        }
      });
      var currentHash = location.hash.slice(1) || "overview";
      if (vis[currentHash] === false && firstEnabled) {
        navigateTo(firstEnabled);
      }
    } catch(e) {}
  })();

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "overview";
    if (navHandlers[view]) navHandlers[view]();
  });

  async function showTeacherProfileEditor() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const [me, profile] = await Promise.all([
        request("/users/me"),
        request("/teachers/me").catch(() => null),
      ]);
      showTeacherView(`
        <div class="content" style="max-width:500px;margin:0 auto">
          <h2>Edit Profile</h2>
          <form id="profile-form">
            <label>Email</label>
            <input type="email" value="${escapeHtml(me.email || "")}" disabled style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
            <label>Phone</label>
            <input type="tel" id="pf-phone" value="${escapeHtml(me.phone || "")}" style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
            ${profile ? `
              <label>Full Name</label>
              <input type="text" id="pf-name" value="${escapeHtml(profile.full_name || "")}" style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
              <label>Subjects</label>
              <input type="text" id="pf-subjects" value="${escapeHtml(profile.subjects || "")}" style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
            ` : ""}
            <button type="submit" class="btn btn-primary" style="width:100%">Save Changes</button>
          </form>
          <p id="profile-msg" style="display:none;margin-top:0.75rem"></p>
          <button class="btn lesson-back-btn" style="margin-top:1rem">&larr; Back</button>
        </div>
      `);
      document.querySelector("#teacher-content .lesson-back-btn")?.addEventListener("click", loadTeacherOverview);
      document.getElementById("profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("profile-msg");
        try {
          await request("/users/me", { method: "PATCH", body: JSON.stringify({ phone: document.getElementById("pf-phone").value || null }) });
          if (profile) {
            await request("/teachers/me", { method: "PATCH", body: JSON.stringify({
              full_name: document.getElementById("pf-name").value || null,
              subjects: document.getElementById("pf-subjects").value || null,
            })});
          }
          msg.style.display = "block"; msg.style.color = "var(--color-success)"; msg.textContent = "Profile updated!";
          setTimeout(() => msg.style.display = "none", 3000);
        } catch(err) {
          msg.style.display = "block"; msg.style.color = "red"; msg.textContent = err.message;
        }
      });
    } catch(err) {
      showTeacherView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  async function loadTeacherOverview() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const [overview, lessons] = await Promise.all([
        request("/analytics/overview"),
        request("/lessons/?status=published"),
      ]);
      const name = payload.full_name || payload.email || "Teacher";

      // Greeting based on time
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      // Recently viewed from localStorage
      let recent = [];
      try { recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]"); } catch(e) {}

      // Bookmarks
      let bookmarks = [];
      try { bookmarks = await request("/bookmarks"); } catch(e) {}

      showTeacherView(`
        <div class="content" style="max-width:960px">
          <!-- Welcome Banner -->
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}</h2>
            <p>Here's what's happening in your classes today.</p>
          </div>

          <!-- Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">👥</div>
              <div class="stat-value">${overview?.total_students ?? 0}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">📝</div>
              <div class="stat-value">${Array.isArray(lessons) ? lessons.length : 0}</div>
              <div class="stat-label">Lessons</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">📈</div>
              <div class="stat-value">${overview?.avg_completion_rate ? Math.round(overview.avg_completion_rate) + "%" : "0%"}</div>
              <div class="stat-label">Completion Rate</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">🔖</div>
              <div class="stat-value">${Array.isArray(bookmarks) ? bookmarks.length : 0}</div>
              <div class="stat-label">Bookmarked</div>
            </div>
          </div>

          ${recent.length > 0 ? `
            <div class="section-header">
              <h3>Continue Editing</h3>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;margin-bottom:1.25rem">
              ${recent.slice(0, 3).map(r => `
                <div class="recent-lesson-card" data-id="${escapeHtml(r.id)}">
                  <h4>${escapeHtml(r.title)}</h4>
                  <span class="recent-meta">${r.time ? new Date(r.time).toLocaleDateString() : ""}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}

          <div class="section-header">
            <h3>${bookmarks.length > 0 ? "Bookmarked Lessons" : "Published Lessons"}</h3>
          </div>
          <div class="card-grid">
            ${!Array.isArray(lessons) || lessons.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No lessons available yet</p></div>' :
              (bookmarks.length > 0 ? bookmarks : lessons).map(l => `
                <div class="card lesson-card clickable" data-id="${escapeHtml(l.lesson_id || l.id)}" style="position:relative">
                  <h3>${escapeHtml(l.lesson_title || l.title)}</h3>
                  ${l.lesson_id ? '<span style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem">🔖</span>' : ""}
                  <p style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(l.status || "bookmarked")}</p>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#teacher-content .lesson-card.clickable").forEach(el => {
        el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, loadTeacherLessons));
      });
      document.querySelectorAll("#teacher-content .recent-lesson-card").forEach(el => {
        el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, loadTeacherOverview));
      });
    } catch (err) {
      showTeacherView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  async function loadTeacherStudents() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const students = await request("/students");
      const sList = Array.isArray(students) ? students : [];
      showTeacherView(`
        <div class="content" style="max-width:960px">
          <h2>Students</h2>
          <div class="card-grid" style="margin-top:1rem">
            ${sList.length === 0 ? '<div class="empty-state"><p>No students enrolled</p></div>' :
              sList.map(s => `
                <div class="card student-card" data-id="${escapeHtml(s.id || s.user_id)}" data-name="${escapeHtml(s.full_name || s.user_id)}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:40px;height:40px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;flex-shrink:0">${escapeHtml((s.full_name || "S").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h3 style="margin:0;font-size:0.95rem">${escapeHtml(s.full_name || s.user_id)}</h3>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.email || "")} ${s.form_level ? "— Form " + escapeHtml(s.form_level) : ""}</p>
                    </div>
                    <span style="color:var(--color-text-muted);font-size:0.8rem">→</span>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#teacher-content .student-card").forEach(card => {
        card.addEventListener("click", () => viewTeacherStudent(card.dataset.id, card.dataset.name));
      });
    } catch (err) {
      showTeacherView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  async function viewTeacherStudent(studentId, studentName) {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading student progress...</p></div>');
    try {
      const [progress, profile] = await Promise.all([
        request(`/progress/${studentId}`).catch(() => []),
        request(`/students/${studentId}`).catch(() => null),
      ]);

      const progressList = Array.isArray(progress) ? progress : [];
      const bySubject = {};
      let totalCompleted = 0;
      let avgScore = 0;
      const scores = [];
      progressList.forEach(p => {
        const subj = p.subject_name || "General";
        if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0, scores: [] };
        bySubject[subj].total++;
        if (p.completion_percentage >= 100) { bySubject[subj].completed++; totalCompleted++; }
        if (p.score_percentage != null && p.score_percentage > 0) {
          bySubject[subj].scores.push(p.score_percentage);
          scores.push(p.score_percentage);
        }
      });
      if (scores.length > 0) avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      showTeacherView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
            <button class="btn" id="back-btn">← Back</button>
            <h2>${escapeHtml(studentName)}</h2>
          </div>

          ${profile ? `
            <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.5rem;font-size:0.85rem;color:var(--color-text-muted)">
              ${profile.email ? `<span>📧 ${escapeHtml(profile.email)}</span>` : ""}
              ${profile.form_level ? `<span>📋 ${escapeHtml(profile.form_level)}</span>` : ""}
              ${profile.phone ? `<span>📱 ${escapeHtml(profile.phone)}</span>` : ""}
            </div>
          ` : ""}

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
          ${Object.keys(bySubject).length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No progress data yet</p></div>'
            : Object.entries(bySubject).map(([name, data]) => {
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                const subjAvg = data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0;
                return `
                  <div class="card" style="margin-bottom:0.75rem">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                      <strong>${escapeHtml(name)}</strong>
                      <span style="font-size:0.85rem;color:var(--color-text-muted)">${data.completed}/${data.total} lessons${subjAvg > 0 ? " · " + subjAvg + "% avg" : ""}</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join("")}
        </div>
      `);

      document.getElementById("back-btn")?.addEventListener("click", loadTeacherStudents);
    } catch (err) {
      showTeacherView(`<div class="empty-state"><p>Error loading student data</p><button class="btn" id="back-btn">← Back</button></div>`);
      document.getElementById("back-btn")?.addEventListener("click", loadTeacherStudents);
    }
  }

  async function loadTeacherLessons() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const lessons = await request("/lessons");
      let drafts = [];
      try { drafts = JSON.parse(localStorage.getItem("casuya_teacher_drafts") || "[]"); } catch(e) {}
      showTeacherView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Lessons</h2>
            <button class="btn btn-primary" id="create-draft-btn">+ Create Draft</button>
          </div>
          <div id="draft-form-area"></div>
          ${drafts.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Your Drafts (${drafts.length})</h3>
            <div class="card-grid">
              ${drafts.map((d, i) => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(d.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Created: ${new Date(d.createdAt).toLocaleDateString()}</p>
                      <p style="color:var(--color-text-muted);font-size:0.75rem;margin-top:0.15rem">Content: ${d.html_content.length} chars</p>
                    </div>
                    <div style="display:flex;gap:0.25rem">
                      <button class="btn btn-sm" data-view-draft="${i}">View</button>
                      <button class="btn btn-sm btn-danger" data-delete-draft="${i}">Delete</button>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ''}
          <h3 style="margin:1.5rem 0 0.75rem">Published Lessons</h3>
          <div class="card-grid">
            ${!Array.isArray(lessons) || lessons.length === 0 ? '<div class="empty-state"><p>No lessons yet</p></div>' :
              lessons.map(l => `
                <div class="card lesson-card clickable" data-id="${escapeHtml(l.id)}">
                  <h3>${escapeHtml(l.title)}</h3>
                  <p style="color:var(--color-text-muted)">${escapeHtml(l.status)}</p>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#teacher-content .lesson-card.clickable").forEach(el => {
        el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, loadTeacherLessons));
      });
      document.getElementById("create-draft-btn")?.addEventListener("click", () => {
        document.getElementById("draft-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Create Lesson Draft</h3>
            <form id="draft-form" style="display:flex;flex-direction:column;gap:0.75rem">
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Title</label>
                <input class="input" name="title" placeholder="Lesson title" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">HTML Content</label>
                <textarea class="input" name="html_content" rows="12" placeholder="Write lesson content in HTML..." required style="font-family:monospace;font-size:0.85rem"></textarea>
              </div>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit">Save Draft</button>
                <button class="btn" type="button" id="cancel-draft">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-draft").addEventListener("click", () => document.getElementById("draft-form-area").innerHTML = "");
        document.getElementById("draft-form").addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          drafts.unshift({
            title: fd.get("title"),
            html_content: fd.get("html_content"),
            createdAt: Date.now(),
          });
          localStorage.setItem("casuya_teacher_drafts", JSON.stringify(drafts));
          loadTeacherLessons();
        });
      });
      document.querySelectorAll("[data-view-draft]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.viewDraft);
          const draft = drafts[idx];
          showTeacherView(`
            <div class="content">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
                <button class="btn" id="back-btn">← Back</button>
                <h2>${escapeHtml(draft.title)}</h2>
                <span style="font-size:0.75rem;padding:0.2rem 0.6rem;background:#fef3c7;color:#d97706;border-radius:var(--radius);font-weight:600">Draft</span>
              </div>
              <div class="lesson-viewer">${draft.html_content}</div>
            </div>
          `);
          document.getElementById("back-btn").addEventListener("click", loadTeacherLessons);
        });
      });
      document.querySelectorAll("[data-delete-draft]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.deleteDraft);
          drafts.splice(idx, 1);
          localStorage.setItem("casuya_teacher_drafts", JSON.stringify(drafts));
          loadTeacherLessons();
        });
      });
    } catch (err) {
      showTeacherView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  async function loadTeacherBookmarks() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading bookmarks...</p></div>');
    try {
      const data = await request("/bookmarks/");
      const bookmarks = Array.isArray(data) ? data : [];
      if (bookmarks.length === 0) {
        showTeacherView('<div class="content"><h2>Bookmarks</h2><div class="empty-state"><p>No bookmarks yet. Open a lesson and click ☆ to bookmark it.</p></div></div>');
        return;
      }
      showTeacherView(`
        <div class="content">
          <h2>Bookmarks</h2>
          <div class="card-grid" style="margin-top:1rem">
            ${bookmarks.map(b => `
              <div class="card lesson-card clickable" data-id="${escapeHtml(b.lesson_id || b.id)}" style="position:relative">
                <h3>${escapeHtml(b.lesson_title || b.title || "Untitled")}</h3>
                <span style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem">🔖</span>
              </div>
            `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#teacher-content .lesson-card.clickable").forEach(el => {
        el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, loadTeacherBookmarks));
      });
    } catch(e) {
      showTeacherView('<div class="content"><h2>Bookmarks</h2><div class="empty-state"><p>Error loading bookmarks</p></div></div>');
    }
  }

  async function loadTeacherAssignments() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading assignments...</p></div>');
    try {
      const [lessons, students, assignments] = await Promise.all([
        request("/lessons"),
        request("/students"),
        request("/assignments").catch(() => []),
      ]);
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const studentList = Array.isArray(students) ? students : [];
      const assignmentList = Array.isArray(assignments) ? assignments : [];

      showTeacherView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Assignments</h2>
            <button class="btn btn-primary" id="new-assignment-btn">+ New Assignment</button>
          </div>
          <div id="assignment-form-area"></div>
          <div style="margin-top:1rem">
            ${assignmentList.length === 0 ? '<div class="empty-state"><p>No assignments yet. Create one to assign lessons to students.</p></div>' :
              assignmentList.map((a, i) => `
                <div class="card" style="padding:1rem;margin-bottom:0.5rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(a.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml((a.lesson_title || a.lesson_id || "Unknown lesson"))}</p>
                      <p style="color:var(--color-text-muted);font-size:0.75rem;margin-top:0.15rem">Due: ${a.due_date ? new Date(a.due_date).toLocaleDateString() : "No due date"} | ${a.status}</p>
                    </div>
                    <button class="btn btn-sm btn-danger" data-delete-assignment="${a.id}">Remove</button>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.getElementById("new-assignment-btn")?.addEventListener("click", () => {
        document.getElementById("assignment-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">New Assignment</h3>
            <form id="assignment-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <div style="grid-column:1/-1">
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Title</label>
                <input class="input" name="title" placeholder="Assignment title" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Lesson</label>
                <select class="input" name="lesson_id" required>
                  <option value="">Select lesson...</option>
                  ${lessonList.map(l => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Due Date</label>
                <input class="input" type="date" name="due_date">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Notes</label>
                <input class="input" name="notes" placeholder="Optional instructions">
              </div>
              <div style="grid-column:1/-1;display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit">Create</button>
                <button class="btn" type="button" id="cancel-assignment">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-assignment").addEventListener("click", () => document.getElementById("assignment-form-area").innerHTML = "");
        document.getElementById("assignment-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/assignments?" + new URLSearchParams({
              lesson_id: fd.get("lesson_id"),
              title: fd.get("title"),
              due_date: fd.get("due_date") || "",
              notes: fd.get("notes") || "",
            }), { method: "POST" });
            loadTeacherAssignments();
          } catch(err) { alert("Failed to create assignment: " + err.message); }
        });
      });
      document.querySelectorAll("[data-delete-assignment]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.deleteAssignment;
          try {
            await request(`/assignments/${id}`, { method: "DELETE" });
            loadTeacherAssignments();
          } catch(err) { alert("Failed to delete assignment"); }
        });
      });
    } catch(e) {
      showTeacherView('<div class="content"><h2>Assignments</h2><div class="empty-state"><p>Error loading assignments</p></div></div>');
    }
  }

  async function loadTeacherReports() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading reports...</p></div>');
    try {
      const [students, lessons] = await Promise.all([
        request("/students"),
        request("/lessons"),
      ]);
      const studentList = Array.isArray(students) ? students : [];
      const lessonList = Array.isArray(lessons) ? lessons : [];

      const studentProgress = [];
      for (const s of studentList.slice(0, 20)) {
        try {
          const progress = await request(`/progress/${s.id || s.user_id}`);
          if (Array.isArray(progress)) {
            const completed = progress.filter(p => p.completion_percentage >= 100).length;
            const scores = progress.filter(p => p.score_percentage != null && p.score_percentage > 0);
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score_percentage, 0) / scores.length) : 0;
            studentProgress.push({
              name: s.full_name || "Unknown",
              id: s.id || s.user_id,
              total: progress.length,
              completed,
              avgScore,
            });
          }
        } catch(e) {}
      }

      const topStudents = [...studentProgress].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
      const mostActive = [...studentProgress].sort((a, b) => b.completed - a.completed).slice(0, 5);

      showTeacherView(`
        <div class="content">
          <h2>Class Reports</h2>
          <div class="stat-grid" style="margin:1rem 0">
            <div class="stat-card"><div class="stat-value">${studentList.length}</div><div class="stat-label">Total Students</div></div>
            <div class="stat-card"><div class="stat-value">${lessonList.length}</div><div class="stat-label">Total Lessons</div></div>
            <div class="stat-card"><div class="stat-value">${studentProgress.reduce((a, s) => a + s.completed, 0)}</div><div class="stat-label">Lessons Completed</div></div>
            <div class="stat-card"><div class="stat-value">${studentProgress.length > 0 ? Math.round(studentProgress.reduce((a, s) => a + s.avgScore, 0) / studentProgress.length) : 0}%</div><div class="stat-label">Class Average</div></div>
          </div>
          ${topStudents.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Top Performers</h3>
            <div class="card-grid">
              ${topStudents.map((s, i) => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;align-items:center;gap:0.5rem">
                    <span style="font-size:1.2rem;font-weight:700;color:var(--color-primary)">#${i + 1}</span>
                    <div>
                      <h4 style="margin:0">${escapeHtml(s.name)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin:0.15rem 0 0">Avg: ${s.avgScore}% | ${s.completed} completed</p>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ''}
          ${mostActive.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Most Active Students</h3>
            <div class="card-grid">
              ${mostActive.map(s => `
                <div class="card" style="padding:1rem">
                  <h4 style="margin:0">${escapeHtml(s.name)}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem;margin:0.25rem 0 0">${s.completed}/${s.total} lessons completed | Avg: ${s.avgScore}%</p>
                </div>
              `).join("")}
            </div>
          ` : ''}
          ${studentProgress.length === 0 ? '<div class="empty-state"><p>No student progress data available yet.</p></div>' : ''}
        </div>
      `);
    } catch(e) {
      showTeacherView('<div class="content"><h2>Reports</h2><div class="empty-state"><p>Error loading reports</p></div></div>');
    }
  }

  async function loadTeacherAIAssistant() {
    showTeacherView(`
      <div class="content">
        <h2>AI Assistant</h2>
        <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Use AI to help with teaching tasks.</p>
        <div style="display:grid;gap:1rem;margin-top:1.5rem">
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Tutoring Explanation</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Get an AI explanation for a student question.</p>
            <form id="ai-tutor-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <div style="display:flex;gap:0.5rem">
                <select class="input" name="subject_slug" style="flex:1">
                  <option value="mathematics">Mathematics</option>
                  <option value="biology" selected>Biology</option>
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
                  <option value="2" selected>Form II</option>
                  <option value="3">Form III</option>
                  <option value="4">Form IV</option>
                </select>
              </div>
              <textarea class="input" name="question" rows="3" placeholder="Enter the student's question..." required></textarea>
              <input class="input" name="context" placeholder="Optional lesson context...">
              <button class="btn btn-primary" type="submit">Get Explanation</button>
            </form>
            <div id="ai-tutor-result" style="margin-top:1rem;display:none">
              <div class="card" style="background:var(--color-bg);padding:1.25rem;border-radius:12px;border:1px solid var(--color-border)">
                <div id="ai-tutor-text" class="tutor-response"></div>
              </div>
            </div>
          </div>
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Generate Quiz Questions</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Auto-generate quiz questions from lesson content.</p>
            <form id="ai-questions-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <div style="display:flex;gap:0.5rem">
                <select class="input" name="subject_slug" style="flex:1">
                  <option value="mathematics">Mathematics</option>
                  <option value="biology">Biology</option>
                  <option value="chemistry" selected>Chemistry</option>
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
                  <option value="2" selected>Form II</option>
                  <option value="3">Form III</option>
                  <option value="4">Form IV</option>
                </select>
              </div>
              <textarea class="input" name="lesson_html" rows="5" placeholder="Paste lesson content..." required></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Number of questions:</label>
                <input class="input" type="number" name="count" value="5" min="1" max="20" style="width:80px">
              </div>
              <button class="btn btn-primary" type="submit">Generate Questions</button>
            </form>
            <div id="ai-questions-result" style="margin-top:1rem;display:none">
                <div id="ai-questions-text"></div>
            </div>
          </div>
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Translate Text</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Translate text to another language.</p>
            <form id="ai-translate-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <textarea class="input" name="text" rows="3" placeholder="Text to translate..." required></textarea>
              <select class="input" name="target_language">
                <option value="Swahili">Swahili</option>
                <option value="English">English</option>
                <option value="French">French</option>
                <option value="Arabic">Arabic</option>
                <option value="Spanish">Spanish</option>
              </select>
              <button class="btn btn-primary" type="submit">Translate</button>
            </form>
            <div id="ai-translate-result" style="margin-top:1rem;display:none">
              <div class="card" style="background:var(--color-bg);padding:1.25rem;border-radius:12px;border:1px solid var(--color-border)">
                <div id="ai-translate-text" class="tutor-response"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
    document.getElementById("ai-tutor-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const resultDiv = document.getElementById("ai-tutor-result");
      const textDiv = document.getElementById("ai-tutor-text");
      resultDiv.style.display = "block";
      textDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Thinking...</div>';
      try {
        const result = await request("/ai/tutoring/explain", {
          method: "POST",
          body: JSON.stringify({
            question: fd.get("question"),
            subject_slug: fd.get("subject_slug"),
            form_level: parseInt(fd.get("form_level")) || 2,
            lesson_context: fd.get("context") || undefined,
          }),
        });
        const raw = result?.explanation || result?.answer || result?.response || JSON.stringify(result);
        textDiv.innerHTML = renderTutorMarkdown(raw);
      } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
    });
    document.getElementById("ai-questions-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const resultDiv = document.getElementById("ai-questions-result");
      const textDiv = document.getElementById("ai-questions-text");
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
        } else {
          textDiv.innerHTML = '<p style="color:var(--color-text-muted)">No questions generated. Try different content.</p>';
        }
      } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
    });
    document.getElementById("ai-translate-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const resultDiv = document.getElementById("ai-translate-result");
      const textDiv = document.getElementById("ai-translate-text");
      resultDiv.style.display = "block";
      textDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Translating...</div>';
      try {
        const result = await request("/ai/content/translate", {
          method: "POST",
          body: JSON.stringify({ text: fd.get("text"), target_language: fd.get("target_language") }),
        });
        const raw = result?.translated || result?.translatedText || result?.text || JSON.stringify(result);
        textDiv.innerHTML = renderTutorMarkdown(raw);
      } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
    });
  }

  async function loadTeacherFiles() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading files...</p></div>');
    try {
      const files = await request("/uploads/public").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];
      let activeFilter = "all";

      function renderTeacherFiles() {
        let filtered = fileList;
        if (activeFilter !== "all") {
          if (activeFilter === "images") filtered = fileList.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.filename || f.path || ""));
          else if (activeFilter === "documents") filtered = fileList.filter(f => /\.(pdf|doc|docx|txt)$/i.test(f.filename || f.path || ""));
          else if (activeFilter === "media") filtered = fileList.filter(f => /\.(mp4|webm|mp3|wav|ogg)$/i.test(f.filename || f.path || ""));
        }
        const grid = document.getElementById("teacher-files-grid");
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

      showTeacherView(`
        <div class="content">
          <h2>📂 Files & Resources</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Browse uploaded teaching materials and resources.</p>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn-filter teacher-files-filter active" data-filter="all">All</button>
            <button class="btn-filter teacher-files-filter" data-filter="images">🖼️ Images</button>
            <button class="btn-filter teacher-files-filter" data-filter="documents">📄 Documents</button>
            <button class="btn-filter teacher-files-filter" data-filter="media">🎬 Media</button>
          </div>
          <div id="teacher-files-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.5rem"></div>
        </div>
      `);
      document.querySelectorAll(".teacher-files-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".teacher-files-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderTeacherFiles();
        });
      });
      renderTeacherFiles();
    } catch(e) { showTeacherView('<div class="empty-state"><p>Error loading files</p></div>'); }
  }

  async function loadTeacherPayments() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
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

      function renderTeacherTab(tabId) {
        if (tabId === "payments") {
          return `
            <div class="card" style="padding:0;max-width:560px;margin-top:1rem;overflow:hidden">
              <div class="checkout-header">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <h3>Make a Payment</h3>
              </div>
              <form id="teacher-payment-form" class="checkout-body">
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
                <button class="btn btn-success btn-block" type="submit" id="teacher-payment-submit-btn">Pay Now</button>
              </form>
              <div id="teacher-payment-result" style="padding:0 1.5rem 1.5rem"></div>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                <h3>Payment History</h3>
                <button class="btn btn-sm" id="teacher-refresh-tx-btn">Refresh</button>
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

      showTeacherView(`
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
            <button class="tab-btn active" data-ttab="payments">💳 Payments</button>
            <button class="tab-btn" data-ttab="subscriptions">🔄 Subscriptions</button>
            <button class="tab-btn" data-ttab="invoices">📄 Invoices</button>
          </div>
          <div id="teacher-payment-tab-content">${renderTeacherTab("payments")}</div>
        </div>
      `);

      document.querySelectorAll("[data-ttab]").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("[data-ttab]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          document.getElementById("teacher-payment-tab-content").innerHTML = renderTeacherTab(btn.dataset.ttab);
          bindTeacherPaymentForm();
        });
      });

      function bindTeacherPaymentForm() {
        let teacherPaymentInProgress = false;
        document.getElementById("teacher-payment-form")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const btn = document.getElementById("teacher-payment-submit-btn");
          if (teacherPaymentInProgress) return;
          teacherPaymentInProgress = true;
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
            document.getElementById("teacher-payment-result").innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(result.id || "")}</span></div></div>`;
            loadTeacherPayments();
          } catch (err) {
            document.getElementById("teacher-payment-result").innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
          }
          teacherPaymentInProgress = false;
          btn.innerHTML = 'Pay Now';
          btn.disabled = false;
        });
      }
      bindTeacherPaymentForm();
      document.getElementById("teacher-refresh-tx-btn")?.addEventListener("click", loadTeacherPayments);
    } catch(e) { showTeacherView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
  }

  async function loadTeacherNotifications() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
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
        const el = document.getElementById("teacher-notif-list");
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
              ${!n.is_read ? `<button class="btn btn-primary btn-xs teacher-notif-read" data-id="${n.id}">✓ Read</button>` : ""}
            </div>
          </div>
        `).join("");
        document.querySelectorAll(".teacher-notif-read").forEach(btn => {
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

      showTeacherView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>🔔 Notifications</h2>
            <button class="btn btn-ghost btn-sm" id="teacher-mark-all-read">✓ Mark All Read</button>
          </div>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter teacher-notif-filter active" data-filter="all">All <span class="filter-count">${allNotifs.length}</span></button>
            <button class="btn-filter teacher-notif-filter" data-filter="unread">🔴 Unread <span class="filter-count">${unread.length}</span></button>
            <button class="btn-filter teacher-notif-filter" data-filter="read">✅ Read <span class="filter-count">${read.length}</span></button>
          </div>
          <div id="teacher-notif-list" style="margin-top:0.75rem"></div>
        </div>
      `);
      document.querySelectorAll(".teacher-notif-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          showFilter = btn.dataset.filter;
          document.querySelectorAll(".teacher-notif-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === showFilter));
          render();
        });
      });
      document.getElementById("teacher-mark-all-read")?.addEventListener("click", async () => {
        for (const n of unread) {
          try { await request(`/notifications/${n.id}/read`, { method: "POST" }); n.is_read = true; } catch(e) {}
        }
        unread.length = 0; read.length = 0; read.push(...allNotifs);
        const badge = document.getElementById("notif-badge");
        if (badge) badge.style.display = "none";
        render();
      });
      render();
    } catch(e) { showTeacherView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
  }

  async function loadTeacherSettings() {
    showTeacherView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [me, profile] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/teachers/me").catch(() => ({})),
      ]);
      const activeTab = localStorage.getItem("teacher_settings_tab") || "profile";

      function renderTab(tab) {
        localStorage.setItem("teacher_settings_tab", tab);
        document.querySelectorAll(".teacher-settings-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        const panel = document.getElementById("teacher-settings-panel");
        if (!panel) return;

        if (tab === "profile") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">My Profile</h3>
              <form id="teacher-profile-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Full Name</label>
                  <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" placeholder="Your name">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Email</label>
                  <input class="input" value="${escapeHtml(me.email || "")}" disabled style="opacity:0.6">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Phone</label>
                  <input class="input" name="phone" value="${escapeHtml(me.phone || "")}" placeholder="Phone number">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Subjects</label>
                  <input class="input" name="subjects" value="${escapeHtml(profile.subjects || "")}" placeholder="e.g. Mathematics, Physics">
                </div>
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">💾 Save Changes</button>
              </form>
              <p id="teacher-profile-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
            </div>
          `;
          document.getElementById("teacher-profile-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("teacher-profile-msg");
            try {
              await request("/users/me", { method: "PATCH", body: JSON.stringify({ phone: fd.get("phone") }) });
              await request("/teachers/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), subjects: fd.get("subjects") }) });
              msg.textContent = "✅ Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "block";
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "block"; }
          });
        } else if (tab === "password") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Change Password</h3>
              <form id="teacher-pw-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">
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
              <p id="teacher-pw-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
            </div>
          `;
          document.getElementById("teacher-pw-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("teacher-pw-msg");
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

      showTeacherView(`
        <div class="content">
          <h2>⚙️ Settings</h2>
          <div class="tab-bar">
            <button class="tab-btn teacher-settings-tab${activeTab === "profile" ? " active" : ""}" data-tab="profile">👤 Profile</button>
            <button class="tab-btn teacher-settings-tab${activeTab === "password" ? " active" : ""}" data-tab="password">🔒 Password</button>
            <button class="tab-btn teacher-settings-tab${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">🎨 Appearance</button>
          </div>
          <div id="teacher-settings-panel"></div>
        </div>
      `);
      document.querySelectorAll(".teacher-settings-tab").forEach(btn => {
        btn.addEventListener("click", () => renderTab(btn.dataset.tab));
      });
      renderTab(activeTab);
    } catch(e) { showTeacherView('<div class="empty-state"><p>Error loading settings</p></div>'); }
  }

  loadNotifs();
  // Load initial view from URL hash, fallback to overview
  const initialView = location.hash.slice(1) || "overview";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadTeacherOverview();
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
