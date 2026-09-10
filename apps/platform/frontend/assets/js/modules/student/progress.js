// modules/student/progress.js — progress tracking view.

"use strict";

function registerProgressView(d) {
  async function loadStudentProgress() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading progress...</p></div>');
    try {
      const profile = await request("/students/me");
      const studentId = profile?.id;
      if (!studentId) {
        d.showView('<div class="empty-state"><p>Could not load profile</p></div>');
        return;
      }
      const data = await request(`/progress/${studentId}`);
      const progress = Array.isArray(data) ? data : [];
      if (progress.length === 0) {
        d.showView('<div class="empty-state"><p>No progress recorded yet</p></div>');
        return;
      }
      const bySubject = {};
      progress.forEach(p => {
        const subj = p.subject_name || "General";
        if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
        bySubject[subj].total++;
        if (p.completion_percentage >= 100) bySubject[subj].completed++;
      });
      d.showView(`
        <h2>My Progress</h2>
        <div style="margin-top:1rem">
          ${Object.entries(bySubject).map(([name, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return `
              <div class="card" style="margin-bottom:0.75rem">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                  <strong>${escapeHtml(name)}</strong>
                  <span>${pct}%</span>
                </div>
                <div style="background:var(--color-border);height:8px;border-radius:4px">
                  <div style="background:var(--color-primary);height:100%;width:${pct}%;border-radius:4px"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `);
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading progress</p></div>'); }
  }

  d.registerView("progress", loadStudentProgress);
}
