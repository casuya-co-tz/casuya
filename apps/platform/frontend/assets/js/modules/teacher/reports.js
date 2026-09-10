// modules/teacher/reports.js — class reports view

async function loadReports(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading reports...</p></div>');
  try {
    const [students, lessons] = await Promise.all([
      request("/students"),
      request("/lessons"),
    ]);
    const studentList = Array.isArray(students?.items) ? students.items : [];
    const lessonList = Array.isArray(lessons) ? lessons : [];

    const studentProgress = [];
    const rows = await Promise.all(studentList.slice(0, 20).map(async (s) => {
      try {
        const progress = await request(`/progress/${s.id || s.user_id}`);
        if (Array.isArray(progress)) {
          const completed = progress.filter(p => p.completion_percentage >= 100).length;
          const scores = progress.filter(p => p.score_percentage != null && p.score_percentage > 0);
          const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score_percentage, 0) / scores.length) : 0;
          return {
            name: s.full_name || "Unknown",
            id: s.id || s.user_id,
            total: progress.length,
            completed,
            avgScore,
          };
        }
      } catch(e) {}
      return null;
    }));
    for (const r of rows) if (r) studentProgress.push(r);

    const topStudents = [...studentProgress].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
    const mostActive = [...studentProgress].sort((a, b) => b.completed - a.completed).slice(0, 5);

    dashboard.showView(`
      <div class="content">
        <h2>Class Reports</h2>
        <div class="stat-grid" style="margin:1rem 0">
          <div class="stat-card"><div class="stat-value">${studentList.length}</div><div class="stat-label">Total Students</div></div>
          <div class="stat-card"><div class="stat-value">${lessonList.length}</div><div class="stat-label">Total Lessons</div></div>
          <div class="stat-card"><div class="stat-value">${studentProgress.reduce((a, s) => a + s.completed, 0)}</div><div class="stat-label">Lessons Completed</div></div>
          <div class="stat-card"><div class="stat-value">${studentProgress.length > 0 ? Math.round(studentProgress.reduce((a, s) => a + s.avgScore, 0) / studentProgress.length) : 0}%</div><div class="stat-label">Class Average</div></div>
        </div>
        ${topStudents.length > 0 ? `
          <h3 style="margin:1.5rem 0 0.75rem">Top Performers</h3>
          <div class="card-grid">
            ${topStudents.map((s, i) => `
              <div class="card" style="padding:1rem">
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <span style="font-size:1.2rem;font-weight:700;color:var(--color-primary)">#${i + 1}</span>
                  <div>
                    <h4 style="margin:0">${escapeHtml(s.name)}</h4>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin:0.15rem 0 0">Avg: ${s.avgScore}% | ${s.completed} completed</p>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ''}
        ${mostActive.length > 0 ? `
          <h3 style="margin:1.5rem 0 0.75rem">Most Active Students</h3>
          <div class="card-grid">
            ${mostActive.map(s => `
              <div class="card" style="padding:1rem">
                <h4 style="margin:0">${escapeHtml(s.name)}</h4>
                <p style="color:var(--color-text-muted);font-size:0.85rem;margin:0.25rem 0 0">${s.completed}/${s.total} lessons completed | Avg: ${s.avgScore}%</p>
              </div>
            `).join("")}
          </div>
        ` : ''}
        ${studentProgress.length === 0 ? '<div class="empty-state"><p>No student progress data available yet.</p></div>' : ''}
      </div>
    `);
  } catch(e) {
    dashboard.showView('<div class="content"><h2>Reports</h2><div class="empty-state"><p>Error loading reports</p></div></div>');
  }
}
