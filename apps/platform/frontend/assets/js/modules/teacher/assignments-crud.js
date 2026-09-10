// modules/teacher/assignments-crud.js — assignments management with AI exam generation
// List/create/edit/delete + exam paper preview. Submission grading moved to
// assignments-grading.js (openAssignmentSubmissions).

async function loadAssignments(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading assignments...</p></div>');
  try {
    const [lessons, students, assignments] = await Promise.all([
      request("/lessons"),
      request("/students"),
      request("/assignments").catch(() => []),
    ]);
    const lessonList = Array.isArray(lessons) ? lessons : [];
    const studentList = Array.isArray(students?.items) ? students.items : [];
    const assignmentList = Array.isArray(assignments) ? assignments : [];

    dashboard.showView(`
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
                  <div style="flex:1;min-width:0">
                    <h4 style="margin:0">${escapeHtml(a.title)}</h4>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml((a.lesson_title || a.lesson_id || "Unknown lesson"))}</p>
                    <p style="color:var(--color-text-muted);font-size:0.75rem;margin-top:0.15rem">Due: ${a.due_date ? new Date(a.due_date).toLocaleDateString() : "No due date"} | ${a.status}</p>
                    ${a.paper_summary ? `<p style="color:var(--color-accent);font-size:0.78rem;margin-top:0.15rem">📄 ${examPaperMetaLine(a.paper_summary)}</p>` : ""}
                  </div>
                  <div style="display:flex;gap:0.35rem;flex-shrink:0;margin-left:0.5rem">
                    <button class="btn btn-sm" data-open-assignment="${a.id}" title="View exam paper">Open</button>
                    <button class="btn btn-sm" data-edit-assignment="${a.id}" title="Edit assignment">Edit</button>
                    <button class="btn btn-sm" data-subs-assignment="${a.id}" title="View submissions">Submissions</button>
                    <button class="btn btn-sm btn-danger" data-delete-assignment="${a.id}" title="Delete assignment">Remove</button>
                  </div>
                </div>
              </div>
            `).join("")}
        </div>
      </div>
    `);
    document.getElementById("new-assignment-btn")?.addEventListener("click", () => {
      showAssignmentCreateForm(dashboard, lessonList);
    });
    document.querySelectorAll("[data-delete-assignment]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteAssignment;
        try {
          await request(`/assignments/${id}`, { method: "DELETE" });
          loadAssignments(dashboard);
        } catch(err) { alert("Failed to delete assignment"); }
      });
    });
    document.querySelectorAll("[data-open-assignment]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.openAssignment;
        try {
          const a = await request(`/assignments/${id}`);
          if (!a || !a.paper) { alert("This assignment has no exam paper attached."); return; }
          dashboard.showView(`
            <div class="content">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
                <button class="btn" id="back-to-list">← Back to Assignments</button>
                <h2 style="flex:1">${escapeHtml(a.title)}</h2>
              </div>
              <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.5rem">
                ${escapeHtml(a.lesson_title || "")} | Due: ${a.due_date ? new Date(a.due_date).toLocaleDateString() : "No due date"} | ${a.status}
              </p>
              ${renderExamPaper(a.paper, { mode: "preview", ns: "open-" + (a.paper.header?.form_level || 0) })}
            </div>
          `);
          document.getElementById("back-to-list").addEventListener("click", () => loadAssignments(dashboard));
        } catch(err) { alert("Failed to load assignment: " + err.message); }
      });
    });
    document.querySelectorAll("[data-edit-assignment]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.editAssignment;
        try {
          const a = await request(`/assignments/${id}`);
          if (!a) { alert("Assignment not found."); return; }
          document.getElementById("assignment-form-area").innerHTML = `
            <div class="card" style="margin-top:1rem;padding:1.5rem">
              <h3 style="margin-bottom:0.5rem">Edit Assignment</h3>
              <form id="edit-assignment-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                <div style="grid-column:1/-1">
                  <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Title</label>
                  <input class="input" name="title" id="edit-title" value="${escapeHtml(a.title)}" required>
                </div>
                <div>
                  <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Lesson</label>
                  <select class="input" name="lesson_id" id="edit-lesson">
                    ${lessonList.map(l => `<option value="${l.id}" ${l.id === a.lesson_id ? "selected" : ""}>${escapeHtml(l.title)}</option>`).join("")}
                  </select>
                </div>
                <div>
                  <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Due Date</label>
                  <input class="input" type="date" name="due_date" value="${a.due_date ? a.due_date.split("T")[0] : ""}">
                </div>
                <div style="grid-column:1/-1">
                  <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Notes</label>
                  <input class="input" name="notes" value="${escapeHtml(a.notes || "")}">
                </div>
                <div style="grid-column:1/-1;display:flex;gap:0.5rem;align-items:center">
                  <button class="btn btn-success" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-edit">Cancel</button>
                  <span id="edit-status" style="font-size:0.8rem;color:var(--color-text-muted)"></span>
                </div>
              </form>
            </div>
          `;
          document.getElementById("cancel-edit").addEventListener("click", () => document.getElementById("assignment-form-area").innerHTML = "");
          document.getElementById("edit-assignment-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const status = document.getElementById("edit-status");
            status.textContent = "Saving...";
            try {
              await request(`/assignments/${id}?` + new URLSearchParams({
                title: fd.get("title"),
                lesson_id: fd.get("lesson_id"),
                due_date: fd.get("due_date") || "",
                notes: fd.get("notes") || "",
              }), { method: "PUT" });
              document.getElementById("assignment-form-area").innerHTML = "";
              loadAssignments(dashboard);
            } catch(err) { status.textContent = "Failed: " + err.message; }
          });
        } catch(err) { alert("Failed to load assignment: " + err.message); }
      });
    });
    document.querySelectorAll("[data-subs-assignment]").forEach(btn => {
      btn.addEventListener("click", () => openAssignmentSubmissions(dashboard, btn.dataset.subsAssignment));
    });
  } catch(e) {
    dashboard.showView('<div class="content"><h2>Assignments</h2><div class="empty-state"><p>Error loading assignments</p></div></div>');
  }
}