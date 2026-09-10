  async function loadAdminAnalytics() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading analytics...</p></div>');
    try {
      const [overview, distribution] = await Promise.all([
        request("/analytics/overview"),
        request("/analytics/lesson-distribution").catch(() => []),
      ]);
      const lessons = await request("/lessons").catch(() => []);
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const perLesson = await Promise.all(
        lessonList.slice(0, 10).map(async (l) => {
          try {
            const a = await request(`/analytics/lessons/${l.id}`);
            return a ? { ...a, title: l.title } : null;
          } catch (e) { return null; }
        })
      );
      const lessonAnalytics = perLesson.filter(Boolean);
      showAdminView(`
        <div class="content">
          <h2>Analytics</h2>
          <div class="stat-grid" style="margin:1rem 0">
            <div class="stat-card"><div class="stat-value">${overview?.total_students ?? 0}</div><div class="stat-label">Students</div></div>
            <div class="stat-card"><div class="stat-value">${overview?.total_lessons ?? 0}</div><div class="stat-label">Lessons</div></div>
            <div class="stat-card"><div class="stat-value">${overview?.total_sessions ?? 0}</div><div class="stat-label">Sessions</div></div>
            <div class="stat-card"><div class="stat-value">${overview?.avg_completion_rate ?? 0}%</div><div class="stat-label">Avg Completion</div></div>
          </div>
          ${Array.isArray(distribution) && distribution.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Lesson Distribution</h3>
            <div class="card-grid">
              ${distribution.map(d => `
                <div class="card" style="padding:1rem">
                  <h4 style="margin:0 0 0.25rem">${escapeHtml(d.lesson_title || "Untitled Lesson")}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">${d.session_count ?? 0} sessions · ${d.avg_completion_percentage ?? 0}% completion</p>
                </div>
              `).join("")}
            </div>
          ` : ''}
          ${lessonAnalytics.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Per-Lesson Analytics</h3>
            <div class="card-grid">
              ${lessonAnalytics.map(a => `
                <div class="card" style="padding:1rem">
                  <h4 style="margin:0 0 0.25rem">${escapeHtml(a.title)}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">Sessions: ${a.session_count ?? 0} | Avg Completion: ${a.avg_completion_percentage ?? 0}% | Avg Score: ${a.avg_score_percentage ?? 0}%</p>
                </div>
              `).join("")}
            </div>
          ` : ''}
        </div>
      `);
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading analytics</p></div>'); }
  }
