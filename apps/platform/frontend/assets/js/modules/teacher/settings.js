// modules/teacher/settings.js — profile, password, appearance settings

async function loadSettings(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
  try {
    const [me, profile] = await Promise.all([
      request("/users/me").catch(() => ({})),
      request("/teachers/me").catch(() => ({})),
    ]);
    const activeTab = localStorage.getItem("teacher_settings_tab") || "profile";

    function renderTab(tab) {
      localStorage.setItem("teacher_settings_tab", tab);
      document.querySelectorAll(".teacher-settings-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
      const panel = document.getElementById("teacher-settings-panel");
      if (!panel) return;

      if (tab === "profile") {
        panel.innerHTML = `
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">My Profile</h3>
            <form id="teacher-profile-form" style="display:flex;flex-direction:column;gap:0.75rem">
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Full Name</label>
                <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" placeholder="Your name">
              </div>
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Email</label>
                <input class="input" value="${escapeHtml(me.email || "")}" disabled style="opacity:0.6">
              </div>
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Phone</label>
                <input class="input" name="phone" value="${escapeHtml(me.phone || "")}" placeholder="Phone number">
              </div>
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Subjects</label>
                <input class="input" name="subjects" value="${escapeHtml(profile.subjects || "")}" placeholder="e.g. Mathematics, Physics">
              </div>
              <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">💾 Save Changes</button>
            </form>
            <p id="teacher-profile-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
          </div>
        `;
        document.getElementById("teacher-profile-form")?.addEventListener("submit", async e => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const msg = document.getElementById("teacher-profile-msg");
          try {
            await request("/users/me", { method: "PATCH", body: JSON.stringify({ phone: fd.get("phone") }) });
            await request("/teachers/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), subjects: fd.get("subjects") }) });
            msg.textContent = "✅ Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "block";
            setTimeout(() => msg.style.display = "none", 3000);
          } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "block"; }
        });
      } else if (tab === "password") {
        panel.innerHTML = `
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Change Password</h3>
            <form id="teacher-pw-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Current Password</label>
                <input class="input" name="current_password" type="password" required>
              </div>
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">New Password</label>
                <input class="input" name="new_password" type="password" required minlength="6">
              </div>
              <div>
                <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Confirm New Password</label>
                <input class="input" name="confirm_password" type="password" required>
              </div>
              <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">🔐 Update Password</button>
            </form>
            <p id="teacher-pw-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
          </div>
        `;
        document.getElementById("teacher-pw-form")?.addEventListener("submit", async e => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const msg = document.getElementById("teacher-pw-msg");
          if (fd.get("new_password") !== fd.get("confirm_password")) {
            msg.textContent = "❌ Passwords do not match"; msg.style.color = "var(--color-danger)"; msg.style.display = "block";
            return;
          }
          try {
            await request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), new_password: fd.get("new_password") }) });
            msg.textContent = "✅ Password updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "block";
            e.target.reset();
          } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "block"; }
        });
      } else if (tab === "appearance") {
        panel.innerHTML = appearancePanelHTML();
        setupAppearanceControls();
      }
    }

    dashboard.showView(`
      <div class="content">
        <h2>⚙️ Settings</h2>
        <div class="tab-bar">
          <button class="tab-btn teacher-settings-tab${activeTab === "profile" ? " active" : ""}" data-tab="profile">👤 Profile</button>
          <button class="tab-btn teacher-settings-tab${activeTab === "password" ? " active" : ""}" data-tab="password">🔒 Password</button>
          <button class="tab-btn teacher-settings-tab${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">🎨 Appearance</button>
        </div>
        <div id="teacher-settings-panel"></div>
      </div>
    `);
    document.querySelectorAll(".teacher-settings-tab").forEach(btn => {
      btn.addEventListener("click", () => renderTab(btn.dataset.tab));
    });
    renderTab(activeTab);
  } catch(e) { dashboard.showView('<div class="empty-state"><p>Error loading settings</p></div>'); }
}

async function showProfileEditor(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
  try {
    const [me, profile] = await Promise.all([
      request("/users/me"),
      request("/teachers/me").catch(() => null),
    ]);
    dashboard.showView(`
      <div class="content" style="max-width:500px;margin:0 auto">
        <h2>Edit Profile</h2>
        <form id="profile-form">
          <label>Email</label>
          <input type="email" value="${escapeHtml(me.email || "")}" disabled style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
          <label>Phone</label>
          <input type="tel" id="pf-phone" value="${escapeHtml(me.phone || "")}" style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
          ${profile ? `
            <label>Full Name</label>
            <input type="text" id="pf-name" value="${escapeHtml(profile.full_name || "")}" style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
            <label>Subjects</label>
            <input type="text" id="pf-subjects" value="${escapeHtml(profile.subjects || "")}" style="width:100%;padding:0.5rem;margin-bottom:0.75rem;border:1px solid var(--color-border);border-radius:var(--radius)">
          ` : ""}
          <button type="submit" class="btn btn-primary" style="width:100%">Save Changes</button>
        </form>
        <p id="profile-msg" style="display:none;margin-top:0.75rem"></p>
        <button class="btn lesson-back-btn" style="margin-top:1rem">&larr; Back</button>
      </div>
    `);
    document.querySelector("#teacher-content .lesson-back-btn")?.addEventListener("click", () => loadOverview(dashboard));
    document.getElementById("profile-form").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = document.getElementById("profile-msg");
      try {
        await request("/users/me", { method: "PATCH", body: JSON.stringify({ phone: document.getElementById("pf-phone").value || null }) });
        if (profile) {
          await request("/teachers/me", { method: "PATCH", body: JSON.stringify({
            full_name: document.getElementById("pf-name").value || null,
            subjects: document.getElementById("pf-subjects").value || null,
          })});
        }
        msg.style.display = "block"; msg.style.color = "var(--color-success)"; msg.textContent = "Profile updated!";
        setTimeout(() => msg.style.display = "none", 3000);
      } catch(err) {
        msg.style.display = "block"; msg.style.color = "red"; msg.textContent = err.message;
      }
    });
  } catch(err) {
    dashboard.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
  }
}
