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
