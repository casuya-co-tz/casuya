// modules/admin-dashboard/01-overview/greeting.js — admin overview greeting + KPIs + quick actions

  async function loadAdminOverview() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const overview = await request("/analytics/overview");
      const name = payload.full_name || payload.email || "Admin";

      // Greeting based on time
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      showAdminView(`
        <div class="content" style="max-width:960px">
          <!-- Welcome Banner -->
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}</h2>
            <p>Here's your platform overview at a glance.</p>
          </div>

          <!-- Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">👥</div>
              <div class="stat-value">${overview?.total_students ?? 0}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">👩‍🏫</div>
              <div class="stat-value">${overview?.total_teachers ?? 0}</div>
              <div class="stat-label">Teachers</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">📝</div>
              <div class="stat-value">${overview?.total_lessons ?? 0}</div>
              <div class="stat-label">Lessons</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">❓</div>
              <div class="stat-value">${overview?.total_quizzes ?? 0}</div>
              <div class="stat-label">Quizzes</div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="section-header">
            <h3>Quick Actions</h3>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem">
            <div class="recent-lesson-card" data-nav="subjects" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">📚</div>
              <h4 style="margin:0">Manage Subjects</h4>
            </div>
            <div class="recent-lesson-card" data-nav="lessons" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">📝</div>
              <h4 style="margin:0">Manage Lessons</h4>
            </div>
            <div class="recent-lesson-card" data-nav="users" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">👥</div>
              <h4 style="margin:0">Manage Users</h4>
            </div>
            <div class="recent-lesson-card" data-nav="progress" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">📈</div>
              <h4 style="margin:0">View Progress</h4>
            </div>
          </div>
        </div>
      `);

      // Wire up quick action clicks
      document.querySelectorAll("#admin-content .recent-lesson-card[data-nav]").forEach(el => {
        el.addEventListener("click", () => {
          const view = el.dataset.nav;
          if (navHandlers[view]) navHandlers[view]();
        });
      });
    } catch (err) {
      showAdminView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }