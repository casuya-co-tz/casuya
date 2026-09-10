  async function loadAdminSettings() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [profile, branding, platformStatus, maintenance] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/branding/logo").catch(() => null),
        request("/settings/platform-status").catch(() => null),
        request("/settings/maintenance").catch(() => null),
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
          renderPlatformTab(panel, platformStatus, branding, API_BASE);
        } else if (tab === "appearance") {
          panel.innerHTML = appearancePanelHTML();
          setupAppearanceControls();
        } else if (tab === "maintenance") {
          var maint = maintenance || { enabled: false, title: "", message: "", until: null };
          var maintUntil = maint.until ? maint.until.slice(0, 16) : "";
          var maintIsOn = !!maint.enabled;
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:0.5rem">
                <div>
                  <h3 style="margin:0">Maintenance Mode</h3>
                  <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0.25rem 0 0">While enabled, students and teachers can still sign up and sign in, but they'll see a friendly "we'll be back soon" page after login. You keep full access.</p>
                </div>
                <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.9rem;font-weight:600;cursor:pointer;flex-shrink:0">
                  <input type="checkbox" id="maint-enabled"${maintIsOn ? " checked" : ""}>
                  <span style="color:${maintIsOn ? "var(--color-danger)" : "var(--color-text-muted)"}">${maintIsOn ? "Maintenance is ON" : "Maintenance is OFF"}</span>
                </label>
              </div>
              <div id="maint-body" style="${maintIsOn ? "" : "opacity:0.45;pointer-events:none"}">
                <div style="margin-top:1rem">
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Headline</label>
                  <input class="input" id="maint-title" value="${escapeHtml(maint.title || "We'll Be Back Soon")}" placeholder="We'll Be Back Soon" maxlength="60">
                </div>
                <div style="margin-top:0.75rem">
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Message</label>
                  <textarea class="input" id="maint-message" rows="4" placeholder="A warm, reassuring note for your users...">${escapeHtml(maint.message || "")}</textarea>
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">Keep it warm and hopeful. This is shown on the maintenance page.</p>
                </div>
                <div style="margin-top:0.75rem">
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Available again at</label>
                  <input class="input" type="datetime-local" id="maint-until" value="${escapeHtml(maintUntil)}">
                  <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">The date and time users should expect to get back in. Optional.</p>
                </div>
              </div>
              <div style="display:flex;gap:0.5rem;align-items:center;margin-top:1rem">
                <button class="btn btn-primary" type="button" id="maint-save">Save Maintenance Settings</button>
                <span id="maint-msg" style="font-size:0.85rem;display:none"></span>
              </div>
            </div>
          `;
          var enabledInput = document.getElementById("maint-enabled");
          enabledInput.addEventListener("change", function () {
            var body = document.getElementById("maint-body");
            body.style.opacity = enabledInput.checked ? "" : "0.45";
            body.style.pointerEvents = enabledInput.checked ? "" : "none";
            document.getElementById("maint-enabled").parentElement.querySelector("span").style.color = enabledInput.checked ? "var(--color-danger)" : "var(--color-text-muted)";
            document.getElementById("maint-enabled").parentElement.querySelector("span").textContent = enabledInput.checked ? "Maintenance is ON" : "Maintenance is OFF";
          });
          document.getElementById("maint-save").addEventListener("click", async function () {
            var msg = document.getElementById("maint-msg");
            var until = document.getElementById("maint-until").value;
            try {
              await request("/settings/maintenance", {
                method: "PUT",
                body: JSON.stringify({
                  enabled: enabledInput.checked,
                  title: document.getElementById("maint-title").value,
                  message: document.getElementById("maint-message").value,
                  until: until ? new Date(until).toISOString() : null,
                }),
              });
              msg.textContent = "Saved. Maintenance " + (enabledInput.checked ? "is now ON." : "is now OFF."); msg.style.color = "var(--color-success)"; msg.style.display = "inline";
              setTimeout(function () { msg.style.display = "none"; }, 3500);
            } catch(err) { msg.textContent = "Error: " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "inline"; }
          });
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
            <button class="tab-btn settings-tab-btn${activeTab === "maintenance" ? " active" : ""}" data-tab="maintenance">🛠️ Maintenance</button>
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
