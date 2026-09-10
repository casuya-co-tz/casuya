// modules/student/class-view.js — "My Class" view (connect to teacher,
// view classmates, published lessons and assignments).

"use strict";

function registerClassView(d) {
  async function loadStudentClass() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const res = await request("/classrooms/me?_t=" + Date.now()).catch(() => null);
      const classroom = res?.classroom || null;
      const teacher = res?.teacher || null;
      const classmatesCount = res?.classmates_count ?? 0;
      const publishedLessons = Array.isArray(res?.published_lessons) ? res.published_lessons : [];
      const assignments = Array.isArray(res?.assignments) ? res.assignments : [];

      d.showView(`
        <div class="content" style="max-width:820px">
          <h2>My Class</h2>

          ${classroom ? `
            <div class="card" style="margin:1rem 0;padding:1.5rem;background:linear-gradient(135deg,#eff6ff,#ede9fe);border:1px solid #dbeafe;text-align:center">
              <div style="font-size:2rem">🎓</div>
              <h3 style="margin:0.5rem 0 0.25rem">${classroom.name ? escapeHtml(classroom.name) : "You're connected!"}</h3>
              <p style="margin:0 0 0.5rem;color:var(--color-text-muted);font-size:0.9rem">
                ${teacher?.name ? "Your teacher: <b>" + escapeHtml(teacher.name) + "</b>" : "Connected to your teacher's class."}
                ${classmatesCount > 0 ? " · <b>" + classmatesCount + "</b> classmate" + (classmatesCount === 1 ? "" : "s") : ""}
              </p>
              <div style="font-size:0.75rem;color:var(--color-text-muted);margin:0.5rem 0 0.25rem">Class Code</div>
              <div style="font-family:monospace;font-weight:800;letter-spacing:0.3em;font-size:1.6rem;color:#1e40af">${escapeHtml(classroom.code)}</div>
              <button class="btn btn-danger" id="leave-class" style="margin-top:1rem">Leave Class</button>
            </div>

            <div class="stat-grid" style="margin-bottom:1.25rem">
              <div class="stat-card">
                <div class="stat-icon" style="background:#eff6ff;color:#2563eb">👥</div>
                <div class="stat-value">${classmatesCount}</div>
                <div class="stat-label">Classmates</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">📚</div>
                <div class="stat-value">${publishedLessons.length}</div>
                <div class="stat-label">Lessons Shared</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#fef3c7;color:#d97706">📋</div>
                <div class="stat-value">${assignments.length}</div>
                <div class="stat-label">Assignments</div>
              </div>
            </div>

            ${teacher ? `
              <div class="card" style="margin-bottom:1.25rem;padding:1.25rem">
                <div style="display:flex;align-items:center;gap:0.9rem">
                  <div style="width:48px;height:48px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;flex-shrink:0">${escapeHtml((teacher.name || "T").charAt(0).toUpperCase())}</div>
                  <div style="min-width:0">
                    <h3 style="margin:0;font-size:1.05rem">${escapeHtml(teacher.name || "Your Teacher")}</h3>
                    <p style="margin:0.2rem 0 0;color:var(--color-text-muted);font-size:0.85rem">
                      ${teacher.email ? escapeHtml(teacher.email) : ""}
                      ${teacher.subjects ? " · " + escapeHtml(teacher.subjects) : ""}
                    </p>
                  </div>
                </div>
              </div>
            ` : ""}

            <div class="section-header">
              <h3>Lessons from your teacher</h3>
            </div>
            ${publishedLessons.length === 0
              ? '<div class="empty-state" style="padding:1.5rem"><p>Your teacher hasn\'t shared any lessons yet.</p></div>'
              : `<div class="card-grid" style="margin-bottom:1.25rem">
                  ${publishedLessons.map(l => `
                    <div class="card lesson-card clickable" data-id="${escapeHtml(l.id)}" style="cursor:pointer">
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.78rem;margin:0.25rem 0 0">📚 Shared lesson</p>
                    </div>
                  `).join("")}
                </div>`}

            <div class="section-header">
              <h3>Assignments from your teacher</h3>
            </div>
            ${assignments.length === 0
              ? '<div class="empty-state" style="padding:1.5rem"><p>No assignments yet. Check back later.</p></div>'
              : assignments.map(a => `
                  <div class="card" style="padding:0.9rem 1.1rem;margin-bottom:0.5rem;cursor:pointer" data-open-assignment="${escapeHtml(a.id)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
                      <div style="min-width:0">
                        <h4 style="margin:0">${escapeHtml(a.title)}</h4>
                        <p style="color:var(--color-text-muted);font-size:0.8rem;margin:0.2rem 0 0">
                          ${a.due_date ? "Due: " + new Date(a.due_date).toLocaleDateString() : "No due date"}
                          ${a.lesson_title ? " · " + escapeHtml(a.lesson_title) : ""}
                        </p>
                      </div>
                      <span class="btn btn-sm btn-primary">Open</span>
                    </div>
                  </div>
                `).join("")}
          ` : `
            <div class="card" style="margin:1rem 0;padding:1.5rem">
              <div style="font-size:2rem;text-align:center">🏫</div>
              <h3 style="text-align:center;margin:0.5rem 0">Connect to your teacher</h3>
              <p style="text-align:center;color:var(--color-text-muted);font-size:0.9rem;max-width:440px;margin:0 auto 1.25rem">
                Your teacher will give you a <b>class code</b>. Enter it below and press <b>Save</b> to join their class — then they can see your progress, publish lessons and assign work to you.
              </p>
              <form id="class-join-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:360px;margin:0 auto">
                <div>
                  <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Class Code</label>
                  <input class="input" id="class-code-input" placeholder="e.g. XK7P2M" maxlength="12" style="text-align:center;font-family:monospace;font-weight:700;letter-spacing:0.2em;text-transform:uppercase" required>
                </div>
                <button class="btn btn-primary" type="submit">Save & Connect</button>
                <p id="class-join-status" style="display:none;font-size:0.85rem;margin:0;text-align:center"></p>
              </form>
            </div>
          `}
        </div>
      `);

      if (classroom) {
        document.getElementById("leave-class")?.addEventListener("click", async () => {
          if (!confirm("Leave your teacher's class? You will need a new code to reconnect.")) return;
          try {
            await request("/classrooms/leave", { method: "POST", body: "{}" });
            loadStudentClass();
          } catch(e) { alert("Failed to leave: " + e.message); }
        });
        document.querySelectorAll(".lesson-card.clickable[data-id]").forEach(card => {
          card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
        });
        document.querySelectorAll("[data-open-assignment]").forEach(card => {
          card.addEventListener("click", () => d.callView("open-assignment", card.dataset.openAssignment));
        });
      } else {
        const form = document.getElementById("class-join-form");
        form?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const status = document.getElementById("class-join-status");
          const input = document.getElementById("class-code-input");
          const code = (input.value || "").trim().toUpperCase();
          if (!code) { status.style.display = "block"; status.style.color = "red"; status.textContent = "Please enter your class code."; return; }
          status.style.display = "block";
          status.style.color = "var(--color-text-muted)";
          status.textContent = "Connecting...";
          try {
            const res = await request("/classrooms/join", {
              method: "POST",
              body: JSON.stringify({ code }),
            });
            status.style.color = "var(--color-success)";
            status.textContent = res?.message || "Connected!";
            setTimeout(() => loadStudentClass(), 1000);
          } catch(err) {
            status.style.color = "red";
            status.textContent = err.message || "Could not connect. Check the code and try again.";
          }
        });
      }
    } catch (err) {
      d.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  d.registerView("class", loadStudentClass);
}
