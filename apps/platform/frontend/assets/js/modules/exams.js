// modules/exams.js — NECTA / internal-exam format paper renderer (A4 print layout).
//
// Renders paper_json from Test Generator and assignment flows. Supports
// mcq_bundle, matching, structured, essay, practical, and legacy flat MCQ.

"use strict";

const EXAM_PAPER_COLORS = { necta: "#0b3d91", internal: "#14532d", exercise: "#7c2d12" };

function examKindLabel(paper) {
  const k = paper && paper.kind;
  if (paper && paper.format_label) return paper.format_label;
  if (paper?.header?.assessment_type) return paper.header.assessment_type;
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

function _isNectaPaper(paper) {
  return Boolean(
    paper?.header?.subject_code ||
    paper?.header?.paper_code ||
    (paper?.sections || []).some((s) =>
      (s.questions || []).some((q) =>
        q.type === "mcq_bundle" || q.type === "matching" || q.type === "practical" || q.items
      )
    )
  );
}

function _renderMcqBundle(q, ctx) {
  const items = Array.isArray(q.items) ? q.items : [];
  let html = '<div class="exam-question">';
  html += `<strong>${escapeHtml(q.number)}.</strong> ${escapeHtml(q.text || q.stem || "")}`;
  if (q.marks) html += ` <span class="exam-marks-tag">[${q.marks}]</span>`;
  html += items.map((it) => {
    const opts = it.options || {};
    const optHtml = typeof opts === "object" && !Array.isArray(opts)
      ? Object.entries(opts).map(([k, v]) => `${escapeHtml(k)}. ${escapeHtml(v)}`).join(" &nbsp;&nbsp; ")
      : (Array.isArray(opts) ? opts.map((o) => escapeHtml(o)).join(" &nbsp;&nbsp; ") : "");
    let block = `<div class="exam-mcq-item"><div class="exam-mcq-header">`;
    block += `<div class="exam-mcq-text">(${escapeHtml(it.number || "")}) ${escapeHtml(it.text || "")}</div>`;
    if (ctx.mode === "student") {
      block += `<input type="text" maxlength="1" class="exam-answer-box-input" style="width:28px;height:22px;border:1px solid #000;text-align:center" aria-label="Answer for item ${escapeHtml(it.number || "")}">`;
    } else {
      block += '<div class="exam-answer-box"></div>';
    }
    block += `</div><div class="exam-options-grid">${optHtml}</div></div>`;
    return block;
  }).join("");
  html += "</div>";
  return html;
}

function _renderMatching(q, ctx) {
  const listA = Array.isArray(q.listA) ? q.listA : [];
  const listB = Array.isArray(q.listB) ? q.listB : [];
  let html = '<div class="exam-question">';
  html += `<strong>${escapeHtml(q.number)}.</strong> ${escapeHtml(q.text || q.stem || "Match List A with List B:")}`;
  if (q.marks) html += ` <span class="exam-marks-tag">[${q.marks}]</span>`;
  html += '<table class="exam-matching-table"><thead><tr><th>List A</th><th>Answer</th></tr></thead><tbody>';
  html += listA.map((item, i) => {
    const ansCell = ctx.mode === "student"
      ? `<input type="text" maxlength="1" style="width:28px;border:1px solid #000;text-align:center">`
      : '<div class="exam-answer-box" style="margin:0 auto"></div>';
    return `<tr><td>(${escapeHtml(String.fromCharCode(105 + i))}) ${escapeHtml(item)}</td><td style="text-align:center;width:60px">${ansCell}</td></tr>`;
  }).join("");
  html += "</tbody></table>";
  html += '<p style="font-size:10pt"><strong>List B</strong></p><ol style="font-size:10.5pt">';
  html += listB.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
  html += "</ol></div>";
  return html;
}

function _renderStructured(q, ctx) {
  const parts = q.parts || q.sub_questions || q.tasks || [];
  let html = '<div class="exam-question">';
  html += `<strong>${escapeHtml(q.number)}.</strong> ${escapeHtml(q.text || q.stem || "")}`;
  if (q.marks) html += ` <span class="exam-marks-tag">[${q.marks}]</span>`;
  if (q.type === "practical") {
    if (Array.isArray(q.apparatus) && q.apparatus.length) {
      html += '<p><strong>Apparatus:</strong></p><ul>';
      html += q.apparatus.map((a) => `<li>${escapeHtml(a)}</li>`).join("");
      html += "</ul>";
    }
    if (Array.isArray(q.procedure) && q.procedure.length) {
      html += '<p><strong>Procedure:</strong></p><ol>';
      html += q.procedure.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
      html += "</ol>";
    }
    (q.tables || []).forEach((tbl) => {
      html += `<p><strong>${escapeHtml(tbl.title || "Table")}</strong></p>`;
      html += '<table class="exam-practical-table"><thead><tr>';
      (tbl.columns || []).forEach((c) => { html += `<th>${escapeHtml(c)}</th>`; });
      html += "</tr></thead><tbody>";
      const rows = Math.max(3, parseInt(tbl.rows, 10) || 4);
      for (let r = 0; r < rows; r++) {
        html += "<tr>";
        (tbl.columns || ["Col"]).forEach(() => { html += "<td>&nbsp;</td>"; });
        html += "</tr>";
      }
      html += "</tbody></table>";
    });
  }
  html += parts.map((p) => {
    const label = p.label || "";
    const marks = p.marks ? ` <span class="exam-marks-tag">[${p.marks}]</span>` : "";
    let part = `<div class="exam-sub-q">(${escapeHtml(label)}) ${escapeHtml(p.text || "")}${marks}`;
    if (ctx.mode === "student") {
      part += `<textarea class="exam-structured-answer" data-question="${escapeHtml(q.number)}-${escapeHtml(label)}" placeholder="Write your answer..." style="width:100%;min-height:60px;margin-top:4px;font-family:inherit;font-size:10pt"></textarea>`;
    } else {
      part += '<div class="exam-answer-space"></div>';
    }
    part += "</div>";
    return part;
  }).join("");
  html += "</div>";
  return html;
}

function _renderLegacyQuestion(q, type, ctx) {
  const marks = parseInt(q.marks, 10) || 0;
  const isMcq = type === "mcq" || (Array.isArray(q.options) && q.options.length);
  let html = `<div class="exam-q" data-q="${escapeHtml(q.number)}">`;
  html += '<div class="exam-q-head">';
  html += `<span class="exam-q-no">${escapeHtml(q.number)}.</span>`;
  html += `<span class="exam-q-text">${escapeHtml(q.text || "")}</span>`;
  if (marks) html += `<span class="exam-q-marks">(${marks})</span>`;
  html += "</div>";
  if (isMcq) {
    const opts = Array.isArray(q.options) ? q.options : [];
    if (ctx.mode === "student") {
      html += '<div class="exam-opts">';
      html += opts.map((o, i) =>
        `<label class="exam-opt"><input type="radio" name="${escapeHtml(ctx.ns + "-" + q.number)}" value="${i}"><span>${escapeHtml(o)}</span></label>`
      ).join("");
      html += "</div>";
    } else {
      html += '<div class="exam-opts exam-opts-static">';
      html += opts.map((o) => `<div class="exam-opt">${escapeHtml(o)}</div>`).join("");
      html += "</div>";
    }
  } else if (ctx.mode === "student") {
    html += `<textarea class="exam-structured-answer" data-question="${escapeHtml(q.number)}" placeholder="Write your answer..." style="width:100%;min-height:80px;margin-top:4px"></textarea>`;
  } else {
    html += '<div class="exam-answer-line"></div>';
  }
  html += "</div>";
  return html;
}

function _renderNectaSection(sec, ctx) {
  const qs = Array.isArray(sec.questions) ? sec.questions : [];
  const marks = sec.marks || qs.reduce((n, q) => n + (parseInt(q.marks, 10) || 0), 0);
  let html = `<div class="exam-section-block">`;
  html += `<div class="exam-section-head">SECTION ${escapeHtml(sec.id || "")} (${marks} Marks)</div>`;
  if (sec.instruction) html += `<div class="exam-section-instr">${escapeHtml(sec.instruction)}</div>`;
  if (sec.choice?.mode === "n_of_m") {
    html += `<div class="exam-section-instr">Answer ${sec.choice.n} of ${sec.choice.m} questions.</div>`;
  }
  html += qs.map((q) => {
    const t = q.type || sec.question_type || "structured";
    if (t === "mcq_bundle" || q.items) return _renderMcqBundle(q, ctx);
    if (t === "matching") return _renderMatching(q, ctx);
    if (t === "mcq") return _renderLegacyQuestion(q, "mcq", ctx);
    return _renderStructured(q, ctx);
  }).join("");
  html += "</div>";
  return html;
}

function _renderAssessorTable(table) {
  if (!table?.question_numbers?.length) return "";
  const nums = table.question_numbers;
  let html = '<p style="font-size:9pt;font-weight:bold;text-align:center;margin-top:10px">FOR ASSESSOR\'S USE ONLY</p>';
  html += '<table class="exam-assessor-table"><thead><tr>';
  nums.forEach((n) => { html += `<th>Q${n}</th>`; });
  html += "<th>TOTAL</th>";
  if (table.checker) html += "<th>CHECKER</th>";
  html += "</tr></thead><tbody><tr>";
  nums.forEach(() => { html += "<td>&nbsp;</td>"; });
  html += "<td>&nbsp;</td>";
  if (table.checker) html += "<td>&nbsp;</td>";
  html += "</tr></tbody></table>";
  return html;
}

function _renderNectaCover(h, paper, pageNum, totalPages) {
  const code = h.subject_code || "";
  const title = h.paper_code ? `${h.paper_code} ${h.paper_title || h.subject || ""}`.trim() : (h.subject || "");
  let html = '<div class="exam-page"><div class="exam-page-body">';
  if (pageNum === 1) {
    if (code) html += `<div style="text-align:left"><span class="exam-code-box">${escapeHtml(code)}</span></div>`;
    html += `<div class="exam-id-line">${escapeHtml(h.id_label || "Examination Number")}: _________________________</div>`;
    html += '<div class="exam-header-text">';
    html += `${escapeHtml(h.country || "THE UNITED REPUBLIC OF TANZANIA")}<br>`;
    html += `${escapeHtml(h.exam_body || "NATIONAL EXAMINATIONS COUNCIL OF TANZANIA")}<br>`;
    html += `${escapeHtml(h.assessment_type || examKindLabel(paper))}`;
    html += "</div>";
    if (h.candidate_kind) html += `<div class="exam-header-text" style="font-size:10pt;margin-top:4px">(${escapeHtml(h.candidate_kind)})</div>`;
    html += `<div class="exam-header-text" style="margin-top:6px">${escapeHtml(title.toUpperCase())}</div>`;
    html += '<div class="exam-meta-bar">';
    html += `<span>Time: ${escapeHtml(h.duration || "")}</span>`;
    html += `<span>Year: ${escapeHtml(h.year || new Date().getFullYear())}</span>`;
    html += "</div>";
    const instr = Array.isArray(h.instructions) ? h.instructions : [];
    if (instr.length) {
      html += '<div class="exam-instructions-block"><strong>Instructions</strong><ol>';
      html += instr.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
      html += "</ol></div>";
    }
    if (Array.isArray(h.materials) && h.materials.length) {
      html += '<p style="font-size:10pt"><strong>Materials:</strong> ';
      html += h.materials.map((m) => escapeHtml(m)).join(" ");
      html += "</p>";
    }
    if (Array.isArray(h.constants) && h.constants.length) {
      html += h.constants.map((c) => `<p style="font-size:10pt">${escapeHtml(c)}</p>`).join("");
    }
    if (paper.assessor_table) html += _renderAssessorTable(paper.assessor_table);
  }
  html += "</div>";
  html += `<div class="exam-footer-bar"><span>${escapeHtml(code)} ${escapeHtml(h.subject || "")}</span><span>Page ${pageNum} of ${totalPages}</span></div>`;
  html += "</div>";
  return html;
}

function renderMarkingScheme(scheme) {
  if (!scheme?.sections) return "";
  let html = '<div class="exam-marking-scheme">';
  html += "<h3>CONFIDENTIAL — MARKING SCHEME</h3>";
  html += `<p style="text-align:center">${escapeHtml(scheme.subject || "")} (${escapeHtml(scheme.code || "")}) — ${scheme.max_marks || ""} marks</p>`;
  scheme.sections.forEach((sec) => {
    html += `<h4>${escapeHtml(sec.name || "")}</h4>`;
    (sec.questions || []).forEach((q) => {
      html += `<p><strong>Q${escapeHtml(q.number)}</strong> (${q.marks} marks): `;
      html += escapeHtml(q.answer_html || (q.items ? q.items.map((it) => `${it.number}:${it.answer}`).join(", ") : "See rubric"));
      html += "</p>";
    });
  });
  html += "</div>";
  return html;
}

function renderExamPaper(paper, opts) {
  opts = opts || {};
  const h = paper.header || {};
  const sections = Array.isArray(paper.sections) ? paper.sections : [];
  const mode = opts.mode || "preview";
  const ns = opts.ns || "exam";
  const ctx = { mode, ns };
  const markingScheme = opts.markingScheme || null;
  const showActions = opts.showActions !== false;

  if (_isNectaPaper(paper)) {
    const totalPages = Math.max(2, Math.ceil(sections.length / 2) + 1);
    let bodyHtml = "";
    sections.forEach((sec) => { bodyHtml += _renderNectaSection(sec, ctx); });

    let html = '<div class="exam-paper-root" data-exam-root>';
    if (showActions) {
      html += '<div class="exam-paper-actions">';
      html += '<button type="button" class="btn btn-sm btn-primary" data-exam-print>Print / PDF</button>';
      if (markingScheme) html += '<button type="button" class="btn btn-sm btn-secondary" data-exam-toggle-ms>Marking Scheme</button>';
      html += "</div>";
    }
    html += _renderNectaCover(h, paper, 1, totalPages);
    html += `<div class="exam-page"><div class="exam-page-body">${bodyHtml}</div>`;
    html += `<div class="exam-footer-bar"><span>${escapeHtml(h.subject_code || "")} ${escapeHtml(h.subject || "")}</span><span>Page 2 of ${totalPages}</span></div></div>`;
    if (markingScheme) {
      html += `<div data-exam-ms-wrap style="display:none">${renderMarkingScheme(markingScheme)}</div>`;
    }
    html += "</div>";
    return html;
  }

  // Legacy card layout for assignment papers
  const color = EXAM_PAPER_COLORS[paper.kind] || "#0b3d91";
  const label = examKindLabel(paper);
  let html = '<div class="exam-paper">';
  html += `<div class="exam-cover" style="border-top:5px solid ${escapeHtml(color)}">`;
  html += '<div class="exam-country">UNITED REPUBLIC OF TANZANIA</div>';
  html += `<div class="exam-label">${escapeHtml(label)}</div>`;
  if (h.subject) html += `<div class="exam-subject">${escapeHtml(h.subject)}</div>`;
  html += '<div class="exam-meta">';
  if (h.form_label) html += `<span>Class: <b>${escapeHtml(h.form_label)}</b></span>`;
  if (h.duration) html += `<span>Time Allowed: <b>${escapeHtml(h.duration)}</b></span>`;
  html += `<span>Total: <b>${h.total_marks != null ? parseInt(h.total_marks, 10) : 0} marks</b></span>`;
  html += "</div>";
  if (h.topic) html += `<div class="exam-topic">Topic: ${escapeHtml(h.topic)}</div>`;
  html += "</div>";
  const instr = Array.isArray(h.instructions) ? h.instructions : [];
  if (instr.length) {
    html += '<div class="exam-instr"><div class="exam-instr-title">INSTRUCTIONS</div><ol>';
    html += instr.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
    html += "</ol></div>";
  }
  html += sections.map((sec) => {
    const qs = Array.isArray(sec.questions) ? sec.questions : [];
    const marks = qs.reduce((n, q) => n + (parseInt(q.marks, 10) || 0), 0);
    let s = '<div class="exam-section"><div class="exam-sec-head">';
    s += `<span class="exam-sec-id" style="background:${escapeHtml(color)}">SECTION ${escapeHtml((sec.id || "").trim())}</span>`;
    s += `<span class="exam-sec-title">${escapeHtml(sec.title || "QUESTIONS")}</span>`;
    s += `<span class="exam-sec-marks">${marks} marks</span></div>`;
    if (sec.instruction) s += `<div class="exam-sec-instr">${escapeHtml(sec.instruction)}</div>`;
    s += qs.map((q) => _renderLegacyQuestion(q, sec.question_type, ctx)).join("");
    s += "</div>";
    return s;
  }).join("");
  if (mode === "student") {
    html += '<div class="exam-check">';
    html += `<button type="button" class="btn btn-sm btn-primary" data-exam-check data-exam-ns="${escapeHtml(ns)}">Check Objective Answers</button>`;
    html += '<div data-exam-score class="exam-score"></div></div>';
  }
  html += "</div>";
  return html;
}

function renderExamMath(root) {
  if (!root) return;
  const run = function () {
    if (typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(root, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    } catch (e) { /* never break exam preview */ }
  };
  if (typeof window.ensureKaTeX === "function") {
    window.ensureKaTeX().then(run);
  } else {
    run();
  }
}

function bindExamPaperActions(root) {
  if (!root) return;
  renderExamMath(root);
  const printBtn = root.querySelector("[data-exam-print]");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const w = window.open("", "_blank");
      if (!w) return;
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((el) => el.outerHTML).join("");
      const katexCss = '<link rel="stylesheet" href="/static/lib/katex/katex.min.css">';
      const katexJs = '<script src="/static/lib/katex/katex.min.js"><\/script>';
      const autoRender = '<script src="/static/lib/katex/contrib/auto-render.min.js"><\/script>';
      const mathBoot = `<script>
        document.addEventListener("DOMContentLoaded",function(){
          if(typeof renderMathInElement==="function"){
            renderMathInElement(document.body,{delimiters:[{left:"\\\\[",right:"\\\\]",display:true},{left:"\\\\(",right:"\\\\)",display:false},{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false});
          }
          setTimeout(function(){window.print();},500);
        });
      <\/script>`;
      w.document.write(`<!DOCTYPE html><html><head><title>Exam Paper</title>${styles}${katexCss}${katexJs}${autoRender}</head><body>${root.innerHTML}${mathBoot}</body></html>`);
      w.document.close();
      w.focus();
    });
  }
  const msBtn = root.querySelector("[data-exam-toggle-ms]");
  const msWrap = root.querySelector("[data-exam-ms-wrap]");
  if (msBtn && msWrap) {
    msBtn.addEventListener("click", () => {
      const show = msWrap.style.display === "none";
      msWrap.style.display = show ? "block" : "none";
      msBtn.textContent = show ? "Hide Marking Scheme" : "Marking Scheme";
    });
  }
}

function bindExamScore(root, paper) {
  const btn = root.querySelector("[data-exam-check]");
  if (!btn) return;
  const out = root.querySelector("[data-exam-score]");
  const ns = btn.dataset.examNs || "exam";
  btn.addEventListener("click", () => {
    let correctQs = 0;
    let objectiveQs = 0;
    (paper.sections || []).forEach((sec) => {
      const type = sec.question_type;
      (sec.questions || []).forEach((q) => {
        if (type === "mcq" || (q.options && q.answer != null)) {
          objectiveQs += 1;
          const sel = root.querySelector(`input[name="${ns}-${q.number}"]:checked`);
          if (sel && parseInt(sel.value, 10) === q.answer) correctQs += 1;
        }
      });
    });
    const pct = objectiveQs ? Math.round((correctQs / objectiveQs) * 100) : 0;
    if (out) {
      out.innerHTML = `<span class="exam-score-good">Objective: <b>${correctQs}/${objectiveQs}</b> (${pct}%)</span>`;
    }
  });
}
