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