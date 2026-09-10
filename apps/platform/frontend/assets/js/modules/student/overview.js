// modules/student/overview.js — dashboard overview with recently viewed,
// stats, class connection status, and subject cards.

"use strict";

function registerOverviewView(d) {
  async function loadStudentOverview() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading dashboard...</p></div>');
    try {
      const [subjects, profile, classRes] = await Promise.all([
        request("/subjects"),
        request("/students/me").catch(() => null),
        request("/classrooms/me").catch(() => null),
      ]);

      const isConnected = !!(classRes && classRes.classroom);
      const classTeacher = classRes?.teacher?.name || "";

      const name = profile?.full_name || d.payload.full_name || d.payload.email || "Student";
      const formLevel = profile?.form_level || "";

      const subjectList = Array.isArray(subjects) ? subjects : [];
      const iconColors = [
        { bg: "#eff6ff", color: "#2563eb", emoji: "📚" },
        { bg: "#f0fdf4", color: "#16a34a", emoji: "🧬" },
        { bg: "#fef3c7", color: "#d97706", emoji: "📐" },
        { bg: "#fce7f3", color: "#db2777", emoji: "🧪" },
        { bg: "#ede9fe", color: "#7c3aed", emoji: "🌍" },
        { bg: "#e0f2fe", color: "#0284c7", emoji: "💻" },
      ];

      let progressData = [];
      let totalCompleted = 0;
      let avgScore = 0;
      let streak = 0;
      let recent = [];
      let lessonsViewed = 0;
      try {
        if (profile?.id) {
          const [progressResult, statsResult] = await Promise.all([
            request(`/progress/${profile.id}`).catch(() => []),
            request(`/progress/${profile.id}/stats`).catch(() => null),
          ]);

          progressData = Array.isArray(progressResult) ? progressResult : [];
          if (progressData.length > 0) {
            totalCompleted = progressData.filter(p => p.completion_percentage >= 100).length;
            const scores = progressData.filter(p => p.score_percentage != null && p.score_percentage > 0);
            if (scores.length > 0) {
              avgScore = Math.round(scores.reduce((sum, p) => sum + p.score_percentage, 0) / scores.length);
            }
          }

          if (statsResult) {
            streak = statsResult.streak || 0;
            lessonsViewed = statsResult.lessonsViewed || 0;
            recent = Array.isArray(statsResult.recent) ? statsResult.recent : [];
            if (statsResult.avgScore != null) avgScore = statsResult.avgScore;
          }
        }
      } catch(e) {}

      if (recent.length === 0) {
        try { recent = d.getRecentlyViewed(); } catch(e) {}
        lessonsViewed = recent.length;
        if (streak === 0 && recent.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let checkDate = new Date(today);
          for (let i = 0; i < 30; i++) {
            const dayStr = checkDate.toISOString().slice(0, 10);
            const hasActivity = recent.some(r => {
              const rDate = new Date(r.viewedAt);
              return rDate.toISOString().slice(0, 10) === dayStr;
            });
            if (hasActivity) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }
      }

      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      d.showView(`
        <div class="content" style="max-width:960px">
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}${formLevel ? " — " + escapeHtml(formLevel) : ""}</h2>
            <p>Ready to continue your learning journey?</p>
          </div>

          ${isConnected ? `
            <div class="card" style="margin-bottom:1.25rem;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;background:#f0fdf4;border:1px solid #bbf7d0">
              <div>
                <strong style="color:#15803d">🎓 Connected to your class</strong>
                <p style="margin:0.15rem 0 0;font-size:0.85rem;color:var(--color-text-muted)">${classTeacher ? "Teacher: " + escapeHtml(classTeacher) : "Your teacher can now see your progress and assign lessons."}</p>
              </div>
              <button class="btn btn-sm" id="ov-view-class">View My Class</button>
            </div>
          ` : `
            <div class="card" style="margin-bottom:1.25rem;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;background:#eff6ff;border:1px solid #dbeafe">
              <div>
                <strong style="color:#1e40af">🔗 Connect to your teacher</strong>
                <p style="margin:0.15rem 0 0;font-size:0.85rem;color:var(--color-text-muted)">Enter your teacher's class code so they can see your progress and share lessons.</p>
              </div>
              <button class="btn btn-primary btn-sm" id="ov-connect-class">Enter Code</button>
            </div>
          `}

          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">📚</div>
              <div class="stat-value">${subjectList.length}</div>
              <div class="stat-label">Subjects${totalCompleted > 0 ? " · " + totalCompleted + " completed" : ""}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">📈</div>
              <div class="stat-value">${avgScore != null ? avgScore + "%" : "0%"}</div>
              <div class="stat-label">Average Score</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">🔥</div>
              <div class="stat-value">${streak != null ? streak : 0}</div>
              <div class="stat-label">Day Streak</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">🔖</div>
              <div class="stat-value">${lessonsViewed}</div>
              <div class="stat-label">Lessons Viewed</div>
            </div>
          </div>

          ${recent.length > 0 ? `
            <div class="section-header">
              <h3>Continue Learning</h3>
              <button class="btn btn-sm" id="view-all-recent">View All</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;margin-bottom:1.25rem">
              ${recent.slice(0, 3).map(r => `
                <div class="recent-lesson-card" data-id="${escapeHtml(r.id)}">
                  <h4>${escapeHtml(r.title)}</h4>
                  <span class="recent-meta">${r.viewedAt ? timeAgo(r.viewedAt) : ""}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}

          <div class="section-header">
            <h3>My Subjects</h3>
            <button class="btn btn-sm" id="browse-all-subjects">Browse All</button>
          </div>
          ${subjectList.length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No subjects available yet</p></div>'
            : `<div class="subject-card-grid">
                ${subjectList.map((s, i) => {
                  const ic = iconColors[i % iconColors.length];
                  const subjProgress = progressData.filter(p => p.subject_name === s.name);
                  const completedCount = subjProgress.filter(p => p.completion_percentage >= 100).length;
                  const totalCount = subjProgress.length;
                  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  return `
                    <div class="subject-card-enhanced" data-id="${escapeHtml(s.id)}">
                      <div class="subject-icon" style="background:${ic.bg};color:${ic.color}">${ic.emoji}</div>
                      <h4>${escapeHtml(s.name)}</h4>
                      ${totalCount > 0 ? `
                        <div class="subject-progress">
                          <div class="subject-progress-label">
                            <span>${completedCount}/${totalCount} lessons</span>
                            <span>${pct}%</span>
                          </div>
                          <div class="progress-bar">
                            <div class="progress-bar-fill" style="width:${pct}%"></div>
                          </div>
                        </div>
                      ` : `<p style="font-size:0.8rem;color:var(--color-text-muted);margin:0">Start learning →</p>`}
                    </div>
                  `;
                }).join("")}
              </div>`
          }
        </div>
      `);

      document.querySelectorAll(".subject-card-enhanced").forEach(card => {
        card.addEventListener("click", () => d.callView("subject-topics", card.dataset.id));
      });

      document.querySelectorAll(".recent-lesson-card").forEach(card => {
        card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
      });

      document.getElementById("browse-all-subjects")?.addEventListener("click", () => {
        d.setActiveNav("subjects");
        d.callView("subjects");
      });

      document.getElementById("view-all-recent")?.addEventListener("click", () => {
        d.setActiveNav("subjects");
        d.callView("subjects");
      });

      document.getElementById("ov-view-class")?.addEventListener("click", () => {
        d.setActiveNav("class");
        d.callView("class");
      });
      document.getElementById("ov-connect-class")?.addEventListener("click", () => {
        d.setActiveNav("class");
        d.callView("class");
      });

    } catch(e) {
      d.showView('<div class="empty-state"><p>Error loading dashboard</p></div>');
    }
  }

  d.registerView("dashboard", loadStudentOverview);
}
