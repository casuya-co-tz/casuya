// modules/teacher/assignments-grading.js — submission review & grading view
// Extracted from assignments.js. Relies on globals: loadAssignments (back-to-list),
// renderBlackboardReplay (teacher/utils.js), renderExamPaper (exams.js).

async function openAssignmentSubmissions(dashboard, id) {
  try {
    const [a, subs] = await Promise.all([
      request(`/assignments/${id}`),
      request(`/assignments/${id}/submissions`),
    ]);
    const subList = Array.isArray(subs) ? subs : [];
    dashboard.showView(`
      <div class="content">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-to-list">← Back to Assignments</button>
          <h2 style="flex:1">Submissions: ${escapeHtml(a.title)}</h2>
        </div>
        ${subList.length === 0 ?
          '<div class="empty-state"><p>No submissions yet. Students haven\'t submitted their work for this assignment.</p></div>' :
          `<div style="margin-bottom:1rem"><p style="color:var(--color-text-muted);font-size:0.85rem">${subList.length} submission(s) received — click to view</p></div>
           <div style="display:grid;gap:0.5rem">
             ${subList.map(s => `
               <div class="card" style="padding:0.75rem 1rem;cursor:pointer;transition:box-shadow 0.15s" data-view-submission="${s.id}" data-sub-assignment="${id}">
                 <div style="display:flex;justify-content:space-between;align-items:center">
                   <div>
                     <span style="font-weight:600">${escapeHtml(s.student_id)}</span>
                     <span style="color:var(--color-text-muted);font-size:0.8rem;margin-left:0.5rem">${s.status}</span>
                   </div>
                   <span style="font-size:0.8rem;color:var(--color-text-muted)">${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ""}</span>
                 </div>
               </div>
             `).join("")}
           </div>`
        }
        <div id="submission-detail" style="margin-top:1rem"></div>
      </div>
    `);
    document.getElementById("back-to-list").addEventListener("click", () => loadAssignments(dashboard));
    document.querySelectorAll("[data-view-submission]").forEach(card => {
      card.addEventListener("mouseenter", () => card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)");
      card.addEventListener("mouseleave", () => card.style.boxShadow = "none");
      card.addEventListener("click", async () => {
        const subId = card.dataset.viewSubmission;
        const assignId = card.dataset.subAssignment;
        const detail = document.getElementById("submission-detail");
        detail.innerHTML = '<div style="padding:1rem;color:var(--color-text-muted)">Loading submission...</div>';
        try {
          const [subData, assignData] = await Promise.all([
            request(`/assignments/${assignId}/submissions`),
            request(`/assignments/${assignId}`),
          ]);
          const sub = (Array.isArray(subData) ? subData : []).find(s => s.id === subId);
          if (!sub) { detail.innerHTML = '<div style="padding:1rem;color:var(--color-error)">Submission not found</div>'; return; }
          let elements = [];
          let mcqAnswers = {};
          let structuredAnswers = {};
          try {
            const parsed = JSON.parse(sub.elements_json || "{}");
            if (Array.isArray(parsed)) {
              elements = parsed;
            } else {
              elements = parsed.elements || [];
              mcqAnswers = parsed.mcq_answers || {};
              structuredAnswers = parsed.structured_answers || {};
            }
          } catch {}
          const paper = assignData && assignData.paper;
          let html = `
            <div class="card" style="padding:1.25rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
                <h3 style="margin:0">Student: ${escapeHtml(sub.student_id)}</h3>
                <span style="font-size:0.8rem;color:var(--color-text-muted)">Submitted: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "N/A"} | ${sub.status}</span>
              </div>
          `;
          if (paper && paper.sections) {
            html += '<div style="margin-bottom:1rem"><h4 style="margin:0 0 0.5rem">Multiple Choice Answers</h4>';
            paper.sections.forEach(sec => {
              if (sec.question_type !== "mcq") return;
              (sec.questions || []).forEach(q => {
                const chosen = mcqAnswers[q.number] != null ? mcqAnswers[q.number] : -1;
                const correct = q.answer;
                const isCorrect = chosen === correct;
                const opts = (q.options || []).map((o, i) => {
                  const sel = i === chosen;
                  const cor = i === correct;
                  let style = "padding:0.15rem 0.4rem;border-radius:3px;margin:0.1rem 0;display:block;font-size:0.85rem;";
                  if (cor) style += "background:#dcfce7;font-weight:600;";
                  else if (sel && !cor) style += "background:#fee2e2;text-decoration:line-through;";
                  return `<span style="${style}">${i + 1}. ${escapeHtml(o)}</span>`;
                }).join("");
                html += `<div style="margin-bottom:0.5rem;padding:0.4rem;border-left:3px solid ${isCorrect ? "#16a34a" : "#dc2626"};padding-left:0.6rem">
                  <span style="font-weight:600;font-size:0.85rem">Q${q.number}.</span> <span style="font-size:0.85rem">${escapeHtml(q.text).slice(0, 80)}</span>
                  <div style="margin-top:0.2rem">${opts}</div>
                  <span style="font-size:0.75rem;color:${isCorrect ? "#16a34a" : "#dc2626"};font-weight:600">${chosen >= 0 ? (isCorrect ? "Correct" : "Wrong") : "No answer"} (${q.marks} mark${q.marks > 1 ? "s" : ""})</span>
                </div>`;
              });
            });
            const hasStructured = Object.keys(structuredAnswers).length > 0;
            if (hasStructured) {
              html += '<h4 style="margin:1rem 0 0.5rem">Structured / Essay Answers</h4>';
              paper.sections.forEach(sec => {
                if (sec.question_type === "mcq") return;
                (sec.questions || []).forEach(q => {
                  const answer = structuredAnswers[q.number] || "";
                  html += `<div style="margin-bottom:0.75rem;padding:0.5rem;border-left:3px solid #2563eb;padding-left:0.6rem;background:#f8fafc;border-radius:0 6px 6px 0">
                    <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.25rem">Q${q.number}. ${escapeHtml(q.text).slice(0, 100)}</div>
                    <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:0.25rem">(${q.marks} mark${q.marks > 1 ? "s" : ""})</div>
                    ${answer
                      ? `<div style="background:#fff;padding:0.5rem;border:1px solid #e5e7eb;border-radius:4px;font-size:0.9rem;white-space:pre-wrap">${escapeHtml(answer)}</div>`
                      : '<div style="color:#dc2626;font-size:0.85rem;font-style:italic">No answer submitted</div>'
                    }
                  </div>`;
                });
              });
            }
            html += '</div>';
          }
          if (elements.length > 0) {
            html += '<div style="margin-bottom:0.5rem"><h4 style="margin:0 0 0.5rem">Blackboard Work</h4>';
            html += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:0.75rem;position:relative">';
            html += '<canvas id="bb-replay-canvas" style="width:100%;border-radius:4px;background:#fff;cursor:default"></canvas>';
            html += '</div></div>';
          } else if (!paper) {
            html += '<div style="color:var(--color-text-muted);font-size:0.85rem;padding:1rem">No work submitted yet.</div>';
          }
          html += '</div>';
          detail.innerHTML = html;
          card.scrollIntoView({ behavior: "smooth", block: "start" });
          if (elements.length > 0) {
            const replay = () => requestAnimationFrame(() => renderBlackboardReplay(elements));
            if (window.ensureKaTeX) window.ensureKaTeX().then(replay); else replay();
          }
        } catch(err) { detail.innerHTML = '<div style="padding:1rem;color:var(--color-error)">Failed to load submission: ' + escapeHtml(err.message) + '</div>'; }
      });
    });
  } catch(err) { alert("Failed to load submissions: " + err.message); }
}