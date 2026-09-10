// modules/teacher/students.js — student list and detail views

async function loadStudents(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
  try {
    const [studentsRes, classroom] = await Promise.all([
      request("/students"),
      request("/classrooms/me").catch(() => null),
    ]);
    const students = studentsRes?.items;
    const sList = Array.isArray(students) ? students : [];
    const code = classroom?.code || "";
    dashboard.showView(`
      <div class="content" style="max-width:960px">
        <h2>Students</h2>
        ${code ? `
          <div class="card" style="margin:1rem 0;padding:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;background:#eff6ff;border:1px solid #dbeafe">
            <div>
              <strong style="color:#1e40af">Class Code:</strong>
              <span style="font-family:monospace;font-weight:800;letter-spacing:0.2em;font-size:1.1rem">${escapeHtml(code)}</span>
            </div>
            <button class="btn btn-sm" id="students-copy-code">Copy Code</button>
          </div>` : ""}
        <div class="card-grid" style="margin-top:1rem">
          ${sList.length === 0 ? '<div class="empty-state"><p>No students connected yet. Share your class code so students can join.</p></div>' :
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
    document.getElementById("students-copy-code")?.addEventListener("click", () => {
      const done = () => { const b = document.getElementById("students-copy-code"); if (b) { const t=b.textContent; b.textContent="Copied ✓"; setTimeout(()=>b.textContent=t,1500);} };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done).catch(done); else done();
    });
    document.querySelectorAll("#teacher-content .student-card").forEach(card => {
      card.addEventListener("click", () => viewStudent(dashboard, card.dataset.id, card.dataset.name));
    });
  } catch (err) {
    dashboard.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
  }
}

async function viewStudent(dashboard, studentId, studentName) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading student progress...</p></div>');
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

    dashboard.showView(`
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

    document.getElementById("back-btn")?.addEventListener("click", () => loadStudents(dashboard));
  } catch (err) {
    dashboard.showView(`<div class="empty-state"><p>Error loading student data</p><button class="btn" id="back-btn">← Back</button></div>`);
    document.getElementById("back-btn")?.addEventListener("click", () => loadStudents(dashboard));
  }
}
