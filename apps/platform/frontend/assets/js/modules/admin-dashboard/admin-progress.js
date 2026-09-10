  async function loadAdminProgress() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const [students, teachers, subjects, distribution] = await Promise.all([
        request("/students"),
        request("/teachers"),
        request("/subjects"),
        request("/analytics/lesson-distribution"),
      ]);
      if (!students || !Array.isArray(students?.items)) {
        showAdminView('<div class="content"><h2>Platform Progress</h2><div class="empty-state"><p>Unable to load progress data. Your session may have expired. <a href="#" id="reload-link">Click here to reload</a>.</p></div></div>');
        document.getElementById("reload-link")?.addEventListener("click", (e) => { e.preventDefault(); loadAdminProgress(); });
        return;
      }
      const dist = Array.isArray(distribution) ? distribution : [];
      const lessonCount = dist.length;

      showAdminView(`
        <div class="content">
          <h2>Platform Progress</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-top:0.5rem">
            <div class="card" style="padding:0.75rem"><h4>Students</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(students?.items) ? students.items.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Teachers</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(teachers?.items) ? teachers.items.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Lessons</h4><p style="font-size:1.6rem;font-weight:700">${lessonCount}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Subjects</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(subjects) ? subjects.length : 0}</p></div>
          </div>
          ${dist.length > 0 ? `
            <h3 style="margin-top:1.5rem">Lesson Distribution</h3>
            <div style="margin-top:0.5rem">
              ${dist.map(d => `
                <div style="margin-bottom:0.5rem">
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">
                    <span style="font-size:0.85rem">${escapeHtml(d.lesson_title)}</span>
                    <span style="font-size:0.85rem;color:var(--color-text-muted)">${d.avg_completion_percentage}% (${d.session_count} sessions)</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-bar-fill" style="width:${d.avg_completion_percentage}%"></div>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : '<div class="empty-state" style="margin-top:1rem"><p>No lesson progress data yet. Have students started lessons?</p></div>'}
        </div>
      `);
    } catch (err) {
      showAdminView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }
