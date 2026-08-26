  async function loadAdminBranding() {
    const API = window.casuyaApiBase ? window.casuyaApiBase() : ((window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80") ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:8765`);
    const token = localStorage.getItem("casuya_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};

    // Check what's currently uploaded
    let logoExists = false, faviconExists = false;
    try {
      const lr = await fetch(`${API}/branding/logo`);
      logoExists = lr.ok;
    } catch {}
    try {
      const fr = await fetch(`${API}/branding/favicon`);
      faviconExists = fr.ok;
    } catch {}

    showAdminView(`
      <div class="content">
        <h2>🎨 Site Branding</h2>
        <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:1.5rem">Upload your logo and favicon. These appear across the entire platform.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
          <!-- Logo -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">🖼️ Logo</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${logoExists
                ? `<img src="${API}/branding/logo" alt="Current logo" style="max-width:120px;max-height:120px;border-radius:12px;border:1px solid var(--color-border)">`
                : `<div style="width:120px;height:120px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${logoExists ? "✅ Custom logo active" : "Using default"}</p>
            </div>
            <form id="logo-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="logo-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${logoExists ? "🔄 Replace" : "📤 Upload"}</button>
                ${logoExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="logo-delete">🗑️ Delete</button>' : ''}
              </div>
            </form>
            <div id="logo-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>

          <!-- Favicon -->
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">🏷️ Favicon</h3>
            <div style="text-align:center;margin-bottom:1rem">
              ${faviconExists
                ? `<img src="${API}/branding/favicon" alt="Current favicon" style="width:64px;height:64px;border-radius:8px;border:1px solid var(--color-border)">`
                : `<div style="width:64px;height:64px;margin:0 auto;background:linear-gradient(135deg,var(--color-primary),#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:800">C</div>`
              }
              <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem">${faviconExists ? "✅ Custom favicon active" : "Using default"}</p>
            </div>
            <form id="favicon-upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <input class="input" type="file" id="favicon-file" accept="image/*" required />
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success btn-pattern" type="submit" style="flex:1">${faviconExists ? "🔄 Replace" : "📤 Upload"}</button>
                ${faviconExists ? '<button class="btn btn-outline-danger btn-sm" type="button" id="favicon-delete">🗑️ Delete</button>' : ''}
              </div>
            </form>
            <div id="favicon-result" style="margin-top:0.5rem;font-size:0.8rem"></div>
          </div>
        </div>
      </div>
    `);

    // Logo upload
    document.getElementById("logo-upload-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const file = document.getElementById("logo-file")?.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch(`${API}/branding/logo`, { method: "POST", headers, body: fd });
        const d = await r.json();
        if (r.ok) {
          document.getElementById("logo-result").innerHTML = '<span style="color:var(--color-success)">Logo uploaded!</span>';
          localStorage.removeItem("casuya_brand_logo");
          loadAdminBranding();
        } else {
          document.getElementById("logo-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(d.detail || "Failed")}</span>`;
        }
      } catch (e) {
        document.getElementById("logo-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(e.message)}</span>`;
      }
    });

    // Logo delete
    document.getElementById("logo-delete")?.addEventListener("click", async () => {
      try {
        await fetch(`${API}/branding/logo`, { method: "DELETE", headers });
        localStorage.removeItem("casuya_brand_logo");
        loadAdminBranding();
      } catch {}
    });

    // Favicon upload
    document.getElementById("favicon-upload-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const file = document.getElementById("favicon-file")?.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch(`${API}/branding/favicon`, { method: "POST", headers, body: fd });
        const d = await r.json();
        if (r.ok) {
          document.getElementById("favicon-result").innerHTML = '<span style="color:var(--color-success)">Favicon uploaded!</span>';
          localStorage.removeItem("casuya_brand_favicon");
          loadAdminBranding();
        } else {
          document.getElementById("favicon-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(d.detail || "Failed")}</span>`;
        }
      } catch (e) {
        document.getElementById("favicon-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(e.message)}</span>`;
      }
    });

    // Favicon delete
    document.getElementById("favicon-delete")?.addEventListener("click", async () => {
      try {
        await fetch(`${API}/branding/favicon`, { method: "DELETE", headers });
        localStorage.removeItem("casuya_brand_favicon");
        loadAdminBranding();
      } catch {}
    });
  }

  async function loadAdminAnalytics() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading analytics...</p></div>');
    try {
      const [overview, distribution] = await Promise.all([
        request("/analytics/overview"),
        request("/analytics/lesson-distribution").catch(() => []),
      ]);
      const lessons = await request("/lessons").catch(() => []);
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const lessonAnalytics = [];
      for (const l of lessonList.slice(0, 10)) {
        try {
          const a = await request(`/analytics/lessons/${l.id}`);
          if (a) lessonAnalytics.push({ ...a, title: l.title });
        } catch(e) {}
      }
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
                  <h4 style="margin:0 0 0.25rem">${escapeHtml(d.subject || d.topic || "Unknown")}</h4>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">${d.count ?? 0} lessons</p>
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

  async function loadAdminSettings() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [profile, branding] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/branding/logo").catch(() => null),
      ]);
      const activeTab = localStorage.getItem("admin_settings_tab") || "profile";

      function renderTab(tab) {
        localStorage.setItem("admin_settings_tab", tab);
        document.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        const panel = document.getElementById("settings-panel");
        if (!panel) return;

        if (tab === "profile") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Admin Profile</h3>
              <form id="admin-profile-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Full Name</label>
                  <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" placeholder="Your name">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Email</label>
                  <input class="input" value="${escapeHtml(profile.email || "")}" disabled style="opacity:0.6">
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">Email cannot be changed here</p>
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Phone</label>
                  <input class="input" name="phone" value="${escapeHtml(profile.phone || "")}" placeholder="Phone number">
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center">
                  <button class="btn btn-primary" type="submit">💾 Save Profile</button>
                  <span id="admin-profile-msg" style="font-size:0.85rem;display:none"></span>
                </div>
              </form>
            </div>
          `;
          document.getElementById("admin-profile-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("admin-profile-msg");
            try {
              await request("/users/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), phone: fd.get("phone") }) });
              msg.textContent = "✅ Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
          });
        } else if (tab === "security") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Change Password</h3>
              <form id="admin-pw-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Current Password</label>
                  <input class="input" name="current_password" type="password" required>
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">New Password</label>
                  <input class="input" name="new_password" type="password" required minlength="8">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Confirm New Password</label>
                  <input class="input" name="confirm_password" type="password" required>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center">
                  <button class="btn btn-primary btn-pattern" type="submit">🔐 Update Password</button>
                  <span id="admin-pw-msg" style="font-size:0.85rem;display:none"></span>
                </div>
              </form>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3 style="margin-bottom:0.75rem">Active Sessions</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">Manage your login sessions</p>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
                <div>
                  <p style="font-weight:500;margin:0;font-size:0.9rem">Current Session</p>
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin:0.15rem 0 0">Now · ${navigator.userAgent.slice(0, 60)}...</p>
                </div>
                <span style="color:var(--color-success);font-size:0.8rem;font-weight:600">🟢 Active</span>
              </div>
            </div>
          `;
          document.getElementById("admin-pw-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("admin-pw-msg");
            if (fd.get("new_password") !== fd.get("confirm_password")) {
              msg.textContent = "❌ Passwords do not match"; msg.style.color = "var(--color-danger)"; msg.style.display = "inline";
              return;
            }
            try {
              await request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), new_password: fd.get("new_password") }) });
              msg.textContent = "✅ Password updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              e.target.reset();
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
          });
        } else if (tab === "notifications") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Notification Preferences</h3>
              <form id="admin-notif-prefs-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer">
                  <input type="checkbox" name="email_notifs" checked> Email notifications for new users
                </label>
                <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer">
                  <input type="checkbox" name="payment_notifs" checked> Payment confirmations
                </label>
                <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer">
                  <input type="checkbox" name="system_notifs" checked> System alerts and errors
                </label>
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">💾 Save Preferences</button>
              </form>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3 style="margin-bottom:0.75rem">Send Bulk Notification</h3>
              <form id="settings-notify-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <select class="input" name="target" required>
                  <option value="all">All Users</option>
                  <option value="students">All Students</option>
                  <option value="teachers">All Teachers</option>
                </select>
                <textarea class="input" name="message" rows="3" placeholder="Notification message..." required></textarea>
                <button class="btn btn-primary btn-pattern" type="submit">📤 Send</button>
              </form>
              <div id="settings-notify-result" style="margin-top:0.5rem;font-size:0.85rem"></div>
            </div>
          `;
          document.getElementById("settings-notify-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const target = fd.get("target");
            const message = fd.get("message");
            try {
              if (target === "all") {
                await request("/notifications/bulk", { method: "POST", body: JSON.stringify({ role: "student", message }) });
                await request("/notifications/bulk", { method: "POST", body: JSON.stringify({ role: "teacher", message }) });
              } else {
                await request("/notifications/bulk", { method: "POST", body: JSON.stringify({ role: target === "students" ? "student" : "teacher", message }) });
              }
              document.getElementById("settings-notify-result").innerHTML = '<span style="color:var(--color-success)">Notification sent!</span>';
              e.target.reset();
            } catch(err) {
              document.getElementById("settings-notify-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(err.message)}</span>`;
            }
          });
        } else if (tab === "platform") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Platform Information</h3>
              <div style="display:grid;gap:0">
                <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
                  <span style="color:var(--color-text-muted);font-size:0.9rem">Platform Name</span>
                  <strong style="font-size:0.9rem">Casuya Ecosystem</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
                  <span style="color:var(--color-text-muted);font-size:0.9rem">API Base</span>
                  <strong style="font-size:0.9rem">${escapeHtml(API_BASE)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
                  <span style="color:var(--color-text-muted);font-size:0.9rem">Logo</span>
                  <strong style="font-size:0.9rem">${branding ? "Custom" : "Default"}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--color-border)">
                  <span style="color:var(--color-text-muted);font-size:0.9rem">Version</span>
                  <strong style="font-size:0.9rem">1.0.0</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.6rem 0">
                  <span style="color:var(--color-text-muted);font-size:0.9rem">Status</span>
                  <span style="font-size:0.9rem;color:var(--color-success);font-weight:600">● Online</span>
                </div>
              </div>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem" id="module-visibility-card">
              <h3 style="margin-bottom:0.25rem">Module Visibility</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:1rem">Toggle which sidebar modules are visible to students and teachers. Hidden modules can be re-enabled anytime.</p>
              <div id="module-vis-loading" style="text-align:center;padding:1rem;color:var(--color-text-muted);font-size:0.85rem">Loading...</div>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3 style="margin-bottom:0.75rem">⚠️ Danger Zone</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">Irreversible actions</p>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                <button class="btn btn-danger btn-sm btn-pattern" id="clear-cache-btn">🗑️ Clear Cache</button>
                <button class="btn btn-outline-danger btn-sm" id="export-data-btn">📦 Export All Data</button>
              </div>
              <div id="danger-msg" style="font-size:0.85rem;margin-top:0.5rem"></div>
            </div>
          `;
          document.getElementById("clear-cache-btn")?.addEventListener("click", () => {
            requestCache.clear();
            const msg = document.getElementById("danger-msg");
            msg.textContent = "In-memory cache cleared"; msg.style.color = "var(--color-success)";
          });
          document.getElementById("export-data-btn")?.addEventListener("click", async () => {
            const msg = document.getElementById("danger-msg");
            try {
              const [students, teachers, subjects, lessons] = await Promise.all([
                request("/students"), request("/teachers"), request("/subjects"), request("/lessons"),
              ]);
              const data = { students, teachers, subjects, lessons, exported_at: new Date().toISOString() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "casuya-export.json"; a.click();
              URL.revokeObjectURL(url);
              msg.textContent = "Data exported"; msg.style.color = "var(--color-success)";
            } catch(err) { msg.textContent = err.message; msg.style.color = "var(--color-danger)"; }
          });
          (async function() {
            var loading = document.getElementById("module-vis-loading");
            if (!loading) return;
            try {
              var vis = await request("/settings/modules");
              var studentMods = vis.student || {};
              var teacherMods = vis.teacher || {};
              var studentLabels = {dashboard:"Dashboard",subjects:"Subjects",progress:"Progress",bookmarks:"Bookmarks",assignments:"Assignments",games:"Games",downloads:"Downloads",exams:"Exams",files:"Files",payments:"Payments",notifications:"Notifications",settings:"Settings"};
              var teacherLabels = {overview:"Overview",students:"Students",lessons:"Lessons",assignments:"Assignments",reports:"Reports","ai-assistant":"AI Assistant",bookmarks:"Bookmarks",files:"Files",payments:"Payments",notifications:"Notifications",settings:"Settings"};
              function buildSection(title, mods, labels) {
                var html = '<div style="margin-bottom:1rem"><div style="font-weight:600;font-size:0.9rem;margin-bottom:0.5rem">' + title + '</div>';
                var keys = Object.keys(labels);
                for (var k = 0; k < keys.length; k++) {
                  var key = keys[k];
                  var enabled = mods[key] !== false;
                  html += '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--color-border);cursor:pointer;font-size:0.85rem">';
                  html += '<input type="checkbox" data-role="' + title.toLowerCase() + '" data-mod="' + key + '"' + (enabled ? ' checked' : '') + ' style="accent-color:var(--color-primary);width:16px;height:16px">';
                  html += '<span>' + labels[key] + '</span>';
                  html += '</label>';
                }
                html += '</div>';
                return html;
              }
              loading.outerHTML = buildSection("Student", studentMods, studentLabels) + buildSection("Teacher", teacherMods, teacherLabels) + '<p id="module-vis-msg" style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.5rem"></p>';
              document.querySelectorAll("#module-visibility-card input[type=checkbox]").forEach(function(cb) {
                cb.addEventListener("change", async function() {
                  var msg = document.getElementById("module-vis-msg");
                  var studentData = {};
                  var teacherData = {};
                  document.querySelectorAll("#module-visibility-card input[type=checkbox]").forEach(function(c) {
                    var role = c.getAttribute("data-role");
                    var mod = c.getAttribute("data-mod");
                    if (role === "student") studentData[mod] = c.checked;
                    else teacherData[mod] = c.checked;
                  });
                  try {
                    await request("/settings/modules", { method: "PUT", body: JSON.stringify({ student: studentData, teacher: teacherData }) });
                    msg.textContent = "Saved"; msg.style.color = "var(--color-success)";
                    setTimeout(function() { msg.textContent = ""; }, 2000);
                  } catch(e) {
                    msg.textContent = "Error: " + e.message; msg.style.color = "var(--color-danger)";
                  }
                });
              });
            } catch(e) {
              loading.outerHTML = '<p style="color:var(--color-danger);font-size:0.85rem">Failed to load module settings</p>';
            }
          })();
        } else if (tab === "appearance") {
          panel.innerHTML = appearancePanelHTML();
          setupAppearanceControls();
        }
      }

      showAdminView(`
        <div class="content">
          <h2>Settings</h2>
          <div class="tab-bar">
            <button class="tab-btn settings-tab-btn${activeTab === "profile" ? " active" : ""}" data-tab="profile">👤 Profile</button>
            <button class="tab-btn settings-tab-btn${activeTab === "security" ? " active" : ""}" data-tab="security">🔒 Security</button>
            <button class="tab-btn settings-tab-btn${activeTab === "notifications" ? " active" : ""}" data-tab="notifications">🔔 Notifications</button>
            <button class="tab-btn settings-tab-btn${activeTab === "platform" ? " active" : ""}" data-tab="platform">⚙️ Platform</button>
            <button class="tab-btn settings-tab-btn${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">🎨 Appearance</button>
          </div>
          <div id="settings-panel"></div>
        </div>
      `);

      document.querySelectorAll(".settings-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => renderTab(btn.dataset.tab));
      });
      renderTab(activeTab);
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading settings</p></div>'); }
  }

  // Load initial view from URL hash, fallback to dashboard
  const initialView = location.hash.slice(1) || "dashboard";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadAdminOverview();
  }
}
