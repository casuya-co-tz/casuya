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
      if (hits.length) {
        const sources = hits.map((h) => escapeHtml(h.title)).join(", ");
        sourcesEl.innerHTML = `
          <div class="card" style="padding:0.75rem 1rem;margin-bottom:1rem">
            <p style="font-size:0.8rem;margin:0;color:var(--color-text-muted)">
              📚 <strong>${escapeHtml(label)}</strong> — generated from ${hits.length} knowledge-base source(s): ${sources}
              ${data.grounded ? "" : " (using syllabus/topic grounding)"}
            </p>
          </div>`;
      }
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