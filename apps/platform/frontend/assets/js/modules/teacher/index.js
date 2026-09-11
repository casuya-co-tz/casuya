// modules/teacher/index.js — main entry point for teacher dashboard

async function renderTeacherDashboard() {
  const dashboard = new TeacherDashboard();

  render("#app", `
    <div class="sidebar-layout">
      <aside id="teacher-sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2>Casuya</h2>
          <p>${escapeHtml(dashboard.payload.full_name || dashboard.payload.email || "Teacher")}</p>
        </div>
        <nav class="sidebar-nav" id="teacher-nav">
          <div class="sidebar-nav-item active" data-view="overview">📊 Overview</div>
          <div class="sidebar-nav-item" data-view="class">🏫 My Class</div>
          <div class="sidebar-nav-item" data-view="students">👥 Students</div>
          <div class="sidebar-nav-item" data-view="lessons">📝 Lessons</div>
          <div class="sidebar-nav-item" data-view="test-generator">📝 Test Generator</div>
          <div class="sidebar-nav-item" data-view="assignments">📋 Assignments</div>
          <div class="sidebar-nav-item" data-view="reports">📈 Reports</div>
          <div class="sidebar-nav-item" data-view="ai-assistant">🤖 AI Assistant</div>
          <div class="sidebar-nav-item" data-view="teaching-docs">📚 Teaching Docs</div>
          <div class="sidebar-nav-item" data-view="library">📖 Reference Library</div>
          <div class="sidebar-nav-item" data-view="bookmarks">🔖 Bookmarks</div>
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
            <input id="teacher-search" type="search" class="input" placeholder="Search lessons, students..." style="padding:0.4rem 0.75rem;font-size:0.85rem">
            <div id="teacher-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);z-index:100;max-height:300px;overflow-y:auto"></div>
          </div>
        </header>
        <div id="teacher-content" class="main-body"></div>
      </main>
    </div>
  `);

  dashboard._navItems = document.querySelectorAll("#teacher-nav .sidebar-nav-item");

  dashboard._viewLoaders = {
    overview: () => { dashboard.setActiveNav("overview"); loadOverview(dashboard); },
    dashboard: () => { dashboard.setActiveNav("overview"); loadOverview(dashboard); },
    class: () => { dashboard.setActiveNav("class"); loadClass(dashboard); },
    students: () => { dashboard.setActiveNav("students"); loadStudents(dashboard); },
    lessons: () => { dashboard.setActiveNav("lessons"); loadLessons(dashboard); },
    "test-generator": () => { dashboard.setActiveNav("test-generator"); loadTeacherTestGenerator(dashboard); },
    assignments: () => { dashboard.setActiveNav("assignments"); loadAssignments(dashboard); },
    reports: () => { dashboard.setActiveNav("reports"); loadReports(dashboard); },
    "ai-assistant": () => { dashboard.setActiveNav("ai-assistant"); loadAIAssistant(dashboard); },
    "teaching-docs": () => { dashboard.setActiveNav("teaching-docs"); loadPlans(dashboard); },
    library: () => { dashboard.setActiveNav("library"); loadLibrary(dashboard); },
    bookmarks: () => { dashboard.setActiveNav("bookmarks"); loadBookmarks(dashboard); },
    files: () => { dashboard.setActiveNav("files"); loadFiles(dashboard); },
    payments: () => { dashboard.setActiveNav("payments"); loadPayments(dashboard); },
    notifications: () => { dashboard.setActiveNav("notifications"); loadNotifications(dashboard); },
    settings: () => { dashboard.setActiveNav("settings"); loadSettings(dashboard); },
  };

  setupSidebar(dashboard);

  const initialView = location.hash.slice(1) || "overview";
  if (dashboard._viewLoaders[initialView]) {
    dashboard._viewLoaders[initialView]();
  } else {
    loadOverview(dashboard);
  }
}
