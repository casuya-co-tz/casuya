// modules/admin-dashboard.js — extracted from main.js (classic script, shared global scope)
async function renderAdminDashboard() {
  const token = localStorage.getItem("casuya_token");
  const payload = decodeToken(token);

  render("#app", `
    <div class="sidebar-layout">
      <aside id="admin-sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2>Casuya Admin</h2>
          <p>${escapeHtml(payload.full_name || payload.email || "Admin")}</p>
        </div>
        <nav class="sidebar-nav" id="admin-nav">
          <div class="sidebar-nav-item active" data-view="dashboard">📊 Dashboard</div>
          <div class="sidebar-nav-item" data-view="subjects">📚 Subjects</div>
          <div class="sidebar-nav-item" data-view="topics">📁 Topics</div>
          <div class="sidebar-nav-item" data-view="subtopics">📂 Subtopics</div>
          <div class="sidebar-nav-item" data-view="lessons">📝 Lessons</div>
          <div class="sidebar-nav-item" data-view="quizzes">❓ Quizzes</div>
          <div class="sidebar-nav-item" data-view="games">🎮 Games</div>
          <div class="sidebar-nav-item" data-view="users">👥 Users</div>
          <div class="sidebar-nav-item" data-view="progress">📈 Progress</div>
          <div class="sidebar-nav-item" data-view="analytics">📉 Analytics</div>
          <div class="sidebar-nav-item" data-view="payments">💳 Payments</div>
          <div class="sidebar-nav-item" data-view="notifications">🔔 Notifications</div>
          <div class="sidebar-nav-item" data-view="uploads">📤 Uploads</div>
          <div class="sidebar-nav-item" data-view="branding">🎨 Branding</div>
          <div class="sidebar-nav-item" data-view="settings">⚙️ Settings</div>
        </nav>
        <div class="sidebar-footer">
          <button id="admin-logout" class="btn btn-danger" style="width:100%;font-size:0.85rem">Sign Out</button>
        </div>
      </aside>
      <main class="main-content">
        <header class="main-header">
          <button id="sidebar-toggle" class="sidebar-toggle-btn">&#9776;</button>
          <div style="position:relative;flex:1;max-width:360px">
            <input id="admin-search" type="search" class="input" placeholder="Search users, lessons..." style="padding:0.4rem 0.75rem;font-size:0.85rem">
            <div id="admin-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);z-index:100;max-height:300px;overflow-y:auto"></div>
          </div>
        </header>
        <div id="admin-content" class="main-body"></div>
      </main>
    </div>
  `);

  document.getElementById("admin-logout").addEventListener("click", handleLogout);

  // Sidebar toggle (mobile)
  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("admin-sidebar").classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#admin-sidebar") && !e.target.closest("#sidebar-toggle")) {
      document.getElementById("admin-sidebar")?.classList.remove("open");
    }
  }, { signal: _globalAbort.signal });

  // Admin search
  const adminSearchInput = document.getElementById("admin-search");
  const adminSearchResults = document.getElementById("admin-search-results");
  let searchTimer;
  let searchSeq = 0;

  adminSearchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = adminSearchInput.value.trim();
    if (q.length < 2) { adminSearchResults.style.display = "none"; return; }
    const mySeq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
        if (mySeq !== searchSeq) return; // stale response, discard
        if (!Array.isArray(results) || results.length === 0) {
          adminSearchResults.innerHTML = '<div style="padding:0.5rem;color:var(--color-text-muted)">No results</div>';
        } else {
          adminSearchResults.innerHTML = results.map(u => `
            <div class="admin-search-item" data-id="${escapeHtml(u.id)}" data-type="${escapeHtml(u.type)}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between">
              <span>${escapeHtml(u.title || u.email)}</span>
              <span style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(u.type)}</span>
            </div>
          `).join("");
          adminSearchResults.querySelectorAll(".admin-search-item").forEach(el => {
            el.addEventListener("click", () => {
              adminSearchResults.style.display = "none";
              adminSearchInput.value = "";
              if (el.dataset.type === "student" || el.dataset.type === "teacher") loadAdminUsers();
              else if (el.dataset.type === "lesson") loadAdminLessons();
              else loadAdminSubjects();
            });
          });
        }
        adminSearchResults.style.display = "block";
      } catch(e) { adminSearchResults.style.display = "none"; }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#admin-search") && !e.target.closest("#admin-search-results")) adminSearchResults.style.display = "none";
  }, { signal: _globalAbort.signal });

  // Navigation
  function setActiveNav(viewId) {
    document.querySelectorAll("#admin-nav .sidebar-nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  function showAdminView(content) {
    const el = document.getElementById("admin-content");
    if (!el) return;
    el.innerHTML = content;
  }

  const navHandlers = {
    dashboard: () => { setActiveNav("dashboard"); loadAdminOverview(); },
    subjects: () => { setActiveNav("subjects"); loadAdminSubjects(); },
    topics: () => { setActiveNav("topics"); loadAdminTopics(); },
    subtopics: () => { setActiveNav("subtopics"); loadAdminSubtopics(); },
    lessons: () => { setActiveNav("lessons"); loadAdminLessons(); },
    quizzes: () => { setActiveNav("quizzes"); loadAdminQuizzes(); },
    games: () => { setActiveNav("games"); loadAdminGames(); },
    users: () => { setActiveNav("users"); loadAdminUsers(); },
    progress: () => { setActiveNav("progress"); loadAdminProgress(); },
    analytics: () => { setActiveNav("analytics"); loadAdminAnalytics(); },
    payments: () => { setActiveNav("payments"); loadAdminPayments(); },
    notifications: () => { setActiveNav("notifications"); loadAdminNotifications(); },
    uploads: () => { setActiveNav("uploads"); loadAdminUploads(); },
    branding: () => { setActiveNav("branding"); loadAdminBranding(); },
    settings: () => { setActiveNav("settings"); loadAdminSettings(); },
  };

  function navigateTo(view) {
    if (navHandlers[view]) {
      location.hash = view;
      navHandlers[view]();
    }
  }

  document.querySelectorAll("#admin-nav .sidebar-nav-item").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("admin-sidebar")?.classList.remove("open");
      navigateTo(el.dataset.view);
    });
  });

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "dashboard";
    if (navHandlers[view]) navHandlers[view]();
  });

