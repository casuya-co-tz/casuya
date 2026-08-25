// ===== modules/api.js =====
// modules/api.js — extracted from main.js (classic script, shared global scope)
const API_HOST = window.location.hostname || "localhost";

const API_PROTOCOL = (window.location.protocol === "http:" || window.location.protocol === "https:")
  ? window.location.protocol
  : "http:";

const API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
  : (window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
    ? window.location.origin
    : `${API_PROTOCOL}//${API_HOST}:8765`;

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

// ===== modules/appearance.js =====
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

// ===== modules/lesson.js =====
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
    trackVideos(document.body);
    detectScore();
    var obs = new MutationObserver(function() { detectScore(); trackVideos(document.body); });
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

    // Fetch bookmark, quiz, games, notes in parallel
    let bookmarked = false;
    let quizData = null;
    let gamesData = [];
    let noteData = { content: "" };
    if (canBookmark) {
      try {
        [bookmarked, quizData, gamesData, noteData] = await Promise.all([
          request(`/bookmarks/${lessonId}/status`).then(r => r.bookmarked).catch(() => false),
          isStudent ? request(`/quizzes/by-lesson/${lessonId}`).catch(() => null) : null,
          isStudent ? request(`/games/by-lesson/${lessonId}`).catch(() => []) : [],
          isStudent ? request(`/notes/${lessonId}`).catch(() => ({ content: "" })) : { content: "" },
        ]);
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

// ===== modules/auth.js =====
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

// ===== modules/dashboards.js =====
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

// ===== modules/student-dashboard.js =====
// modules/student-dashboard.js — extracted from main.js (classic script, shared global scope)
async function renderStudentDashboard() {
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
          <div class="sidebar-nav-item" data-view="subjects">📚 Subjects</div>
          <div class="sidebar-nav-item" data-view="progress">📊 Progress</div>
          <div class="sidebar-nav-item" data-view="bookmarks">🔖 Bookmarks</div>
          <div class="sidebar-nav-item" data-view="assignments">📋 Assignments</div>
          <div class="sidebar-nav-item" data-view="games">🎮 Games</div>
          <div class="sidebar-nav-item" data-view="downloads">📥 Downloads</div>
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
    style.textContent = `@media(max-width:768px){.sidebar{position:fixed;z-index:200;left:-260px;transition:left .25s ease;height:100vh}.sidebar.open{left:0;box-shadow:4px 0 20px rgba(0,0,0,.15)}.sidebar-toggle-btn{display:block!important}}`;
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

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.style.display = "none"; return; }
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
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
    subjects: () => { setActiveNav("subjects"); loadStudentSubjects(); },
    progress: () => { setActiveNav("progress"); loadStudentProgress(); },
    bookmarks: () => { setActiveNav("bookmarks"); loadStudentBookmarks(); },
    assignments: () => { setActiveNav("assignments"); loadStudentAssignments(); },
    games: () => { setActiveNav("games"); loadStudentGames(); },
    downloads: () => { setActiveNav("downloads"); loadStudentDownloads(); },
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

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "dashboard";
    if (navHandlers[view]) navHandlers[view]();
  });

  // Load dashboard overview
  async function loadStudentOverview() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading dashboard...</p></div>');
    try {
      const [subjects, profile] = await Promise.all([
        request("/subjects"),
        request("/students/me").catch(() => null),
      ]);

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
      const topics = await request("/topics");
      const formFilter = localStorage.getItem("casuya_form_filter") || "";
      let filtered = Array.isArray(topics) ? topics.filter(t => t.subject_id === subjectId) : [];
      if (formFilter) {
        filtered = filtered.filter(t => !t.form_level || t.form_level === formFilter || t.form_level === formFilter.replace(/^Form /, ""));
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
      const subtopics = await request("/subtopics");
      const filtered = Array.isArray(subtopics) ? subtopics.filter(s => s.topic_id === topicId) : [];
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
      const lessons = await request("/lessons/?status=published");
      const filtered = Array.isArray(lessons) ? lessons.filter(l => l.subtopic_id === subtopicId) : [];
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
        <div class="card" style="padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Complete on Blackboard</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Show your working below, then click Submit Work when done.</p>
          <div data-blackboard data-lesson-id="assignment-${assignmentId}" data-assignment-id="${assignmentId}" data-student-id="${escapeHtml(studentId || "")}" style="width:100%;height:480px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
        <div id="assignment-result" style="margin-top:0.75rem"></div>
      `);
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      document.getElementById("back-btn").addEventListener("click", loadStudentAssignments);
      document.getElementById("submit-assignment-btn").addEventListener("click", async () => {
        const bbEl = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
        const bb = bbEl && bbEl._casuyaBlackboard;
        if (!bb) { showToast("Blackboard not loaded"); return; }
        const btn = document.getElementById("submit-assignment-btn");
        btn.disabled = true; btn.textContent = "Submitting...";
        try {
          const elements = bb.getElements ? bb.getElements() : [];
          await request(`/assignments/${assignmentId}/submit`, {
            method: "POST",
            body: JSON.stringify({
              student_id: studentId || "anonymous",
              elements_json: JSON.stringify(elements),
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
      const gameList = Array.isArray(games) ? games : [];

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
        iframe.srcdoc = contentResp.replace("<head>", `<head><base href="${API_BASE}/">`);
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
  async function viewStudentLesson(lessonId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      let lesson;
      try {
        lesson = await request(`/lessons/${lessonId}`);
      } catch(e) {
        const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
        const filtered = recent.filter(r => r.id !== lessonId);
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        showStudentView('<div class="empty-state"><p>This lesson is no longer available.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>');
        document.getElementById("back-to-overview")?.addEventListener("click", loadStudentOverview);
        return;
      }
      const [bookmarkStatus, noteData, contentResp, quizData, gamesData] = await Promise.all([
        request(`/bookmarks/${lessonId}/status`).catch(() => ({ bookmarked: false })),
        request(`/notes/${lessonId}`).catch(() => ({ content: "" })),
        fetch(`${API_BASE}/lessons/${lessonId}/content`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
        }).then(r => r.ok ? r.text() : ""),
        request(`/quizzes/by-lesson/${lessonId}`).catch(() => null),
        request(`/games/by-lesson/${lessonId}`).catch(() => []),
      ]);
      const isBookmarked = bookmarkStatus?.bookmarked || false;
      const lessonContent = contentResp || "<p>No content</p>";

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
        iframe.srcdoc = lessonContent.replace("<head>", `<head><base href="${API_BASE}/">`);
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
          const students = await request("/students");
          if (Array.isArray(students)) {
            const my = students.find(s => s.user_id === studentTokenPayload.sub || s.id === studentTokenPayload.sub);
            if (my) studentId = my.id || my.user_id;
          }
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
                <iframe style="width:100%;border:none;min-height:300px" srcdoc="${escapeHtml(html)}"></iframe>
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
      document.getElementById("student-refresh-tx-btn")?.addEventListener("click", loadStudentPayments);
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
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
        for (const n of unread) {
          try { await request(`/notifications/${n.id}/read`, { method: "POST" }); n.is_read = true; } catch(e) {}
        }
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

// ===== modules/admin-dashboard/00-shell.js =====
﻿// modules/admin-dashboard.js â€” extracted from main.js (classic script, shared global scope)
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
          <div class="sidebar-nav-item active" data-view="dashboard">ðŸ“Š Dashboard</div>
          <div class="sidebar-nav-item" data-view="subjects">ðŸ“š Subjects</div>
          <div class="sidebar-nav-item" data-view="topics">ðŸ“ Topics</div>
          <div class="sidebar-nav-item" data-view="subtopics">ðŸ“‚ Subtopics</div>
          <div class="sidebar-nav-item" data-view="lessons">ðŸ“ Lessons</div>
          <div class="sidebar-nav-item" data-view="quizzes">â“ Quizzes</div>
          <div class="sidebar-nav-item" data-view="games">ðŸŽ® Games</div>
          <div class="sidebar-nav-item" data-view="users">ðŸ‘¥ Users</div>
          <div class="sidebar-nav-item" data-view="progress">ðŸ“ˆ Progress</div>
          <div class="sidebar-nav-item" data-view="analytics">ðŸ“‰ Analytics</div>
          <div class="sidebar-nav-item" data-view="payments">ðŸ’³ Payments</div>
          <div class="sidebar-nav-item" data-view="notifications">ðŸ”” Notifications</div>
          <div class="sidebar-nav-item" data-view="uploads">ðŸ“¤ Uploads</div>
          <div class="sidebar-nav-item" data-view="branding">ðŸŽ¨ Branding</div>
          <div class="sidebar-nav-item" data-view="settings">âš™ï¸ Settings</div>
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


// ===== modules/admin-dashboard/01-overview.js =====
﻿  async function loadAdminOverview() {
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
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">ðŸ‘¥</div>
              <div class="stat-value">${overview?.total_students ?? 0}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">ðŸ‘©â€ðŸ«</div>
              <div class="stat-value">${overview?.total_teachers ?? 0}</div>
              <div class="stat-label">Teachers</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">ðŸ“</div>
              <div class="stat-value">${overview?.total_lessons ?? 0}</div>
              <div class="stat-label">Lessons</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">â“</div>
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
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ“š</div>
              <h4 style="margin:0">Manage Subjects</h4>
            </div>
            <div class="recent-lesson-card" data-nav="lessons" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ“</div>
              <h4 style="margin:0">Manage Lessons</h4>
            </div>
            <div class="recent-lesson-card" data-nav="users" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ‘¥</div>
              <h4 style="margin:0">Manage Users</h4>
            </div>
            <div class="recent-lesson-card" data-nav="progress" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ“ˆ</div>
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
            <h2>${subjectId ? escapeHtml(subjectName) + " â€” " : ""}Topics</h2>
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
            <h2>${topicId ? escapeHtml(topicTitle) + " â€” " : ""}Subtopics</h2>
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
            <h2>${escapeHtml(subtopicTitle)} â€” Lessons</h2>
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


// ===== modules/admin-dashboard/02-lessons-quizzes-games.js =====
﻿  async function loadAdminProgress() {
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
            <div class="card" style="padding:0.75rem"><h4>Students</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(students) ? students.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Teachers</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(teachers) ? teachers.length : 0}</p></div>
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
              <button class="btn btn-primary" id="ai-generate-questions-btn">ðŸ¤– AI Generate Questions</button>
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
          <div class="card" style="margin-bottom:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">AI Generate Quiz Questions</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Paste lesson content to auto-generate quiz questions.</p>
            <form id="ai-gen-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <textarea class="input" name="lesson_html" rows="8" placeholder="Paste lesson HTML content here..." required style="font-family:monospace;font-size:0.85rem"></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Questions:</label>
                <input class="input" type="number" name="count" value="5" min="1" max="20" style="width:80px">
                <button class="btn btn-primary" type="submit">Generate</button>
                <button class="btn" type="button" id="cancel-ai-gen">Cancel</button>
              </div>
            </form>
            <div id="ai-gen-result" style="margin-top:1rem;display:none">
              <div class="card" style="background:var(--color-bg);padding:1rem">
                <h4 style="margin:0 0 0.5rem">Generated Questions</h4>
                <pre id="ai-gen-text" style="font-size:0.85rem;line-height:1.5;white-space:pre-wrap;overflow-x:auto"></pre>
                <button class="btn btn-sm btn-primary" id="copy-ai-gen" style="margin-top:0.5rem">Copy to Clipboard</button>
              </div>
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
          textDiv.textContent = "Generating...";
          try {
            const result = await request("/ai/questions/generate", {
              method: "POST",
              body: JSON.stringify({ lesson_html: fd.get("lesson_html"), count: parseInt(fd.get("count")) || 5 }),
            });
            const questions = result?.questions || result;
            textDiv.textContent = typeof questions === "string" ? questions : JSON.stringify(questions, null, 2);
          } catch(err) { textDiv.textContent = "Error: " + err.message; }
        });
        document.getElementById("copy-ai-gen")?.addEventListener("click", () => {
          const text = document.getElementById("ai-gen-text").textContent;
          navigator.clipboard?.writeText(text).then(() => showToast("Copied!")).catch(() => {});
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
          iframe.srcdoc = html.replace("<head>", `<head><base href="${API_BASE}/">`);
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
              ${q.options.map(o => `<p style="font-size:0.85rem;margin:0.15rem 0;padding-left:1rem">â€¢ ${escapeHtml(o.text)}</p>`).join("")}
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
        iframe.srcdoc = htmlContent;
        iframe.onload = () => {
          try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
        };
      }
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading quiz</p></div>'); }
  }


// ===== modules/admin-dashboard/03-users.js =====
﻿  async function loadAdminGames() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games/");
      const list = Array.isArray(games) ? games : [];
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
        iframe.srcdoc = htmlContent;
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
      const sList = Array.isArray(students) ? students : [];
      const tList = Array.isArray(teachers) ? teachers : [];
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
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.email || "")} ${s.form_level ? "Â· " + escapeHtml(s.form_level) : ""}</p>
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
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.email || "")} ${t.subjects ? "Â· " + escapeHtml(t.subjects) : ""}</p>
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
            <button class="btn" id="back-btn">â† Back</button>
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
                <div class="stat-icon" style="background:#eff6ff;color:#2563eb">ðŸ“š</div>
                <div class="stat-value">${progressList.length}</div>
                <div class="stat-label">Lessons Attempted</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">âœ…</div>
                <div class="stat-value">${totalCompleted}</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#fef3c7;color:#d97706">ðŸ“ˆ</div>
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
                      <span style="font-size:0.85rem;color:var(--color-text-muted)">${data.completed}/${data.total} Â· ${pct}%</span>
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
      showAdminView(`<div class="empty-state"><p>Error loading user details</p><button class="btn" id="back-btn">â† Back</button></div>`);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    }
  }


// ===== modules/admin-dashboard/04-payments-notif-uploads.js =====
﻿  async function loadAdminPayments() {
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
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">ðŸ’°</div>
              <div class="stat-value">${totalRevenue.toLocaleString()}</div>
              <div class="stat-label">Total Revenue (TZS)</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">âœ…</div>
              <div class="stat-value">${completedCount}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">â³</div>
              <div class="stat-value">${pendingCount}</div>
              <div class="stat-label">Pending</div>
            </div>
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
                  <p style="margin:0.25rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">${n.created_at ? new Date(n.created_at).toLocaleString() : ""} Â· ${n.is_read ? "Read" : "Unread"}</p>
                </div>
                <div style="display:flex;gap:0.25rem;flex-shrink:0">
                  ${!n.is_read ? `<button class="btn btn-primary btn-xs notif-mark-read" data-id="${n.id}">âœ“ Read</button>` : ""}
                </div>
              </div>
            </div>
          `).join("");
        }

        const pag = document.getElementById("notif-pagination");
        if (totalPages <= 1) { pag.innerHTML = ""; return; }
        pag.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin-top:1rem">
            <button class="btn btn-ghost btn-sm notif-page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>â† Prev</button>
            <span style="font-size:0.85rem;color:var(--color-text-muted)">Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-ghost btn-sm notif-page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>Next â†’</button>
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
            <h2>ðŸ”” Notifications</h2>
            <button class="btn btn-primary btn-pattern" id="notif-send-btn">âœ‰ï¸ Send Notification</button>
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
                <button class="btn btn-success btn-pattern" type="submit">ðŸ“¤ Send Notification</button>
                <button class="btn btn-ghost" type="button" id="notif-cancel-send">Cancel</button>
                <p id="notif-send-status" style="font-size:0.85rem;display:none;margin:0"></p>
              </div>
            </form>
          </div>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter notif-filter-btn active" data-filter="all">All</button>
            <button class="btn-filter notif-filter-btn" data-filter="unread">ðŸ”´ Unread</button>
            <button class="btn-filter notif-filter-btn" data-filter="read">âœ… Read</button>
            <input type="search" class="input" id="notif-search" placeholder="Search notifications..." style="max-width:240px;padding:0.35rem 0.6rem;font-size:0.85rem">
            <button class="btn btn-ghost btn-sm" id="notif-mark-all" style="margin-left:auto">âœ“ Mark All Read</button>
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
          const icon = isImage ? "ðŸ–¼ï¸" : isVideo ? "ðŸŽ¬" : isAudio ? "ðŸŽµ" : "ðŸ“„";
          return `
            <div class="card upload-card" style="padding:0.75rem;cursor:pointer" data-filename="${escapeHtml(name)}">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="upload-display-name">${escapeHtml(displayName)}</p>
                  <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${f.size ? (f.size / 1024).toFixed(1) + " KB" : ""} Â· ${f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ""}</p>
                  ${!isVisible ? '<span style="display:inline-block;margin-top:0.25rem;font-size:0.65rem;padding:0.1rem 0.4rem;background:#fee2e2;color:#dc2626;border-radius:4px">Hidden</span>' : ""}
                </div>
                <div style="display:flex;flex-direction:column;gap:0.25rem;flex-shrink:0">
                   <button class="btn btn-xs upload-rename-btn" data-filename="${escapeHtml(name)}" data-display="${escapeHtml(displayName)}" title="Rename">âœï¸</button>
                   <button class="btn btn-xs upload-vis-btn" data-filename="${escapeHtml(name)}" data-visible="${isVisible}" title="${isVisible ? 'Hide from students & teachers' : 'Show to students & teachers'}">${isVisible ? "ðŸ‘ï¸" : "ðŸš«"}</button>
                   <button class="btn btn-outline-danger btn-xs upload-delete-btn" data-filename="${escapeHtml(name)}" title="Delete file">âœ•</button>
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
          <h2>ðŸ“ Uploads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Manage uploaded files. Control visibility for students and teachers.</p>

          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">ðŸ“¤ Upload New File</h3>
            <form id="upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <p style="font-size:0.8rem;color:var(--color-text-muted);margin:0">Supports images (png, jpg, gif, svg, webp), documents (pdf, doc), videos (mp4, webm), audio (mp3, wav, ogg)</p>
              <input class="input" type="file" id="upload-file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" required>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <button class="btn btn-success btn-pattern" type="submit" id="upload-submit-btn" style="width:100%">ðŸ“¤ Upload File</button>
              </div>
            </form>
            <div id="upload-result" style="margin-top:0.5rem"></div>
          </div>

          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter upload-filter-btn active" data-filter="all">All <span class="filter-count">${fileList.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="images">ðŸ–¼ï¸ Images <span class="filter-count">${imageFiles.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="documents">ðŸ“„ Documents <span class="filter-count">${docFiles.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="media">ðŸŽ¬ Media <span class="filter-count">${mediaFiles.length}</span></button>
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


// ===== modules/admin-dashboard/05-branding-analytics-settings.js =====
﻿  async function loadAdminBranding() {
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
        <h2>ðŸŽ¨ Site Branding</h2>
        <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:1.5rem">Upload your logo and favicon. These appear across the entire platform.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
          <!-- Logo -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">ðŸ–¼ï¸ Logo</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${logoExists
                ? `<img src="${API}/branding/logo?t=${Date.now()}" alt="Current logo" style="max-width:120px;max-height:120px;border-radius:12px;border:1px solid var(--color-border)">`
                : `<div style="width:120px;height:120px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${logoExists ? "âœ… Custom logo active" : "Using default"}</p>
            </div>
            <form id="logo-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="logo-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${logoExists ? "ðŸ”„ Replace" : "ðŸ“¤ Upload"}</button>
                ${logoExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="logo-delete">ðŸ—‘ï¸ Delete</button>' : ''}
              </div>
            </form>
            <div id="logo-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>

          <!-- Favicon -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">ðŸ·ï¸ Favicon</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${faviconExists
                ? `<img src="${API}/branding/favicon?t=${Date.now()}" alt="Current favicon" style="width:64px;height:64px;border-radius:8px;border:1px solid var(--color-border)">`
                : `<div style="width:64px;height:64px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${faviconExists ? "âœ… Custom favicon active" : "Using default"}</p>
            </div>
            <form id="favicon-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="favicon-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${faviconExists ? "ðŸ”„ Replace" : "ðŸ“¤ Upload"}</button>
                ${faviconExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="favicon-delete">ðŸ—‘ï¸ Delete</button>' : ''}
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
                  <h4 style="margin:0 0 0.25rem">${escapeHtml(d.subject || d.topic || "Unknown")}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">${d.count ?? 0} lessons</p>
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
      const [profile, branding] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/branding/logo").catch(() => null),
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
                  <button class="btn btn-primary" type="submit">ðŸ’¾ Save Profile</button>
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
              msg.textContent = "âœ… Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "âŒ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
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
                  <button class="btn btn-primary btn-pattern" type="submit">ðŸ” Update Password</button>
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
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin:0.15rem 0 0">Now Â· ${navigator.userAgent.slice(0, 60)}...</p>
                </div>
                <span style="color:var(--color-success);font-size:0.8rem;font-weight:600">ðŸŸ¢ Active</span>
              </div>
            </div>
          `;
          document.getElementById("admin-pw-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("admin-pw-msg");
            if (fd.get("new_password") !== fd.get("confirm_password")) {
              msg.textContent = "âŒ Passwords do not match"; msg.style.color = "var(--color-danger)"; msg.style.display = "inline";
              return;
            }
            try {
              await request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), new_password: fd.get("new_password") }) });
              msg.textContent = "âœ… Password updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              e.target.reset();
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "âŒ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
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
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">ðŸ’¾ Save Preferences</button>
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
                <button class="btn btn-primary btn-pattern" type="submit">ðŸ“¤ Send</button>
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
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Platform Information</h3>
              <div style="display:grid;gap:0">
                <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
                  <span style="color:var(--color-text-muted);font-size:0.9rem">Platform Name</span>
                  <strong style="font-size:0.9rem">Casuya Ecosystem</strong>
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
                  <span style="font-size:0.9rem;color:var(--color-success);font-weight:600">â— Online</span>
                </div>
              </div>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3 style="margin-bottom:0.75rem">âš ï¸ Danger Zone</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">Irreversible actions</p>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                <button class="btn btn-danger btn-sm btn-pattern" id="clear-cache-btn">ðŸ—‘ï¸ Clear Cache</button>
                <button class="btn btn-outline-danger btn-sm" id="export-data-btn">ðŸ“¦ Export All Data</button>
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
        } else if (tab === "appearance") {
          panel.innerHTML = appearancePanelHTML();
          setupAppearanceControls();
        }
      }

      showAdminView(`
        <div class="content">
          <h2>Settings</h2>
          <div class="tab-bar">
            <button class="tab-btn settings-tab-btn${activeTab === "profile" ? " active" : ""}" data-tab="profile">ðŸ‘¤ Profile</button>
            <button class="tab-btn settings-tab-btn${activeTab === "security" ? " active" : ""}" data-tab="security">ðŸ”’ Security</button>
            <button class="tab-btn settings-tab-btn${activeTab === "notifications" ? " active" : ""}" data-tab="notifications">ðŸ”” Notifications</button>
            <button class="tab-btn settings-tab-btn${activeTab === "platform" ? " active" : ""}" data-tab="platform">âš™ï¸ Platform</button>
            <button class="tab-btn settings-tab-btn${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">ðŸŽ¨ Appearance</button>
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

// ===== modules/teacher-dashboard.js =====
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

// ===== main.js (glue) =====
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

