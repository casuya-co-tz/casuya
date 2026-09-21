// modules/teacher/assignments-create-form.js — create-assignment form and AI exam paper generation
// Rendered from the assignments list (assignments-crud.js) when the teacher clicks
// "+ New Assignment". Handles the exam section editor, AI generation, preview and
// final assignment creation. Uses the global helpers request / escapeHtml / renderExamPaper.

const ASSIGNMENT_PAPER_LABELS = { theory: "Theory", theory_2: "Paper 2", practical: "Practical" };

function showAssignmentCreateForm(dashboard, lessonList) {
  let presetMode = "legacy";
  let selectedPaper = "theory";
  let presetCfg = null;

  document.getElementById("assignment-form-area").innerHTML = `
    <div class="card" style="margin-top:1rem;padding:1.5rem">
      <h3 style="margin-bottom:0.5rem">Create a New Assignment</h3>
      <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.9rem">
        Use the <b>AI exam generator</b> to create a NECTA / internal-format paper for a lesson, preview it, then assign it to students.
      </p>
      <form id="assignment-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div style="grid-column:1/-1">
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Title</label>
          <input class="input" name="title" id="exam-title" placeholder="e.g. Form Two Chemistry - Mid-Term Examination">
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Lesson</label>
          <select class="input" name="lesson_id" id="exam-lesson" required>
            <option value="">Select lesson...</option>
            ${lessonList.map(l => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Exam Type</label>
          <select class="input" name="kind" id="exam-kind">
            <option value="necta">NECTA Style (FTNA/CSEE)</option>
            <option value="internal">Internal Examination</option>
            <option value="exercise">Class Exercise</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Due Date</label>
          <input class="input" type="date" name="due_date">
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Time Allowed</label>
          <input class="input" name="duration" id="exam-duration" placeholder="2 Hours">
        </div>
        <div style="grid-column:1/-1;display:none" id="exam-paper-variant-wrap">
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Paper variant</label>
          <div id="exam-paper-chips" class="test-paper-grid"></div>
          <div id="exam-structure-summary" style="font-size:0.82rem;color:var(--color-text-muted);margin-top:0.5rem"></div>
        </div>
        <div style="grid-column:1/-1" id="exam-legacy-sections-wrap">
          <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Exam Structure — adjust question counts & marks per section</label>
          <div id="exam-sections"></div>
        </div>
        <div style="grid-column:1/-1;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" type="button" id="exam-generate">✨ Generate Exam with AI</button>
          <span id="exam-generate-status" style="font-size:0.8rem;color:var(--color-text-muted)"></span>
          <button class="btn" type="button" id="cancel-assignment" style="margin-left:auto">Cancel</button>
        </div>
      </form>
      <div id="exam-preview-area" style="margin-top:1rem"></div>
    </div>
  `;
  document.getElementById("cancel-assignment").addEventListener("click", () => document.getElementById("assignment-form-area").innerHTML = "");

  const sectionsByKind = () => {
    const out = [];
    document.querySelectorAll("#exam-sections [data-sec-row]").forEach(row => {
      out.push({
        id: row.dataset.secRow,
        count: parseInt(row.querySelector('[data-field="count"]').value, 10) || 1,
        marks_per_question: parseInt(row.querySelector('[data-field="marks_per_question"]').value, 10) || 1,
      });
    });
    return out;
  };
  const updateExamTotal = () => {
    const line = document.getElementById("exam-total-line");
    if (!line) return;
    const secs = sectionsByKind();
    const total = secs.reduce((s, x) => s + x.count * x.marks_per_question, 0);
    line.innerHTML = `Total: <b>${total} marks</b> (${secs.length} sections)`;
  };
  const renderNectaPaperChips = (papers) => {
    const chipsEl = document.getElementById("exam-paper-chips");
    const summaryEl = document.getElementById("exam-structure-summary");
    if (!chipsEl) return;
    if (!papers || !papers.length) {
      chipsEl.innerHTML = '<span style="font-size:0.85rem;color:var(--color-text-muted)">No papers for this lesson.</span>';
      if (summaryEl) summaryEl.textContent = "";
      return;
    }
    if (!papers.some((p) => p.paper === selectedPaper)) selectedPaper = papers[0].paper;
    chipsEl.innerHTML = papers.map((p) => {
      const label = ASSIGNMENT_PAPER_LABELS[p.paper] || p.paper;
      const sel = p.paper === selectedPaper ? " selected" : "";
      return `<button type="button" class="test-paper-chip${sel}" data-paper="${escapeHtml(p.paper)}">
        ${escapeHtml(label)}<small>${escapeHtml(p.paper_code || "")} · ${p.total_marks || 0} marks · ${escapeHtml(p.duration || "")}</small>
      </button>`;
    }).join("");
    chipsEl.querySelectorAll("[data-paper]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPaper = btn.dataset.paper || "theory";
        renderNectaPaperChips(papers);
      });
    });
    const active = papers.find((p) => p.paper === selectedPaper) || papers[0];
    if (summaryEl && active) {
      summaryEl.textContent = active.structure_summary || `${active.question_count || 0} questions · ${active.total_marks || 0} marks`;
    }
    const dur = document.getElementById("exam-duration");
    if (dur && active?.duration && !dur.value) dur.value = active.duration;
  };
  const loadSectionEditor = async () => {
    const kind = document.getElementById("exam-kind").value;
    const lessonId = document.getElementById("exam-lesson").value;
    const variantWrap = document.getElementById("exam-paper-variant-wrap");
    const legacyWrap = document.getElementById("exam-legacy-sections-wrap");
    try {
      const qs = new URLSearchParams({ kind });
      if (lessonId) qs.set("lesson_id", lessonId);
      const presets = await request("/assignments/exam-presets?" + qs.toString());
      presetCfg = presets;
      presetMode = presets.mode || "legacy";
      if (presetMode === "necta" && Array.isArray(presets.papers)) {
        if (variantWrap) variantWrap.style.display = "block";
        if (legacyWrap) legacyWrap.style.display = "none";
        renderNectaPaperChips(presets.papers);
        const dur = document.getElementById("exam-duration");
        if (dur && presets.duration && !dur.value) dur.value = presets.duration;
        return;
      }
      if (variantWrap) variantWrap.style.display = "none";
      if (legacyWrap) legacyWrap.style.display = "block";
      const cfg = presets.sections ? presets : (presets.necta || presets.internal || presets);
      if (!cfg || !cfg.sections) return;
      const dur = document.getElementById("exam-duration");
      if (!dur.value) dur.value = cfg.duration || "";
      const total = cfg.sections.reduce((s, x) => s + x.count * x.marks_per_question, 0);
      document.getElementById("exam-sections").innerHTML =
        cfg.sections.map(sec => `
          <div data-sec-row="${escapeHtml(sec.id)}" style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px dashed var(--color-border)">
            <span style="width:1.7rem;font-weight:700">${escapeHtml(sec.id)}</span>
            <span style="flex:1;font-size:0.85rem">${escapeHtml(sec.title)}</span>
            <label style="font-size:0.75rem;color:var(--color-text-muted)">Questions <input class="input" style="width:4.5rem" type="number" min="1" max="40" data-field="count" value="${sec.count}"></label>
            <label style="font-size:0.75rem;color:var(--color-text-muted)">Marks each <input class="input" style="width:4.5rem" type="number" min="1" max="50" data-field="marks_per_question" value="${sec.marks_per_question}"></label>
          </div>
        `).join("") +
        `<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--color-text-muted)" id="exam-total-line">Total: <b>${total} marks</b> (${cfg.sections.length} sections)</div>`;
      document.querySelectorAll("#exam-sections input").forEach(inp => inp.addEventListener("input", updateExamTotal));
    } catch(e) { /* presets unavailable */ }
  };
  document.getElementById("exam-kind").addEventListener("change", loadSectionEditor);
  document.getElementById("exam-lesson").addEventListener("change", loadSectionEditor);
  loadSectionEditor();

  document.getElementById("exam-generate").addEventListener("click", async () => {
    const lessonId = document.getElementById("exam-lesson").value;
    if (!lessonId) { alert("Select a lesson first"); return; }
    const btn = document.getElementById("exam-generate");
    const status = document.getElementById("exam-generate-status");
    const titleEl = document.getElementById("exam-title");
    const kind = document.getElementById("exam-kind").value;
    btn.disabled = true;
    status.textContent = "Generating exam paper...";
    try {
      const payload = {
        lesson_id: lessonId,
        kind,
        duration: document.getElementById("exam-duration").value || "",
      };
      if (presetMode === "necta") {
        payload.paper = selectedPaper;
      } else {
        payload.sections = sectionsByKind();
      }
      const res = await request("/assignments/generate-paper", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const paper = res && res.paper;
      if (!paper) throw new Error("No paper returned");
      if (!titleEl.value.trim()) {
        const h = paper.header || {};
        const label = paper.kind === "necta" ? "NECTA-Style Exam" : paper.kind === "exercise" ? "Class Exercise" : "Internal Exam";
        titleEl.value = [h.subject, h.form_label, label].filter(Boolean).join(" — ");
      }
      document.getElementById("exam-preview-area").innerHTML = `
        <div class="card" style="padding:1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
            <h4 style="margin:0">Exam Preview</h4>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-sm" id="exam-regenerate">↻ Regenerate</button>
              <button class="btn btn-sm btn-success" id="exam-assign">Assign Exam to Students</button>
            </div>
          </div>
          ${res.generator === "local" ? '<p style="font-size:0.8rem;color:var(--color-warning);margin:0 0 0.5rem">⚠ AI service unavailable — a valid paper was generated offline from the lesson content.</p>' : ""}
          ${renderExamPaper(paper, { mode: "preview", ns: "preview-" + (paper.header?.form_level || 0), markingScheme: res.markingScheme, showActions: true })}
        </div>
      `;
      const examRoot = document.querySelector("#exam-preview-area [data-exam-root]");
      if (examRoot && typeof bindExamPaperActions === "function") bindExamPaperActions(examRoot);
      document.getElementById("exam-regenerate").addEventListener("click", () => {
        document.getElementById("exam-generate").click();
      });
      document.getElementById("exam-assign").addEventListener("click", async () => {
        const fd = new FormData(document.getElementById("assignment-form"));
        try {
          await request("/assignments?" + new URLSearchParams({
            lesson_id: lessonId,
            title: titleEl.value.trim() || fd.get("title") || "Assignment",
            due_date: fd.get("due_date") || "",
            notes: fd.get("notes") || "",
            paper: JSON.stringify(paper),
          }), { method: "POST" });
          loadAssignments(dashboard);
        } catch(err) { alert("Failed to create assignment: " + err.message); }
      });
      status.textContent = res.generator === "casuya-ai" ? "Generated by AI ✓ — review and assign." : "Generated offline ✓ — review and assign.";
    } catch(err) {
      status.textContent = "";
      alert("Failed to generate exam: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}
