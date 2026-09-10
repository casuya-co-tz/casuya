// modules/student/dashboard/sidebar.js — StudentDashboard sidebar lifecycle.
// Extends StudentDashboard.prototype with shell render + sidebar wiring.

Object.assign(StudentDashboard.prototype, {
  // ── Render sidebar + main shell ─────────────────────────────────────
  _renderShell() {
    render("#app", `
      <div class="sidebar-layout">
        <aside id="student-sidebar" class="sidebar">
          <div class="sidebar-header">
            <h2>Casuya</h2>
            <p>${escapeHtml(this.payload.full_name || this.payload.email || "Student")}</p>
          </div>
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--color-border)">
            <select id="form-filter" class="input" style="padding:0.4rem;font-size:0.85rem">
              <option value="">All Forms</option>
              <option value="Form I">Form I</option>
              <option value="Form II">Form II</option>
              <option value="Form III">Form III</option>
              <option value="Form IV">Form IV</option>
              <option value="Form V">Form V</option>
              <option value="Form VI">Form VI</option>
            </select>
          </div>
          <nav class="sidebar-nav" id="student-nav">
            <div class="sidebar-nav-item active" data-view="dashboard">🏠 Dashboard</div>
            <div class="sidebar-nav-item" data-view="class">🏫 My Class</div>
            <div class="sidebar-nav-item" data-view="subjects">📚 Subjects</div>
            <div class="sidebar-nav-item" data-view="progress">📊 Progress</div>
            <div class="sidebar-nav-item" data-view="bookmarks">🔖 Bookmarks</div>
            <div class="sidebar-nav-item" data-view="assignments">📋 Assignments</div>
            <div class="sidebar-nav-item" data-view="games">🎮 Games</div>
            <div class="sidebar-nav-item" data-view="downloads">📥 Downloads</div>
            <div class="sidebar-nav-item" data-view="library">📖 Reference Library</div>
            <div class="sidebar-nav-item" data-view="exams">📝 Exams</div>
            <div class="sidebar-nav-item" data-view="files">📁 Files</div>
            <div class="sidebar-nav-item" data-view="payments">💳 Payments</div>
            <div class="sidebar-nav-item" data-view="notifications">🔔 Notifications</div>
            <div class="sidebar-nav-item" data-view="settings">⚙️ Settings</div>
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-footer-row">
              <div style="position:relative;flex:1">
                <button id="notif-bell" class="icon-btn" style="width:100%;font-size:1.1rem" title="Notifications">🔔<span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-6px;background:red;color:#fff;font-size:0.6rem;padding:1px 4px;border-radius:8px;min-width:14px;text-align:center">0</span></button>
                <div id="notif-dropdown" class="notif-dropdown"></div>
              </div>
              <div style="position:relative">
                <button id="profile-btn" class="icon-btn" title="Profile">👤</button>
                <div id="profile-dropdown" class="profile-dropdown">
                  <button class="dropdown-item" id="prof-edit">Edit Profile</button>
                  <button class="dropdown-item" id="prof-logout" style="color:var(--color-danger)">Sign Out</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main class="main-content">
          <header class="main-header">
            <button id="sidebar-toggle" class="sidebar-toggle-btn">&#9776;</button>
            <div style="position:relative;flex:1;max-width:360px">
              <input id="student-search" type="search" class="input" placeholder="Search lessons..." style="padding:0.4rem 0.75rem;font-size:0.85rem">
              <div id="student-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);z-index:100;max-height:300px;overflow-y:auto"></div>
            </div>
          </header>
          <div id="student-content" class="main-body"></div>
        </main>
      </div>
    `);
  },

  // ── Sidebar styles (mobile) ─────────────────────────────────────────
  _injectSidebarStyles() {
    if (!document.getElementById("sidebar-styles")) {
      const style = document.createElement("style");
      style.id = "sidebar-styles";
      style.textContent = `@media(max-width:1024px){.sidebar{position:fixed;z-index:200;left:-260px;transition:left .25s ease;height:100vh}.sidebar.open{left:0;box-shadow:4px 0 20px rgba(0,0,0,.15)}.sidebar-toggle-btn{display:block!important}}`;
      document.head.appendChild(style);
    }
  },

  // ── Sidebar toggle (mobile) ─────────────────────────────────────────
  _setupSidebarToggle() {
    document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
      document.getElementById("student-sidebar").classList.toggle("open");
    }, { signal: _globalAbort.signal });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#student-sidebar") && !e.target.closest("#sidebar-toggle")) {
        document.getElementById("student-sidebar")?.classList.remove("open");
      }
    }, { signal: _globalAbort.signal });
  },

  // ── Sidebar navigation wiring ───────────────────────────────────────
  _setupNavigation() {
    const self = this;
    document.querySelectorAll("#student-nav .sidebar-nav-item").forEach(el => {
      el.addEventListener("click", () => {
        document.getElementById("student-sidebar")?.classList.remove("open");
        self.navigateTo(el.dataset.view);
      });
    });
  },

  // ── Profile dropdown ────────────────────────────────────────────────
  _setupProfileDropdown() {
    const self = this;
    document.getElementById("profile-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = document.getElementById("profile-dropdown");
      dd.style.display = dd.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (e) => {
      const pd = document.getElementById("profile-dropdown");
      if (pd && !e.target.closest("#profile-btn") && !e.target.closest("#profile-dropdown")) pd.style.display = "none";
    }, { signal: _globalAbort.signal });

    document.getElementById("prof-logout").addEventListener("click", handleLogout);
    document.getElementById("prof-edit").addEventListener("click", () => {
      document.getElementById("profile-dropdown").style.display = "none";
      self.callView("profile");
    });
  },
});