// modules/teacher/class.js — class management view

async function loadClass(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading your class...</p></div>');
  try {
    const [res, teacherLessons] = await Promise.all([
      request("/classrooms/me/students?_t=" + Date.now()).catch(() => null),
      request("/lessons").catch(() => []),
    ]);
    const classroom = res?.classroom || await request("/classrooms/me?_t=" + Date.now());
    const students = Array.isArray(res?.students) ? res.students : [];
    const code = classroom?.code || "";
    const className = classroom?.name || "";
    const limit = classroom?.lesson_limit ?? 2;
    const pubCount = Array.isArray(teacherLessons) ? teacherLessons.filter(l => l.status === "published").length : 0;

    dashboard.showView(`
      <div class="content" style="max-width:960px">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>My Class</h2>
        </div>

        <div class="card" style="margin-bottom:1.25rem;padding:1.5rem;background:linear-gradient(135deg,#eff6ff,#ede9fe);border:1px solid #dbeafe;text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">
            <span style="font-size:1.05rem;font-weight:700;color:#1e3a8a" id="manage-class-name-display">${escapeHtml(className || "My Class")}</span>
            <button class="btn btn-sm" id="edit-class-name" title="Edit class name">✏️ Edit</button>
          </div>
          <div id="manage-class-name-edit" style="display:none;max-width:320px;margin:0 auto 0.5rem;gap:0.5rem;align-items:center">
            <input class="input" id="manage-class-name-input" value="${escapeHtml(className)}" maxlength="80" placeholder="Class name (e.g. Form Two East)" style="text-align:center">
            <div style="display:flex;gap:0.4rem;justify-content:center;margin-top:0.4rem">
              <button class="btn btn-sm btn-success" id="save-class-name">Save</button>
              <button class="btn btn-sm" id="cancel-class-name">Cancel</button>
            </div>
            <p id="class-name-status" style="display:none;font-size:0.8rem;margin:0.25rem 0 0"></p>
          </div>
          <div style="font-size:0.8rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em">Share this code with your students</div>
          <p style="margin:0.4rem auto 0;font-size:0.9rem;color:var(--color-text-muted);max-width:460px">
            Tell students to open <b>Connect to Teacher</b> on their dashboard, paste this code, and save it.
          </p>
          <div id="manage-class-code" style="font-size:3rem;font-weight:800;letter-spacing:0.35em;color:#1e40af;font-family:monospace;margin:0.75rem 0">${escapeHtml(code)}</div>
          <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap">
            <button class="btn" id="copy-manage-code">Copy Code</button>
            <button class="btn" id="regenerate-code">↻ Regenerate Code</button>
          </div>
          <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">Lesson allowance: <b>${pubCount}/${limit}</b> published</p>
        </div>

        <div class="section-header">
          <h3>Connected Students (${students.length})</h3>
          <button class="btn btn-sm" id="refresh-students">↻ Refresh</button>
        </div>
        ${students.length === 0 ? `
          <div class="empty-state" style="padding:2rem">
            <p>No students connected yet.</p>
            <p style="font-size:0.85rem;color:var(--color-text-muted)">Share your class code with students — once they paste and save it, they will appear here and you can see their progress.</p>
            <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem">
              <button class="btn" id="copy-manage-code-empty">Copy Code</button>
              <button class="btn btn-primary" id="view-lessons-empty">View Your Lessons</button>
            </div>
          </div>` :
          `<div class="card-grid">
            ${students.map(s => {
              const stats = s.stats || { lessons_completed: 0, avg_score: 0, assignments_submitted: 0 };
              return `
              <div class="card student-card" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.full_name || s.email || "Student")}" style="cursor:pointer">
                <div style="display:flex;align-items:center;gap:0.75rem">
                  <div style="width:40px;height:40px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;flex-shrink:0">${escapeHtml((s.full_name || "S").charAt(0).toUpperCase())}</div>
                  <div style="flex:1;min-width:0">
                    <h3 style="margin:0;font-size:0.95rem">${escapeHtml(s.full_name || s.email || "Student")}</h3>
                    <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(s.email || "")} ${s.form_level ? "— " + escapeHtml(s.form_level) : ""}</p>
                    ${s.joined_at ? `<p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.7rem">Joined ${new Date(s.joined_at).toLocaleDateString()}</p>` : ""}
                  </div>
                  <span style="color:var(--color-text-muted);font-size:0.8rem">→</span>
                </div>
                <div style="display:flex;gap:0.4rem;margin-top:0.75rem;flex-wrap:wrap">
                  <span class="student-stat-chip" title="Lessons completed">✅ ${stats.lessons_completed}</span>
                  <span class="student-stat-chip" title="Average score">📈 ${stats.avg_score}%</span>
                  <span class="student-stat-chip" title="Assignments submitted">📝 ${stats.assignments_submitted}</span>
                </div>
              </div>`;
            }).join("")}
          </div>`}
      </div>
    `);
    document.getElementById("back-btn").addEventListener("click", () => loadOverview(dashboard));
    document.getElementById("copy-manage-code")?.addEventListener("click", () => {
      const code = document.getElementById("manage-class-code").textContent;
      const done = () => { const b = document.getElementById("copy-manage-code"); if (b) { const t=b.textContent; b.textContent="Copied ✓"; setTimeout(()=>b.textContent=t,1500);} };
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(code).then(done).catch(done); } else done();
    });
    document.getElementById("copy-manage-code-empty")?.addEventListener("click", () => {
      const done = () => { const b = document.getElementById("copy-manage-code-empty"); if (b) { const t=b.textContent; b.textContent="Copied ✓"; setTimeout(()=>b.textContent=t,1500);} };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done).catch(done); else done();
    });
    document.getElementById("view-lessons-empty")?.addEventListener("click", () => loadLessons(dashboard));
    document.getElementById("regenerate-code").addEventListener("click", async () => {
      if (!confirm("Regenerate your class code? Students using the old code will need the new one.")) return;
      try {
        const res = await request("/classrooms/me/code/regenerate", { method: "POST", body: "{}" });
        const el = document.getElementById("manage-class-code");
        if (el && res?.code) el.textContent = res.code;
      } catch(e) { alert("Failed to regenerate code: " + e.message); }
    });
    document.getElementById("refresh-students")?.addEventListener("click", () => loadClass(dashboard));
    document.getElementById("edit-class-name")?.addEventListener("click", () => {
      document.getElementById("manage-class-name-display").style.display = "none";
      const editRow = document.getElementById("manage-class-name-edit");
      editRow.style.display = "block";
      const input = document.getElementById("manage-class-name-input");
      input.focus();
    });
    document.getElementById("cancel-class-name")?.addEventListener("click", () => {
      document.getElementById("manage-class-name-edit").style.display = "none";
      document.getElementById("manage-class-name-display").style.display = "";
    });
    document.getElementById("save-class-name")?.addEventListener("click", async () => {
      const input = document.getElementById("manage-class-name-input");
      const status = document.getElementById("class-name-status");
      const name = (input.value || "").trim();
      if (!name) { status.style.display = "block"; status.style.color = "red"; status.textContent = "Enter a class name first."; return; }
      status.style.display = "block";
      status.style.color = "var(--color-text-muted)";
      status.style.marginTop = "0.4rem";
      status.style.fontSize = "0.8rem";
      status.textContent = "Saving...";
      try {
        await request("/classrooms/me", { method: "POST", body: JSON.stringify({ name }) });
        document.getElementById("manage-class-name-edit").style.display = "none";
        const display = document.getElementById("manage-class-name-display");
        display.textContent = name;
        display.style.display = "";
        status.style.display = "none";
        showToast("Class name saved");
      } catch(e) {
        status.style.color = "red";
        status.textContent = e.message || "Could not save class name.";
      }
    });
    document.querySelectorAll("#teacher-content .student-card").forEach(card => {
      card.addEventListener("click", () => viewStudent(dashboard, card.dataset.id, card.dataset.name));
    });
  } catch (err) {
    dashboard.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
  }
}
