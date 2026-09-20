// modules/student/ai-chat.js — in-lesson AI tutor bottom sheet (lazy-loaded).

(function () {
  "use strict";

  var SHEET_ID = "casuya-ai-chat-sheet";
  var FAB_ID = "casuya-ai-chat-fab";
  var _ctx = null;
  var _messages = [];

  function langPref() {
    return localStorage.getItem("casuya_tutor_lang") || "both";
  }

  function setLangPref(value) {
    localStorage.setItem("casuya_tutor_lang", value);
    var sel = document.getElementById("casuya-ai-lang");
    if (sel) sel.value = value;
  }

  function headingPrompts(html) {
    var prompts = [];
    String(html || "").replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, function (_, t) {
      var text = String(t).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length >= 4 && text.length <= 80) prompts.push("Eleza: " + text);
      return "";
    });
    return prompts.slice(0, 3);
  }

  function suggestedPrompts(ctx) {
    var title = (ctx && ctx.lesson && ctx.lesson.title) ? ctx.lesson.title : "this topic";
    var fromHeadings = headingPrompts((ctx && ctx.lessonContent) || "");
    var base = [
      "Eleza " + title + " kwa Kiswahili rahisi.",
      "NECTA huuliza vipi kuhusu hili?",
      "Toa mfano wa Tanzania.",
      "What is the main idea in one sentence?",
    ];
    return fromHeadings.concat(base).slice(0, 6);
  }

  function renderMessages() {
    var list = document.getElementById("casuya-ai-chat-messages");
    if (!list) return;
    if (!_messages.length) {
      list.innerHTML = '<p class="casuya-ai-chat-empty">Uliza swali kuhusu somo hili. AI itajibu kwa muundo wa NECTA.</p>';
      return;
    }
    list.innerHTML = _messages.map(function (m) {
      if (m.role === "user") {
        return (
          '<div class="casuya-ai-chat-bubble casuya-ai-chat-bubble-user">'
          + '<div class="casuya-ai-chat-bubble-label">Wewe</div>'
          + "<p>" + escapeHtml(m.text) + "</p></div>"
        );
      }
      return (
        '<div class="casuya-ai-chat-bubble casuya-ai-chat-bubble-tutor">'
        + '<div class="casuya-ai-chat-bubble-label">AI Mwalimu</div>'
        + (m.html || renderTutorThinking("Inaandika…"))
        + "</div>"
      );
    }).join("");
    list.scrollTop = list.scrollHeight;
  }

  function sheetHtml() {
    return (
      '<div id="' + SHEET_ID + '" class="casuya-ai-chat-sheet" hidden>'
      + '<div class="casuya-ai-chat-backdrop" data-ai-chat-close></div>'
      + '<div class="casuya-ai-chat-panel" role="dialog" aria-label="Ask AI tutor">'
      + '<div class="casuya-ai-chat-header">'
      + '<div><strong>Uliza AI</strong>'
      + '<div class="casuya-ai-chat-sub">Msaada wa somo — muundo wa NECTA</div></div>'
      + '<div class="casuya-ai-chat-header-actions">'
      + '<select id="casuya-ai-lang" class="input casuya-ai-lang-select" aria-label="Answer language">'
      + '<option value="both">SW + EN</option>'
      + '<option value="sw">Kiswahili</option>'
      + '<option value="en">English</option>'
      + '</select>'
      + '<button type="button" class="btn-icon casuya-ai-chat-close" data-ai-chat-close aria-label="Close">✕</button>'
      + '</div></div>'
      + '<div id="casuya-ai-chat-messages" class="casuya-ai-chat-messages"></div>'
      + '<div id="casuya-ai-chat-suggestions" class="casuya-ai-chat-suggestions"></div>'
      + '<form id="casuya-ai-chat-form" class="casuya-ai-chat-form">'
      + '<div class="casuya-ai-chat-input-row">'
      + '<textarea id="casuya-ai-chat-input" class="input" rows="2" placeholder="Andika swali lako…" required></textarea>'
      + '<button type="button" class="casuya-record casuya-ai-chat-mic" data-target="#casuya-ai-chat-input" title="Speak your question" aria-label="Speak your question">🎤</button>'
      + '</div>'
      + '<button type="submit" class="btn btn-primary casuya-ai-chat-submit">Tuma swali</button>'
      + '</form>'
      + '</div></div>'
    );
  }

  function renderSuggestions() {
    var wrap = document.getElementById("casuya-ai-chat-suggestions");
    if (!wrap || !_ctx) return;
    wrap.innerHTML = suggestedPrompts(_ctx).map(function (p) {
      return '<button type="button" class="casuya-ai-chip" data-ai-suggest="' + escapeHtml(p) + '">' + escapeHtml(p) + "</button>";
    }).join("");
  }

  function openSheet() {
    var sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add("casuya-ai-chat-open");
    renderSuggestions();
    var langSel = document.getElementById("casuya-ai-lang");
    if (langSel) langSel.value = langPref();
    var input = document.getElementById("casuya-ai-chat-input");
    if (input) input.focus();
  }

  function closeSheet() {
    var sheet = document.getElementById(SHEET_ID);
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("casuya-ai-chat-open");
  }

  function askQuestion(question) {
    question = String(question || "").trim();
    if (!question || !_ctx) return;

    _messages.push({ role: "user", text: question });
    var tutorIdx = _messages.length;
    _messages.push({ role: "tutor", html: renderTutorThinking("Inafikiria…") });
    renderMessages();
    persistThread();

    var threadedQuestion = typeof buildTutorThreadQuestion === "function"
      ? buildTutorThreadQuestion(_messages.slice(0, -2), question)
      : question;
    var payload = buildLessonTutorPayload({
      question: threadedQuestion,
      lesson: _ctx.lesson,
      lessonId: _ctx.lessonId,
      lessonContent: _ctx.lessonContent,
      iframeText: _ctx.iframeText,
      subject_slug: _ctx.subject_slug,
      form_level: _ctx.form_level,
      language: langPref(),
      messages: typeof buildTutorMessagesArray === "function"
        ? buildTutorMessagesArray(_messages.slice(0, -2))
        : undefined,
    });

    var list = document.getElementById("casuya-ai-chat-messages");
    var bubbles = list ? list.querySelectorAll(".casuya-ai-chat-bubble-tutor") : [];
    var bubble = bubbles[bubbles.length - 1];
    if (!bubble) return;

    var body = document.createElement("div");
    body.className = "casuya-ai-chat-answer";
    bubble.innerHTML = '<div class="casuya-ai-chat-bubble-label">AI Mwalimu</div>';
    bubble.appendChild(body);

    runTutorQuery(payload, {
      container: body,
      loadingLabel: "Inafikiria…",
      errorMessage: "AI haipatikani kwa sasa. Jaribu tena au uliza mwalimu wako.",
      onComplete: function (meta, text) {
        _messages[tutorIdx] = {
          role: "tutor",
          html: body.innerHTML,
          text: text,
          meta: meta,
        };
        persistThread();
        if (typeof attachTutorFollowUp === "function") attachTutorFollowUp(body, askQuestion);
        if (typeof attachTutorHelpful === "function") attachTutorHelpful(body, meta);
      },
      listenTitle: "Sikiliza jibu",
    });
  }

  function openLessonAiChatExplain(selected, surrounding) {
    selected = String(selected || "").trim();
    if (!selected) return;
    openSheet();
    var q = 'Explain this selected passage from the lesson:\n"' + selected + '"';
    if (surrounding) q += "\n\nSurrounding context:\n" + String(surrounding).slice(0, 600);
    askQuestion(q);
  }

  function bindSheetEvents() {
    document.querySelectorAll("[data-ai-chat-close]").forEach(function (el) {
      el.addEventListener("click", closeSheet);
    });
    var form = document.getElementById("casuya-ai-chat-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("casuya-ai-chat-input");
        var q = input ? input.value.trim() : "";
        if (!q) return;
        askQuestion(q);
        if (input) input.value = "";
        var sug = document.getElementById("casuya-ai-chat-suggestions");
        if (sug) sug.innerHTML = "";
      });
    }
    document.getElementById("casuya-ai-lang")?.addEventListener("change", function (e) {
      setLangPref(e.target.value);
    });
    document.getElementById("casuya-ai-chat-suggestions")?.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest("[data-ai-suggest]");
      if (!btn) return;
      askQuestion(btn.getAttribute("data-ai-suggest") || "");
      var sug = document.getElementById("casuya-ai-chat-suggestions");
      if (sug) sug.innerHTML = "";
    });
  }

  function ensureFab() {
    if (document.getElementById(FAB_ID)) return;
    var fab = document.createElement("button");
    fab.id = FAB_ID;
    fab.type = "button";
    fab.className = "casuya-ai-chat-fab";
    fab.setAttribute("aria-label", "Ask AI tutor");
    fab.textContent = "Uliza AI";
    fab.addEventListener("click", openSheet);
    document.body.appendChild(fab);
  }

  function ensureSheet() {
    if (document.getElementById(SHEET_ID)) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = sheetHtml();
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    bindSheetEvents();
  }

  function persistThread() {
    if (!_ctx || typeof saveTutorThread !== "function" || typeof tutorThreadStorageKey !== "function") return;
    saveTutorThread(tutorThreadStorageKey(_ctx), _messages);
  }

  function mountLessonAiChat(ctx) {
    _ctx = ctx || {};
    _messages = typeof loadTutorThread === "function" && typeof tutorThreadStorageKey === "function"
      ? loadTutorThread(tutorThreadStorageKey(_ctx))
      : [];
    ensureSheet();
    ensureFab();
    renderMessages();
    renderSuggestions();
    var langSel = document.getElementById("casuya-ai-lang");
    if (langSel) langSel.value = langPref();
  }

  function unmountLessonAiChat() {
    persistThread();
    closeSheet();
    var fab = document.getElementById(FAB_ID);
    if (fab) fab.remove();
    _ctx = null;
    _messages = [];
  }

  window.mountLessonAiChat = mountLessonAiChat;
  window.unmountLessonAiChat = unmountLessonAiChat;
  window.openLessonAiChatExplain = openLessonAiChatExplain;
})();

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
// modules/student/games.js — games list and game viewer.

"use strict";

function registerGamesView(d) {
  async function loadStudentGames() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games");
      const gameList = Array.isArray(games?.items) ? games.items : [];

      let recent = [];
      try { recent = d.getRecentlyViewed(); } catch(e) {}

      if (gameList.length === 0 && recent.length === 0) {
        d.showView(`
          <h2>Games</h2>
          <div class="empty-state" style="margin-top:1rem">
            <p>No games available yet.</p>
            <p style="color:var(--color-text-muted);font-size:0.85rem">Games are added by your teacher and appear inside lessons.</p>
            <button class="btn btn-primary" id="browse-lessons-btn" style="margin-top:1rem">Browse Lessons</button>
          </div>
        `);
        document.getElementById("browse-lessons-btn")?.addEventListener("click", () => {
          d.setActiveNav("subjects");
          d.callView("subjects");
        });
        return;
      }

      d.showView(`
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
        card.addEventListener("click", () => d.callView("game", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading games</p></div>'); }
  }

  async function viewStudentGame(gameId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>');
    try {
      const game = await request(`/games/${gameId}`);
      const contentResp = typeof loadGameHtml === "function"
        ? await loadGameHtml(gameId)
        : await fetch(`${API_BASE}/games/${gameId}/content`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
          }).then(r => r.ok ? r.text() : "").catch(() => "");

      d.showView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(game.title || "Game")}</h2>
        </div>
        <div style="width:100%">
          <div id="game-runtime-mount" class="lesson-iframe" style="width:100%;min-height:300px;height:600px"></div>
        </div>
        <div class="card" style="margin-top:0.75rem;padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Scratch Pad</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out problems here while you play.</p>
          <div data-blackboard data-lesson-id="game-${gameId}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
      `);

      const mount = document.getElementById("game-runtime-mount");
      if (mount && contentResp && typeof mountGameRuntime === "function") {
        await mountGameRuntime(mount, contentResp, { id: gameId, title: game.title || "Game" });
      } else if (mount && contentResp) {
        mountGameSrcdoc(mount, contentResp);
      } else if (mount) {
        mount.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-family:sans-serif"><p>Game content not available</p></div>';
      }

      document.getElementById("back-btn").addEventListener("click", () => d.goBack());
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading game</p><button class="btn" id="back-btn">← Back</button></div>'); document.getElementById("back-btn")?.addEventListener("click", () => d.goBack()); }
  }

  d.registerView("games", loadStudentGames);
  d.registerView("game", viewStudentGame);
}

;
// modules/student/exams.js — exam papers list and exam-taking view.

"use strict";

function registerExamsView(d) {
  async function loadStudentExams() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading exams...</p></div>');
    try {
      const quizzes = await request("/quizzes");
      const quizList = Array.isArray(quizzes) ? quizzes : [];
      let examHistory = [];
      try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}

      d.showView(`
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
        btn.addEventListener("click", () => d.callView("start-exam", btn.dataset.quizId));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading exams</p></div>'); }
  }

  async function startExam(quizId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading exam...</p></div>');
    try {
      const quizData = await request(`/quizzes/${quizId}`);
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        d.showView('<div class="empty-state"><p>No questions in this exam.</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.callView("exams"));
        return;
      }

      let timeLimit = quizData.time_limit || 30 * 60;
      let timeLeft = timeLimit;
      let examSubmitted = false;

      const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

      d.showView(`
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

      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      document.querySelectorAll("details").forEach(el => {
        const bbDiv = el.querySelector("[data-blackboard]");
        if (!bbDiv) return;
        const summ = el.querySelector("summary");
        if (!summ) return;
        const baseLabel = summ.textContent.trim();
        const check = () => {
          const bb = bbDiv._casuyaBlackboard;
          const has = bb && bb.getElements && bb.getElements().length > 0;
          summ.textContent = has ? `${baseLabel} — ✅ work captured` : baseLabel;
          summ.style.color = has ? "var(--color-success)" : "var(--color-text-muted)";
          summ.style.fontWeight = has ? "600" : "";
        };
        bbDiv.addEventListener("click", () => setTimeout(check, 100));
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
          document.getElementById("back-to-exams")?.addEventListener("click", () => d.callView("exams"));
        } catch(err) {
          document.getElementById("exam-result").innerHTML = `<div class="card" style="padding:1rem"><p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p></div>`;
          document.getElementById("exam-result").style.display = "block";
        }
      }

      document.getElementById("submit-exam-btn")?.addEventListener("click", () => {
        if (!examSubmitted && confirm("Submit exam?")) submitExam();
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading exam</p></div>'); }
  }

  d.registerView("exams", loadStudentExams);
  d.registerView("start-exam", startExam);
}

;
// modules/student/tests.js — Test Generator view for the student dashboard.

function loadStudentTestGenerator(dashboard) {
  dashboard.showView(renderTestGeneratorView({
    title: "Test Generator",
    intro: "Pick an exam type (Topical, Monthly, Midterm, Terminal, Annual, or NECTA Form II/IV/VI), choose your subject and topic, then practice fresh questions grounded in the NECTA/TIE knowledge base.",
  }));
  initTestGeneratorView(document.getElementById("student-content"));
}

function registerTestsView(dashboard) {
  dashboard.registerView("test-generator", () => {
    dashboard.setActiveNav("test-generator");
    loadStudentTestGenerator(dashboard);
  });
}
;
// modules/student/files.js — file management view.

"use strict";

function registerFilesView(d) {
  async function loadStudentFiles() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading files...</p></div>');
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

      d.showView(`
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
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading files</p></div>'); }
  }

  d.registerView("files", loadStudentFiles);
}

;
// modules/student/library.js — reference library (student view).

"use strict";

function registerLibraryView(d) {
  async function loadStudentLibrary() {
    const SUBJECTS = [
      { slug: "mathematics", name: "Mathematics" },
      { slug: "chemistry", name: "Chemistry" },
      { slug: "physics", name: "Physics" },
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
        const resp = await fetch(`${API_BASE}/reference-docs/${id}/render`);
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

    d.showView(`
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

  d.registerView("library", loadStudentLibrary);
}

;
// modules/student/payments.js — payments, plans, and subscriptions.

"use strict";

function registerPaymentsView(d) {
  async function loadStudentPayments() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
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

      d.showView(`
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
      document.getElementById("student-refresh-tx-btn")?.addEventListener("click", () => loadStudentPayments());
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
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

  d.registerView("payments", loadStudentPayments);
}

;
// modules/student/downloads.js — offline downloads management.
// Lesson HTML lives in IndexedDB (pinned). localStorage only keeps the id list
// as a fallback index — it used to store full HTML and hit the 5 MB quota.

"use strict";

function _downloadedIdList() {
  try { return JSON.parse(localStorage.getItem("casuya_downloaded_lessons") || "[]"); } catch (e) { return []; }
}

function _setDownloadedIdList(ids) {
  localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(ids));
}

function migrateLocalLessonCache() {
  var contentCache;
  try { contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}"); } catch (e) { return Promise.resolve(); }
  var ids = Object.keys(contentCache || {});
  if (!ids.length) return Promise.resolve();
  var jobs = ids.map(function (id) {
    var html = contentCache[id] && contentCache[id].html;
    if (!html || typeof putIdbLessonContent !== "function") return Promise.resolve();
    return putIdbLessonContent(id, html, true);
  });
  return Promise.all(jobs).then(function () {
    try { localStorage.removeItem("casuya_lesson_content_cache"); } catch (e) {}
  });
}

function registerDownloadsView(d) {
  async function loadStudentDownloads() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading downloads...</p></div>');
    try {
      await migrateLocalLessonCache();
      const lessons = await request("/lessons");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      let cachedIds = _downloadedIdList();
      if (typeof listIdbLessonIds === "function") {
        const pinned = await listIdbLessonIds(true);
        if (pinned.length) {
          cachedIds = Array.from(new Set(cachedIds.concat(pinned)));
          _setDownloadedIdList(cachedIds);
        }
      }
      const cachedLessons = lessonList.filter(l => cachedIds.includes(l.id));
      const availableLessons = lessonList.filter(l => !cachedIds.includes(l.id));

      d.showView(`
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
          btn.disabled = true;
          btn.textContent = "Saving...";
          try {
            const html = typeof loadLessonHtml === "function"
              ? await loadLessonHtml(lessonId)
              : "";
            if (html) {
              if (typeof putIdbLessonContent === "function") {
                await putIdbLessonContent(lessonId, html, true);
              }
              if (typeof cacheLessonContent === "function") cacheLessonContent(lessonId, html);
              if (!cachedIds.includes(lessonId)) {
                cachedIds.push(lessonId);
                _setDownloadedIdList(cachedIds);
              }
              showToast("Lesson saved for offline viewing");
              loadStudentDownloads();
            } else {
              showToast("Failed to save lesson");
              btn.disabled = false;
              btn.textContent = "Download";
            }
          } catch(e) {
            showToast("Failed to save lesson");
            btn.disabled = false;
            btn.textContent = "Download";
          }
        });
      });
      document.querySelectorAll("[data-remove-download]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const lessonId = btn.dataset.removeDownload;
          if (typeof deleteIdbLessonContent === "function") {
            await deleteIdbLessonContent(lessonId);
          }
          if (typeof dropCachedLessonContent === "function") {
            dropCachedLessonContent(lessonId);
          }
          cachedIds = cachedIds.filter(id => id !== lessonId);
          _setDownloadedIdList(cachedIds);
          loadStudentDownloads();
        });
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading downloads</p></div>'); }
  }

  d.registerView("downloads", loadStudentDownloads);
}
