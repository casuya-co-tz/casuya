// modules/teacher/overview.js — overview/dashboard view

async function loadOverview(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
  try {
    const [overview, lessons, classroomRes] = await Promise.all([
      request("/analytics/overview"),
      request("/lessons/?status=published"),
      request("/classrooms/me/students").catch(() => null),
    ]);
    const name = dashboard.payload.full_name || dashboard.payload.email || "Teacher";
    const classCode = classroomRes?.classroom?.code || "";
    const connectedCount = classroomRes?.total ?? 0;

    const hour = new Date().getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17) greeting = "Good evening";

    let recent = [];
    try { recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]"); } catch(e) {}

    let bookmarks = [];
    try { bookmarks = await request("/bookmarks"); } catch(e) {}

    dashboard.showView(`
      <div class="content" style="max-width:960px">
        <div class="welcome-banner">
          <small>${greeting}</small>
          <h2>Welcome, ${escapeHtml(name)}</h2>
          <p>Here's what's happening in your classes today.</p>
        </div>

        <div class="card" style="margin-bottom:1.25rem;padding:1.25rem;background:linear-gradient(135deg,#eff6ff,#ede9fe);border:1px solid #dbeafe;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
          <div>
            <div style="font-size:0.8rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em">Connect your students</div>
            <p style="margin:0.35rem 0 0;font-size:0.9rem;color:var(--color-text-muted);max-width:420px">
              Students join your class by pasting your code below into <b>Connect to Teacher</b>. Then you can see their progress and assign lessons.
            </p>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:0.25rem">Class Code</div>
            <div id="teacher-class-code" style="font-size:1.8rem;font-weight:800;letter-spacing:0.3em;color:#1e40af;font-family:monospace;cursor:pointer" title="Click to copy">${escapeHtml(classCode || "—")}</div>
            <div style="display:flex;gap:0.5rem;margin-top:0.5rem;justify-content:center">
              <button class="btn btn-sm" id="copy-class-code" ${classCode ? "" : "disabled"}>Copy Code</button>
              <button class="btn btn-sm" id="manage-class">Manage Class</button>
            </div>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:#eff6ff;color:#2563eb">👥</div>
            <div class="stat-value">${connectedCount}</div>
            <div class="stat-label">Connected Students</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">📝</div>
            <div class="stat-value">${Array.isArray(lessons) ? lessons.length : 0}</div>
            <div class="stat-label">Lessons</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fef3c7;color:#d97706">📈</div>
            <div class="stat-value">${overview?.avg_completion_rate ? Math.round(overview.avg_completion_rate) + "%" : "0%"}</div>
            <div class="stat-label">Completion Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fce7f3;color:#db2777">🔖</div>
            <div class="stat-value">${Array.isArray(bookmarks) ? bookmarks.length : 0}</div>
            <div class="stat-label">Bookmarked</div>
          </div>
        </div>

        ${recent.length > 0 ? `
          <div class="section-header">
            <h3>Continue Editing</h3>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;margin-bottom:1.25rem">
            ${recent.slice(0, 3).map(r => `
              <div class="recent-lesson-card" data-id="${escapeHtml(r.id)}">
                <h4>${escapeHtml(r.title)}</h4>
                <span class="recent-meta">${r.time ? new Date(r.time).toLocaleDateString() : ""}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}

        <div class="section-header">
          <h3>${bookmarks.length > 0 ? "Bookmarked Lessons" : "Published Lessons"}</h3>
        </div>
        <div class="card-grid">
          ${!Array.isArray(lessons) || lessons.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No lessons available yet</p></div>' :
            (bookmarks.length > 0 ? bookmarks : lessons).map(l => `
              <div class="card lesson-card clickable" data-id="${escapeHtml(l.lesson_id || l.id)}" style="position:relative">
                <h3>${escapeHtml(l.lesson_title || l.title)}</h3>
                ${l.lesson_id ? '<span style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem">🔖</span>' : ""}
                <p style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(l.status || "bookmarked")}</p>
              </div>
            `).join("")}
        </div>
      </div>
    `);
    document.querySelectorAll("#teacher-content .lesson-card.clickable").forEach(el => {
      el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, () => loadLessons(dashboard)));
    });
    document.querySelectorAll("#teacher-content .recent-lesson-card").forEach(el => {
      el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, () => loadOverview(dashboard)));
    });
    document.getElementById("copy-class-code")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const codeEl = document.getElementById("teacher-class-code");
      if (!codeEl || codeEl.textContent === "—") return;
      const code = codeEl.textContent;
      const done = () => {
        const btn = document.getElementById("copy-class-code");
        if (btn) { const t = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => btn.textContent = t, 1500); }
      };
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(code).then(done).catch(done); }
      else { done(); }
    });
    document.getElementById("manage-class")?.addEventListener("click", () => loadClass(dashboard));
  } catch (err) {
    dashboard.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
  }
}
