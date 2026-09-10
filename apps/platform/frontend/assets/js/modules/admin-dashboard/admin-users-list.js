  async function loadAdminUsers() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>');
    try {
      const [students, teachers] = await Promise.all([request("/students"), request("/teachers")]);
      if (!students || !Array.isArray(students?.items)) {
        showAdminView('<div class="content"><h2>Users</h2><div class="empty-state"><p>Unable to load users. Your session may have expired. <a href="#" id="reload-link">Click here to reload</a>.</p></div></div>');
        document.getElementById("reload-link")?.addEventListener("click", (e) => { e.preventDefault(); loadAdminUsers(); });
        return;
      }
      const sList = students.items;
      const tList = Array.isArray(teachers?.items) ? teachers.items : [];
      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Users</h2>
            <button class="btn btn-primary" id="register-user-btn">+ Register User</button>
          </div>
          <div id="user-form-area"></div>

          <div class="section-header" style="margin-top:1.5rem">
            <h3>Students (${sList.length})</h3>
          </div>
          <div class="card-grid">
            ${sList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No students registered</p></div>' :
              sList.map(s => `
                <div class="card user-card" data-id="${escapeHtml(s.id || s.user_id)}" data-type="student" data-name="${escapeHtml(s.full_name || '')}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${escapeHtml((s.full_name || "S").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h4 style="margin:0;font-size:0.9rem">${escapeHtml(s.full_name || "Unnamed")}</h4>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.email || "")} ${s.form_level ? "· " + escapeHtml(s.form_level) : ""}</p>
                    </div>
                  </div>
                </div>
              `).join("")}
          </div>

          <div class="section-header" style="margin-top:1.5rem">
            <h3>Teachers (${tList.length})</h3>
          </div>
          <div class="card-grid">
            ${tList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No teachers registered</p></div>' :
              tList.map(t => `
                <div class="card user-card" data-id="${escapeHtml(t.id || t.user_id)}" data-type="teacher" data-name="${escapeHtml(t.full_name || '')}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${escapeHtml((t.full_name || "T").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h4 style="margin:0;font-size:0.9rem">${escapeHtml(t.full_name || "Unnamed")}</h4>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.email || "")} ${t.subjects ? "· " + escapeHtml(t.subjects) : ""}</p>
                    </div>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .user-card").forEach(card => {
        card.addEventListener("click", () => viewAdminUser(card.dataset.id, card.dataset.type, card.dataset.name));
      });
      document.getElementById("register-user-btn")?.addEventListener("click", () => {
        document.getElementById("user-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Register New User</h3>
            <form id="register-user-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Full Name</label>
                <input class="input" name="full_name" placeholder="John Doe" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Email</label>
                <input class="input" type="email" name="email" placeholder="john@example.com" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Password</label>
                <input class="input" type="password" name="password" placeholder="Min 6 characters" required minlength="6">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Phone</label>
                <input class="input" name="phone" placeholder="+255...">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Role</label>
                <select class="input" name="role" required>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Form Level (Students)</label>
                <select class="input" name="form_level">
                  <option value="">N/A</option>
                  <option value="Form I">Form I</option>
                  <option value="Form II">Form II</option>
                  <option value="Form III">Form III</option>
                  <option value="Form IV">Form IV</option>
                  <option value="Form V">Form V</option>
                  <option value="Form VI">Form VI</option>
                </select>
              </div>
              <div style="grid-column:1/-1;display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit">Register</button>
                <button class="btn" type="button" id="cancel-register">Cancel</button>
              </div>
            </form>
            <div id="register-user-result" style="margin-top:0.75rem;font-size:0.85rem"></div>
          </div>
        `;
        document.getElementById("cancel-register").addEventListener("click", () => document.getElementById("user-form-area").innerHTML = "");
        document.getElementById("register-user-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                full_name: fd.get("full_name"),
                email: fd.get("email"),
                password: fd.get("password"),
                phone: fd.get("phone") || null,
                role: fd.get("role"),
                form_level: fd.get("form_level") || null,
              }),
            });
            document.getElementById("register-user-result").innerHTML = '<span style="color:var(--color-success)">User registered!</span>';
            setTimeout(() => loadAdminUsers(), 1000);
          } catch(err) {
            document.getElementById("register-user-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(err.message)}</span>`;
          }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading users</p></div>'); }
  }
