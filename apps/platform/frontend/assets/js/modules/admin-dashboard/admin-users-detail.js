  async function viewAdminUser(userId, userType, userName) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading user...</p></div>');
    try {
      let userData = null;
      let progressData = [];
      if (userType === "student") {
        [userData, progressData] = await Promise.all([
          request(`/students/${userId}`).catch(() => null),
          request(`/progress/${userId}`).catch(() => []),
        ]);
      } else {
        userData = await request(`/teachers/${userId}`).catch(() => null);
      }

      const progressList = Array.isArray(progressData) ? progressData : [];
      const totalCompleted = progressList.filter(p => p.completion_percentage >= 100).length;
      const scores = progressList.filter(p => p.score_percentage != null && p.score_percentage > 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score_percentage, 0) / scores.length) : 0;

      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
            <button class="btn" id="back-btn">← Back</button>
            <h2>${escapeHtml(userName)}</h2>
            <span style="font-size:0.75rem;padding:0.2rem 0.6rem;background:${userType === "student" ? "#eff6ff" : "#f0fdf4"};color:${userType === "student" ? "#2563eb" : "#16a34a"};border-radius:var(--radius);font-weight:600">${userType === "student" ? "Student" : "Teacher"}</span>
          </div>

          <div class="card" style="margin-bottom:1rem">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem">
              <div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Name</div>
                <div style="font-size:0.9rem">${escapeHtml(userData?.full_name || "N/A")}</div>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Email</div>
                <div style="font-size:0.9rem">${escapeHtml(userData?.email || "N/A")}</div>
              </div>
              ${userData?.phone ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Phone</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.phone)}</div>
              </div>` : ""}
              ${userData?.form_level ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Form Level</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.form_level)}</div>
              </div>` : ""}
              ${userData?.subjects ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Subjects</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.subjects)}</div>
              </div>` : ""}
            </div>
          </div>

          ${userType === "student" && progressList.length > 0 ? `
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
            ${(() => {
              const bySubject = {};
              progressList.forEach(p => {
                const subj = p.subject_name || "General";
                if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
                bySubject[subj].total++;
                if (p.completion_percentage >= 100) bySubject[subj].completed++;
              });
              return Object.entries(bySubject).map(([name, data]) => {
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return `
                  <div class="card" style="margin-bottom:0.75rem">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                      <strong>${escapeHtml(name)}</strong>
                      <span style="font-size:0.85rem;color:var(--color-text-muted)">${data.completed}/${data.total} · ${pct}%</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join("");
            })()}
          ` : userType === "student" ? `
            <div class="empty-state" style="padding:2rem"><p>No progress data yet</p></div>
          ` : ""}

          ${userType === "teacher" ? `
            <div class="section-header" style="margin-top:1rem">
              <h3>Teacher Actions</h3>
            </div>
            <div class="card" style="padding:1rem">
              <p style="color:var(--color-text-muted);font-size:0.85rem">Teacher progress and class analytics are available in the teacher portal.</p>
            </div>
          ` : ""}
        </div>
      `);

      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    } catch (err) {
      showAdminView(`<div class="empty-state"><p>Error loading user details</p><button class="btn" id="back-btn">← Back</button></div>`);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    }
  }
