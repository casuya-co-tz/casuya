// modules/student-dashboard.js — extracted from main.js (classic script, shared global scope)
  // Holds the lessons currently shown in a subtopic so we can prefetch the
  // next one's content while the student reads the current lesson (P1-6).
  let _subtopicLessonList = [];
  let _recentlyViewedCache = null;
  let _recentlyViewedCacheTs = 0;
  function getRecentlyViewed() {
    const now = Date.now();
    if (_recentlyViewedCache === null || now - _recentlyViewedCacheTs > 5000) {
      _recentlyViewedCache = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      _recentlyViewedCacheTs = now;
    }
    return _recentlyViewedCache;
  }

  async function renderStudentDashboard() {
  // Apply stored accessibility preferences (special needs / neurodivergent).
  try {
    var _a11yPrefs = JSON.parse(localStorage.getItem("casuya_accessibility_prefs") || "null");
    if (_a11yPrefs) {
      if (_a11yPrefs.pref_dyslexia) document.body.classList.add("dyslexia-mode");
      if (_a11yPrefs.pref_high_contrast) document.body.classList.add("high-contrast");
      if (_a11yPrefs.pref_larger_text) document.body.style.fontSize = "1.15em";
      if (_a11yPrefs.pref_tts) { document.body.setAttribute("data-tts-enabled", "true"); }
    }
  } catch (e) {}

  const token = localStorage.getItem("casuya_token");
  const payload = decodeToken(token);
  const _navStack = [];

  function goBack() {
    if (_navStack.length > 0) {
      const prev = _navStack.pop();
      prev();
    } else {
      loadStudentOverview();
    }
  }

  render("#app", `
    <div class="sidebar-layout">
      <aside id="student-sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2>Casuya</h2>
          <p>${escapeHtml(payload.full_name || payload.email || "Student")}</p>
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

  // Inject sidebar styles (duplicate prevention)
  if (!document.getElementById("sidebar-styles")) {
    const style = document.createElement("style");
    style.id = "sidebar-styles";
    style.textContent = `@media(max-width:1024px){.sidebar{position:fixed;z-index:200;left:-260px;transition:left .25s ease;height:100vh}.sidebar.open{left:0;box-shadow:4px 0 20px rgba(0,0,0,.15)}.sidebar-toggle-btn{display:block!important}}`;
    document.head.appendChild(style);
  }

  // Sidebar toggle (mobile)
  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("student-sidebar").classList.toggle("open");
  }, { signal: _globalAbort.signal });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#student-sidebar") && !e.target.closest("#sidebar-toggle")) {
      document.getElementById("student-sidebar")?.classList.remove("open");
    }
  }, { signal: _globalAbort.signal });

  // Form filter (persisted). Pre-select the student's own form level when known.
  const formFilterEl = document.getElementById("form-filter");
  const savedFormFilter = localStorage.getItem("casuya_form_filter") || "";
  if (payload.form_level && !savedFormFilter) {
    localStorage.setItem("casuya_form_filter", payload.form_level);
    formFilterEl.value = payload.form_level;
  } else if (savedFormFilter) {
    formFilterEl.value = savedFormFilter;
  }
  formFilterEl.addEventListener("change", (e) => {
    localStorage.setItem("casuya_form_filter", e.target.value);
    loadStudentSubjects();
  });

  // Search functionality
  const searchInput = document.getElementById("student-search");
  const searchResults = document.getElementById("student-search-results");
  let searchTimer;
  let searchSeq = 0;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.style.display = "none"; return; }
    const mySeq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
        if (mySeq !== searchSeq) return; // stale response, discard
        if (!Array.isArray(results) || results.length === 0) {
          searchResults.innerHTML = '<div style="padding:0.5rem;color:var(--color-text-muted)">No results</div>';
        } else {
          searchResults.innerHTML = results.map(r => `
            <div class="search-item" data-id="${escapeHtml(r.id)}" data-type="${escapeHtml(r.type)}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between">
              <span>${escapeHtml(r.title)}</span>
              <span style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(r.type)}</span>
            </div>
          `).join("");
          searchResults.querySelectorAll(".search-item").forEach(el => {
            el.addEventListener("click", () => {
              searchResults.style.display = "none";
              searchInput.value = "";
              if (el.dataset.type === "lesson") viewStudentLesson(el.dataset.id);
            });
          });
        }
        searchResults.style.display = "block";
      } catch(e) { searchResults.style.display = "none"; }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#student-search") && !e.target.closest("#student-search-results")) searchResults.style.display = "none";
  }, { signal: _globalAbort.signal });

  // Notifications
  const notifBell = document.getElementById("notif-bell");
  const notifDropdown = document.getElementById("notif-dropdown");
  const notifBadge = document.getElementById("notif-badge");
  let notifData = [];

  async function loadNotifs() {
    try {
      notifData = await request("/notifications");
      const unread = notifData.filter(n => !n.is_read).length;
      if (unread > 0) { notifBadge.textContent = unread; notifBadge.style.display = "inline"; }
      else notifBadge.style.display = "none";
    } catch(e) {}
  }

  notifBell.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (notifDropdown.style.display === "block") { notifDropdown.style.display = "none"; return; }
    await loadNotifs();
    if (notifData.length === 0) {
      notifDropdown.innerHTML = '<div style="padding:0.75rem;color:var(--color-text-muted)">No notifications</div>';
    } else {
      notifDropdown.innerHTML = notifData.map(n => `
        <div class="notif-item ${n.is_read ? "" : "unread"}" data-id="${escapeHtml(n.id)}" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--color-border);${n.is_read ? "opacity:0.6" : "font-weight:600"}">
          <p style="margin:0;font-size:0.85rem">${escapeHtml(n.message)}</p>
        </div>
      `).join("");
      notifDropdown.querySelectorAll(".notif-item.unread").forEach(el => {
        el.addEventListener("click", async () => {
          await request(`/notifications/${el.dataset.id}/read`, { method: "POST" });
          await loadNotifs();
        });
      });
    }
    notifDropdown.style.display = "block";
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("#notif-bell") && !e.target.closest("#notif-dropdown")) notifDropdown.style.display = "none"; }, { signal: _globalAbort.signal });

  // Profile dropdown
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
    showStudentProfileEditor();
  });

  // Navigation
  const _studentNavItems = document.querySelectorAll("#student-nav .sidebar-nav-item");
  function setActiveNav(viewId) {
    _studentNavItems.forEach(el => {
      el.classList.toggle("active", el.dataset.view === viewId);
    });
  }

  function showStudentView(content) {
    const el = document.getElementById("student-content");
    if (el) el.innerHTML = content;
  }

  const navHandlers = {
    dashboard: () => { setActiveNav("dashboard"); loadStudentOverview(); },
    class: () => { setActiveNav("class"); loadStudentClass(); },
    subjects: () => { setActiveNav("subjects"); loadStudentSubjects(); },
    progress: () => { setActiveNav("progress"); loadStudentProgress(); },
    bookmarks: () => { setActiveNav("bookmarks"); loadStudentBookmarks(); },
    assignments: () => { setActiveNav("assignments"); loadStudentAssignments(); },
    games: () => { setActiveNav("games"); loadStudentGames(); },
    downloads: () => { setActiveNav("downloads"); loadStudentDownloads(); },
    library: () => { setActiveNav("library"); loadStudentLibrary(); },
    exams: () => { setActiveNav("exams"); loadStudentExams(); },
    files: () => { setActiveNav("files"); loadStudentFiles(); },
    payments: () => { setActiveNav("payments"); loadStudentPayments(); },
    notifications: () => { setActiveNav("notifications"); loadStudentNotifications(); },
    settings: () => { setActiveNav("settings"); loadStudentSettings(); },
  };

  function navigateTo(view) {
    if (navHandlers[view]) {
      location.hash = view;
      navHandlers[view]();
    }
  }

  document.querySelectorAll("#student-nav .sidebar-nav-item").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("student-sidebar")?.classList.remove("open");
      navigateTo(el.dataset.view);
    });
  });

  (async function applyModuleVisibility() {
    try {
      var vis = await request("/settings/modules/my");
      if (!vis || typeof vis !== "object") return;
      var items = document.querySelectorAll("#student-nav .sidebar-nav-item");
      var firstEnabled = null;
      items.forEach(function(el) {
        var view = el.getAttribute("data-view");
        if (vis[view] === false) {
          el.style.display = "none";
        } else if (!firstEnabled) {
          firstEnabled = view;
        }
      });
      var currentHash = location.hash.slice(1) || "dashboard";
      if (vis[currentHash] === false && firstEnabled) {
        navigateTo(firstEnabled);
      }
    } catch(e) {}
  })();

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "dashboard";
    if (navHandlers[view]) navHandlers[view]();
  });

  async function loadStudentClass() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const res = await request("/classrooms/me?_t=" + Date.now()).catch(() => null);
      const classroom = res?.classroom || null;
      const teacher = res?.teacher || null;

      showStudentView(`
        <div class="content" style="max-width:720px">
          <h2>My Class</h2>

          ${classroom ? `
            <div class="card" style="margin:1rem 0;padding:1.5rem;background:linear-gradient(135deg,#eff6ff,#ede9fe);border:1px solid #dbeafe;text-align:center">
              <div style="font-size:2rem">🎓</div>
              <h3 style="margin:0.5rem 0 0.25rem">You're connected!</h3>
              <p style="margin:0 0 0.5rem;color:var(--color-text-muted);font-size:0.9rem">
                ${teacher?.name ? "Your teacher: <b>" + escapeHtml(teacher.name) + "</b>" : "Connected to your teacher's class."}
              </p>
              <div style="font-size:0.75rem;color:var(--color-text-muted);margin:0.5rem 0 0.25rem">Class Code</div>
              <div style="font-family:monospace;font-weight:800;letter-spacing:0.3em;font-size:1.6rem;color:#1e40af">${escapeHtml(classroom.code)}</div>
              <button class="btn btn-danger" id="leave-class" style="margin-top:1rem">Leave Class</button>
            </div>
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
      showStudentView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  // Load dashboard overview
  async function loadStudentOverview() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading dashboard...</p></div>');
    try {
      const [subjects, profile, classRes] = await Promise.all([
        request("/subjects"),
        request("/students/me").catch(() => null),
        request("/classrooms/me").catch(() => null),
      ]);

      const isConnected = !!(classRes && classRes.classroom);
      const classTeacher = classRes?.teacher?.name || "";

      const name = profile?.full_name || payload.full_name || payload.email || "Student";
      const formLevel = profile?.form_level || "";

      // Build subject list with icon colors
      const subjectList = Array.isArray(subjects) ? subjects : [];
      const iconColors = [
        { bg: "#eff6ff", color: "#2563eb", emoji: "📚" },
        { bg: "#f0fdf4", color: "#16a34a", emoji: "🧬" },
        { bg: "#fef3c7", color: "#d97706", emoji: "📐" },
        { bg: "#fce7f3", color: "#db2777", emoji: "🧪" },
        { bg: "#ede9fe", color: "#7c3aed", emoji: "🌍" },
        { bg: "#e0f2fe", color: "#0284c7", emoji: "💻" },
      ];

      // Fetch progress data + server-side stats in parallel
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

          // Server-side stats override localStorage values
          if (statsResult) {
            streak = statsResult.streak || 0;
            lessonsViewed = statsResult.lessonsViewed || 0;
            recent = Array.isArray(statsResult.recent) ? statsResult.recent : [];
            if (statsResult.avgScore != null) avgScore = statsResult.avgScore;
          }
        }
      } catch(e) {}

      // Fallback: if server stats unavailable, use localStorage (legacy)
      if (recent.length === 0) {
        try { recent = getRecentlyViewed(); } catch(e) {}
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

      // Get greeting based on time
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      showStudentView(`
        <div class="content" style="max-width:960px">
          <!-- Welcome Banner -->
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}${formLevel ? " — " + escapeHtml(formLevel) : ""}</h2>
            <p>Ready to continue your learning journey?</p>
          </div>

          <!-- Class connection status -->
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

          <!-- Stats -->
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

          <!-- Continue Learning -->
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

          <!-- My Subjects -->
          <div class="section-header">
            <h3>My Subjects</h3>
            <button class="btn btn-sm" id="browse-all-subjects">Browse All</button>
          </div>
          ${subjectList.length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No subjects available yet</p></div>'
            : `<div class="subject-card-grid">
                ${subjectList.map((s, i) => {
                  const ic = iconColors[i % iconColors.length];
                  // Calculate progress for this subject
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

      // Wire up subject clicks
      document.querySelectorAll(".subject-card-enhanced").forEach(card => {
        card.addEventListener("click", () => loadSubjectTopics(card.dataset.id));
      });

      // Wire up recent lesson clicks
      document.querySelectorAll(".recent-lesson-card").forEach(card => {
        card.addEventListener("click", () => viewStudentLesson(card.dataset.id));
      });

      // Wire up "Browse All" to subjects view
      document.getElementById("browse-all-subjects")?.addEventListener("click", () => {
        setActiveNav("subjects");
        loadStudentSubjects();
      });

      // Wire up "View All" to show more recent
      document.getElementById("view-all-recent")?.addEventListener("click", () => {
        setActiveNav("subjects");
        loadStudentSubjects();
      });

      document.getElementById("ov-view-class")?.addEventListener("click", () => {
        setActiveNav("class");
        loadStudentClass();
      });
      document.getElementById("ov-connect-class")?.addEventListener("click", () => {
        setActiveNav("class");
        loadStudentClass();
      });

    } catch(e) {
      showStudentView('<div class="empty-state"><p>Error loading dashboard</p></div>');
    }
  }

  // Load subjects
  async function loadStudentSubjects() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const filtered = Array.isArray(subjects) ? subjects : [];
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No subjects found</p></div>');
        return;
      }
      showStudentView(`
        <h2>Subjects</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${filtered.map(s => `
            <div class="card subject-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.name)}</h3>
              <p style="color:var(--color-text-muted)">${escapeHtml(s.slug || "")}</p>
            </div>
          `).join("")}
        </div>
      `);
      document.querySelectorAll(".subject-card").forEach(card => {
        card.addEventListener("click", () => loadSubjectTopics(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading subjects</p></div>'); }
  }

  async function loadSubjectTopics(subjectId) {
    _navStack.push(() => loadStudentSubjects());
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      // Server-side filter by subject (don't pull the whole topic catalog on 2G/3G).
      const topics = await request("/topics?subject_id=" + encodeURIComponent(subjectId));
      const formFilter = localStorage.getItem("casuya_form_filter") || "";
      let filtered = Array.isArray(topics) ? topics : [];
      if (formFilter) {
        const ff = formFilter.replace(/^Form /, "");
        // Only FILTER when a form is explicitly chosen, and never hide topics that
        // have no form_level set (they apply to everyone). This prevents published
        // lessons from disappearing just because a topic's form_level doesn't match.
        filtered = filtered.filter(t => !t.form_level || t.form_level === formFilter || t.form_level.replace(/^Form /, "") === ff);
      }
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No topics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", goBack);
        return;
      }
      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Topics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(t => `
            <div class="card topic-card" data-id="${t.id}" style="cursor:pointer">
              <h3>${escapeHtml(t.title)}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", goBack);
      document.querySelectorAll(".topic-card").forEach(card => {
        card.addEventListener("click", () => loadTopicSubtopics(card.dataset.id, subjectId));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading topics</p></div>'); }
  }

  async function loadTopicSubtopics(topicId, subjectId) {
    _navStack.push(() => loadSubjectTopics(subjectId));
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      // Server-side filter by topic (don't pull the whole subtopic catalog on 2G/3G).
      const subtopics = await request("/subtopics?topic_id=" + encodeURIComponent(topicId));
      const filtered = Array.isArray(subtopics) ? subtopics : [];
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No subtopics found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", goBack);
        return;
      }
      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Subtopics</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(s => `
            <div class="card subtopic-card" data-id="${s.id}" style="cursor:pointer">
              <h3>${escapeHtml(s.title)}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", goBack);
      document.querySelectorAll(".subtopic-card").forEach(card => {
        card.addEventListener("click", () => loadSubtopicLessons(card.dataset.id, topicId, subjectId));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading subtopics</p></div>'); }
  }

  async function loadSubtopicLessons(subtopicId, topicId, subjectId) {
    _navStack.push(() => loadTopicSubtopics(topicId, subjectId));
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      // Server-side filter by subtopic + published status (only this branch is fetched).
      const lessons = await request("/lessons/?subtopic_id=" + encodeURIComponent(subtopicId) + "&status=published");
      const filtered = Array.isArray(lessons) ? lessons : [];
      _subtopicLessonList = filtered;
      if (filtered.length === 0) {
        showStudentView('<div class="empty-state"><p>No lessons found</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", goBack);
        return;
      }
      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2>Lessons</h2>
        </div>
        <div class="card-grid">
          ${filtered.map(l => `
            <div class="card lesson-card" data-id="${l.id}" style="cursor:pointer">
              <h3>${escapeHtml(l.title)}</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status || "")}</p>
            </div>
          `).join("")}
        </div>
      `);
      document.getElementById("back-btn").addEventListener("click", goBack);
      document.querySelectorAll(".lesson-card").forEach(card => {
        card.addEventListener("click", () => viewStudentLesson(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  // Progress
  async function loadStudentProgress() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading progress...</p></div>');
    try {
      // Get student ID from profile
      const profile = await request("/students/me");
      const studentId = profile?.id;
      if (!studentId) {
        showStudentView('<div class="empty-state"><p>Could not load profile</p></div>');
        return;
      }
      const data = await request(`/progress/${studentId}`);
      const progress = Array.isArray(data) ? data : [];
      if (progress.length === 0) {
        showStudentView('<div class="empty-state"><p>No progress recorded yet</p></div>');
        return;
      }
      const bySubject = {};
      progress.forEach(p => {
        const subj = p.subject_name || "General";
        if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
        bySubject[subj].total++;
        if (p.completion_percentage >= 100) bySubject[subj].completed++;
      });
      showStudentView(`
        <h2>My Progress</h2>
        <div style="margin-top:1rem">
          ${Object.entries(bySubject).map(([name, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return `
              <div class="card" style="margin-bottom:0.75rem">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                  <strong>${escapeHtml(name)}</strong>
                  <span>${pct}%</span>
                </div>
                <div style="background:var(--color-border);height:8px;border-radius:4px">
                  <div style="background:var(--color-primary);height:100%;width:${pct}%;border-radius:4px"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `);
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading progress</p></div>'); }
  }

  // Bookmarks
  async function loadStudentBookmarks() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading bookmarks...</p></div>');
    try {
      const data = await request("/bookmarks/");
      const bookmarks = Array.isArray(data) ? data : [];
      if (bookmarks.length === 0) {
        showStudentView('<div class="empty-state"><p>No bookmarks yet</p></div>');
        return;
      }
      showStudentView(`
        <h2>My Bookmarks</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${bookmarks.map(b => `
            <div class="card" style="cursor:pointer" data-id="${b.lesson_id || b.id}">
              <h3>${escapeHtml(b.lesson_title || b.title || "Untitled")}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.querySelectorAll(".card[data-id]").forEach(card => {
        card.addEventListener("click", () => viewStudentLesson(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading bookmarks</p></div>'); }
  }

  // Assignments
  async function loadStudentAssignments() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading assignments...</p></div>');
    try {
      const assignments = await request("/assignments");
      const assignmentList = Array.isArray(assignments) ? assignments : [];
      showStudentView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2 style="margin:0">📋 Assignments</h2>
          </div>
          ${assignmentList.length === 0 ? '<div class="empty-state"><p>No assignments yet. Check back later.</p></div>' :
            assignmentList.map(a => `
              <div class="card" style="padding:1rem;margin-bottom:0.5rem;cursor:pointer" data-open-assignment="${a.id}">
                <div style="display:flex;justify-content:space-between;align-items:start">
                  <div>
                    <h4 style="margin:0">${escapeHtml(a.title)}</h4>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Due: ${a.due_date ? new Date(a.due_date).toLocaleDateString() : "No due date"} | ${a.status}</p>
                    ${a.paper_summary ? `<p style="color:var(--color-accent);font-size:0.78rem;margin-top:0.15rem">📄 ${examPaperMetaLine(a.paper_summary)}</p>` : ""}
                    ${a.notes ? `<p style="color:var(--color-text-muted);font-size:0.8rem;margin-top:0.15rem">${escapeHtml(a.notes)}</p>` : ""}
                  </div>
                  <span class="btn btn-sm btn-primary">Open</span>
                </div>
              </div>
            `).join("")}
        </div>
      `);
      document.querySelectorAll("[data-open-assignment]").forEach(card => {
        card.addEventListener("click", () => openStudentAssignment(card.dataset.openAssignment));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading assignments</p></div>'); }
  }

  async function openStudentAssignment(assignmentId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading assignment...</p></div>');
    try {
      const assignment = await request(`/assignments/${assignmentId}`);
      const lessonId = assignment.lesson_id;
      let studentId = null;
      try {
        const me = await request("/students/me");
        studentId = me && (me.id || me.user_id);
      } catch(e) {}
      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(assignment.title)}</h2>
          <button class="btn btn-primary" id="submit-assignment-btn">Submit Work</button>
        </div>
        ${assignment.notes ? `<p style="color:var(--color-text-muted);margin-bottom:1rem">${escapeHtml(assignment.notes)}</p>` : ""}
        ${assignment.paper ? `
          <div style="margin-bottom:0.75rem;display:flex;gap:0.5rem;align-items:center">
            <button class="btn btn-sm" id="toggle-paper-btn">Hide exam paper</button>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">Objective (multiple-choice) questions are auto-checked — structured and essay questions are answered on the blackboard below.</span>
          </div>
          <div id="exam-paper-box-${escapeHtml(assignment.id)}" style="margin-bottom:1rem">
            ${renderExamPaper(assignment.paper, { mode: "student", ns: "std-assignment-" + escapeHtml(assignment.id) })}
          </div>
        ` : ""}
        <div class="card" style="padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Complete on Blackboard</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Show your working below, then click Submit Work when done.</p>
          <div data-blackboard data-lesson-id="assignment-${assignmentId}" data-assignment-id="${assignmentId}" data-student-id="${escapeHtml(studentId || "")}" style="width:100%;height:480px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
        <div id="assignment-result" style="margin-top:0.75rem"></div>
      `);
      if (assignment.paper) {
        const paperBox = document.getElementById("exam-paper-box-" + assignment.id);
        if (paperBox) {
          bindExamScore(paperBox, assignment.paper);
          const toggle = document.getElementById("toggle-paper-btn");
          toggle.addEventListener("click", () => {
            const hidden = paperBox.style.display === "none";
            paperBox.style.display = hidden ? "" : "none";
            toggle.textContent = hidden ? "Hide exam paper" : "Show exam paper";
          });
        }
      }
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      document.getElementById("back-btn").addEventListener("click", loadStudentAssignments);
      document.getElementById("submit-assignment-btn").addEventListener("click", async () => {
        const bbEl = document.querySelector(`[data-assignment-id="${assignmentId}"]`);
        const bb = bbEl && bbEl._casuyaBlackboard;
        if (!bb) { showToast("Blackboard not loaded"); return; }
        const btn = document.getElementById("submit-assignment-btn");
        btn.disabled = true; btn.textContent = "Submitting...";
        try {
          // Collect blackboard elements
          const elements = bb.getElements ? bb.getElements() : [];
          // Collect MCQ radio answers
          const mcqAnswers = {};
          document.querySelectorAll('.exam-paper input[type="radio"]:checked').forEach(radio => {
            const name = radio.getAttribute("name");
            const qNum = name ? name.replace(/^.*-/, "") : null;
            if (qNum) mcqAnswers[qNum] = parseInt(radio.value);
          });
          // Collect structured/essay textarea answers
          const structuredAnswers = {};
          document.querySelectorAll('.exam-structured-answer').forEach(ta => {
            const qNum = ta.getAttribute("data-question");
            const text = ta.value.trim();
            if (qNum && text) structuredAnswers[qNum] = text;
          });
          // Combine into a single submission object
          const submission = {
            elements: elements,
            mcq_answers: mcqAnswers,
            structured_answers: structuredAnswers,
          };
          await request(`/assignments/${assignmentId}/submit`, {
            method: "POST",
            body: JSON.stringify({
              student_id: studentId || "anonymous",
              elements_json: JSON.stringify(submission),
            }),
          });
          document.getElementById("assignment-result").innerHTML = `
            <div class="card" style="padding:1.5rem;text-align:center">
              <h3 style="color:var(--color-success);margin:0 0 0.5rem">Submitted!</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem">Your teacher can now review your work.</p>
              <button class="btn btn-primary" id="back-to-assignments" style="margin-top:1rem">Back to Assignments</button>
            </div>
          `;
          document.getElementById("back-to-assignments").addEventListener("click", loadStudentAssignments);
        } catch(err) {
          btn.disabled = false; btn.textContent = "Submit Work";
          document.getElementById("assignment-result").innerHTML = `<p style="color:var(--color-danger)">Failed to submit: ${escapeHtml(err.message)}</p>`;
        }
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading assignment</p></div>'); }
  }

  // Games
  async function loadStudentGames() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games");
      const gameList = Array.isArray(games?.items) ? games.items : [];

      // Recently viewed from localStorage
      let recent = [];
      try { recent = getRecentlyViewed(); } catch(e) {}

      if (gameList.length === 0 && recent.length === 0) {
        showStudentView(`
          <h2>Games</h2>
          <div class="empty-state" style="margin-top:1rem">
            <p>No games available yet.</p>
            <p style="color:var(--color-text-muted);font-size:0.85rem">Games are added by your teacher and appear inside lessons.</p>
            <button class="btn btn-primary" id="browse-lessons-btn" style="margin-top:1rem">Browse Lessons</button>
          </div>
        `);
        document.getElementById("browse-lessons-btn")?.addEventListener("click", () => {
          setActiveNav("subjects");
          loadStudentSubjects();
        });
        return;
      }

      showStudentView(`
        <h2>Games</h2>
        ${gameList.length > 0 ? `
          <div class="card-grid" style="margin-top:1rem">
            ${gameList.map(g => `
              <div class="card game-card" data-id="${escapeHtml(g.id)}" style="cursor:pointer;position:relative">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                  <span style="font-size:1.5rem">🎮</span>
                  <h3 style="margin:0">${escapeHtml(g.title || "Untitled Game")}</h3>
                </div>
                <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(g.lesson_title || "Standalone game")}</p>
                <span style="display:inline-block;margin-top:0.5rem;font-size:0.75rem;padding:0.2rem 0.6rem;background:var(--color-bg);border-radius:var(--radius);color:var(--color-text-muted)">${escapeHtml(g.status || "active")}</span>
              </div>
            `).join("")}
          </div>
        ` : `
          <div class="empty-state" style="padding:2rem">
            <p>No standalone games found.</p>
          </div>
        `}
      `);

      document.querySelectorAll(".game-card").forEach(card => {
        card.addEventListener("click", () => viewStudentGame(card.dataset.id));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading games</p></div>'); }
  }

  // View a single game
  async function viewStudentGame(gameId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>');
    try {
      const game = await request(`/games/${gameId}`);
      const contentResp = await fetch(`${API_BASE}/games/${gameId}/content`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      }).then(r => r.ok ? r.text() : "").catch(() => "");

      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(game.title || "Game")}</h2>
        </div>
        <div style="width:100%">
          <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
        </div>
        <div class="card" style="margin-top:0.75rem;padding:1rem">
          <h3 style="margin:0 0 0.5rem">✏️ Scratch Pad</h3>
          <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out problems here while you play.</p>
          <div data-blackboard data-lesson-id="game-${gameId}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
        </div>
      `);

      const iframe = document.querySelector("#student-content .lesson-iframe");
      if (iframe && contentResp) {
        iframe.srcdoc = injectNodeBase(contentResp);
        let heightSet = false;
        const setHeight = () => {
          if (heightSet) return;
          try {
            const doc = iframe.contentWindow?.document;
            if (doc) {
              iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
              heightSet = true;
            }
          } catch(e) {}
        };
        iframe.addEventListener("load", setHeight);
        const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
        setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "600px"; }, 8000);
      } else if (iframe) {
        iframe.style.height = "400px";
        iframe.srcdoc = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-family:sans-serif"><p>Game content not available</p></div>';
      }

      document.getElementById("back-btn").addEventListener("click", goBack);
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading game</p><button class="btn" id="back-btn">← Back</button></div>'); document.getElementById("back-btn")?.addEventListener("click", goBack); }
  }

  // Profile editor
  async function showStudentProfileEditor() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading profile...</p></div>');
    try {
      const profile = await request("/students/me");
      showStudentView(`
        <h2>Edit Profile</h2>
        <form id="profile-form" class="card" style="margin-top:1rem;display:flex;flex-direction:column;gap:0.75rem">
          <label>Full Name<input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}"></label>
          <label>Form Level
            <select class="input" name="form_level">
              ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => `<option ${profile.form_level === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </label>
          <button class="btn btn-primary" type="submit">Save</button>
        </form>
      `);
      document.getElementById("profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await request("/students/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), form_level: fd.get("form_level") }) });
          showToast("Profile updated");
        } catch(err) { showToast("Error: " + err.message); }
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading profile</p></div>'); }
  }

  // View lesson content
  // P1-6 — warm the service worker / CDN cache with the next lesson's content
  // while the student is reading the current one, so "next" opens instantly.
  function _prefetchNextLesson(lessonId) {
    const idx = _subtopicLessonList.findIndex((l) => l.id === lessonId);
    if (idx < 0 || idx + 1 >= _subtopicLessonList.length) return;
    const next = _subtopicLessonList[idx + 1];
    fetch(`${API_BASE}/lessons/${next.id}/content`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
    }).catch(() => {});
  }

  async function viewStudentLesson(lessonId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      let lesson, isBookmarked, noteData, quizData, gamesData, lessonContent;
      try {
        // P2-3 — fetch package + content in parallel instead of sequentially
        const contentFetch = fetch(`${API_BASE}/lessons/${lessonId}/content`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
        }).then(r => r.ok ? r.text() : "").catch(() => "");

        const pkg = await request(`/lessons/${lessonId}/package`);
        lesson = pkg.lesson;
        isBookmarked = pkg.bookmark_status?.bookmarked || false;
        noteData = pkg.note || { content: "" };
        quizData = pkg.quiz;
        gamesData = pkg.games || [];

        lessonContent = (await contentFetch) || "<p>No content</p>";
      } catch(e) {
        const recent = getRecentlyViewed();
        const filtered = recent.filter(r => r.id !== lessonId);
        _recentlyViewedCache = filtered;
        _recentlyViewedCacheTs = Date.now();
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        showStudentView('<div class="empty-state"><p>This lesson is no longer available.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>');
        document.getElementById("back-to-overview")?.addEventListener("click", loadStudentOverview);
        return;
      }

      // Track recently viewed (localStorage + server-side)
      const recent = getRecentlyViewed();
      const exists = recent.findIndex(r => r.id === lessonId);
      if (exists >= 0) recent.splice(exists, 1);
      recent.unshift({ id: lessonId, title: lesson.title, viewedAt: Date.now() });
      if (recent.length > 20) recent.length = 20;
      _recentlyViewedCache = recent;
      _recentlyViewedCacheTs = Date.now();
      localStorage.setItem("casuya_recently_viewed", JSON.stringify(recent));
      // Fire-and-forget: record activity server-side for streak/stats
      request("/progress/activity", {
        method: "POST",
        body: JSON.stringify({ student_id: payload.id || payload.sub, lesson_id: lessonId, lesson_title: lesson.title }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
      _prefetchNextLesson(lessonId);

      const renderStudentQuiz = () => {
        if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
        return `
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.75rem">${escapeHtml(quizData.title || "Quiz")}</h3>
            <form id="quiz-form">
              ${quizData.questions.map((q, qi) => `
                <div style="margin-bottom:1rem">
                  <p style="font-weight:600;margin:0 0 0.5rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
                  ${q.options.map(o => `
                    <label style="display:block;padding:0.3rem 0.5rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.25rem">
                      <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required> ${escapeHtml(o.text)}
                    </label>
                  `).join("")}
                  <details style="margin-top:0.5rem">
                    <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
                    <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}-${escapeHtml(q.id)}" data-quiz-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
                  </details>
                </div>
              `).join("")}
              <button type="submit" class="btn btn-primary" id="quiz-submit-btn">Submit Quiz</button>
            </form>
            <div id="quiz-result" style="display:none;margin-top:0.75rem"></div>
          </div>
        `;
      };

      const renderStudentGames = () => {
        if (!Array.isArray(gamesData) || gamesData.length === 0) return "";
        return `
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">Games & Activities</h3>
            ${gamesData.map(g => `
              <div class="game-item" data-game-id="${escapeHtml(g.id)}" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);cursor:pointer">
                <span style="color:var(--color-primary)">${escapeHtml(g.title || "Game")}</span>
              </div>
            `).join("")}
            <div id="game-content-area" style="margin-top:1rem"></div>
          </div>
        `;
      };

      showStudentView(`
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(lesson.title)}</h2>
          <button id="bookmark-btn" class="btn-icon" style="font-size:1.5rem" title="Bookmark">${isBookmarked ? "★" : "☆"}</button>
          <button id="complete-btn" class="btn btn-primary" style="font-size:0.85rem">Mark Complete</button>
        </div>
        <div style="width:100%">
          <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
        </div>
        <div style="margin-top:0.75rem">
          <details>
            <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
            <div class="card" style="margin-top:0.5rem">
              <textarea id="lesson-note" class="input" rows="4" placeholder="Write your notes here...">${escapeHtml(noteData?.content || "")}</textarea>
              <button class="btn btn-primary" id="save-note" style="margin-top:0.5rem">Save Note</button>
            </div>
          </details>
          ${renderStudentQuiz()}
          ${renderStudentGames()}
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
            <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
          </div>
        </div>
      `);

      // Mount blackboard for student lesson
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }

      // Render lesson content in iframe
      const iframe = document.querySelector("#student-content .lesson-iframe");
      if (iframe) {
        iframe.srcdoc = injectNodeBase(lessonContent);
        let heightSet = false;
        const setHeight = () => {
          if (heightSet) return;
          try {
            const doc = iframe.contentWindow?.document;
            if (doc) {
              iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
              heightSet = true;
            }
          } catch(e) {}
        };
        iframe.addEventListener("load", setHeight);
        const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
        setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "800px"; }, 10000);

        // Bridge for quiz scores and progress
        const studentTokenPayload = decodeToken(localStorage.getItem("casuya_token"));
        let studentId = null;
        let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        try {
          const me = await request("/students/me");
          if (me && me.id) studentId = me.id;
        } catch(e) {}
        const onMessage = (e) => {
          if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
            const pct = Math.round((e.data.score / e.data.total) * 100);
            request("/progress/sync", {
              method: "POST",
              body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: pct }),
            }).catch(() => {});
          } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
            request("/progress/sync", {
              method: "POST",
              body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: e.data.percent }),
            }).catch(() => {});
          }
        };
        window.addEventListener("message", onMessage);

        // Sync initial progress (10%) when lesson opens
        if (studentId) {
          request("/progress/sync", {
            method: "POST",
            body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 10, score_percentage: null }),
          }).catch(() => {});
        }

        // Cleanup function for navigation away
        const cleanupLesson = () => {
          window.removeEventListener("message", onMessage);
          clearInterval(poll);
          clearTimeout(poll);
        };
        document.getElementById("back-btn").addEventListener("click", () => { cleanupLesson(); goBack(); });

        // Mark Complete button
        const completeBtn = document.getElementById("complete-btn");
        if (completeBtn && studentId) {
          completeBtn.addEventListener("click", () => {
            request("/progress/sync", {
              method: "POST",
              body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: null }),
            }).then(() => {
              completeBtn.textContent = "Completed!";
              completeBtn.disabled = true;
              completeBtn.style.opacity = "0.6";
              showToast("Progress saved");
            }).catch(() => showToast("Failed to save progress"));
          });
        } else if (completeBtn) {
          completeBtn.style.display = "none";
        }
      } else {
        document.getElementById("back-btn").addEventListener("click", goBack);
      }

      // Bookmark toggle
      document.getElementById("bookmark-btn").addEventListener("click", async () => {
        const btn = document.getElementById("bookmark-btn");
        if (isBookmarked) {
          await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
          btn.textContent = "☆";
        } else {
          await request(`/bookmarks/${lessonId}`, { method: "POST" });
          btn.textContent = "★";
        }
      });

      // Save note
      let noteTimer;
      document.getElementById("save-note").addEventListener("click", async () => {
        clearTimeout(noteTimer);
        const content = document.getElementById("lesson-note").value;
        await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
        showToast("Note saved");
      });

      // Auto-save notes on typing
      document.getElementById("lesson-note").addEventListener("input", () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(async () => {
          const content = document.getElementById("lesson-note").value;
          await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
        }, 2000);
      });

      // Quiz submit — wired to Show your work
      document.getElementById("quiz-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!quizData || !quizData.questions) return;
        const answers = {};
        quizData.questions.forEach(q => {
          const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
          if (sel) answers[q.id] = sel.value;
        });
        let work = null;
        try {
          if (window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.collectWorkMap) {
            work = window.CasuyaBlackboardEmbed.collectWorkMap("[data-quiz-question]");
          } else {
            work = {};
            document.querySelectorAll("[data-quiz-question]").forEach(el => {
              const qid = el.dataset.quizQuestion;
              const bb = el._casuyaBlackboard;
              if (bb && bb.getWorkSnapshot) work[qid] = bb.getWorkSnapshot();
              else if (bb && bb.getElements) { const els = bb.getElements(); work[qid] = { elements: els, hasWork: els.length>0, recognizedLatex: els.length>0?"__drawing__":"" }; }
            });
          }
          if (work && Object.keys(work).length === 0) work = null;
        } catch {}
        try {
          const body = work ? { answers, work } : { answers };
          const result = await request(`/quizzes/${quizData.id}/submit`, {
            method: "POST", body: JSON.stringify(body),
          });
          const el = document.getElementById("quiz-result");
          const combined = result.combined_percentage != null ? result.combined_percentage : result.percentage;
          const passed = combined >= 50;
          const hasWork = result.work_score != null;
          el.innerHTML = `
            <p style="color:${passed ? "var(--color-success)" : "var(--color-danger)"};font-weight:600">Score: ${result.score}/${result.total} (${Math.round(result.percentage)}%)</p>
            ${hasWork ? `<p style="font-size:0.85rem;color:var(--color-text-muted)">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · Combined (70/30): <strong>${Math.round(combined)}%</strong></p>` : ``}
            ${passed ? '<p style="color:var(--color-success)">Passed!</p>' : '<p style="color:var(--color-danger)">Try again</p>'}
            ${!passed ? '<button class="btn btn-sm btn-primary" id="retry-quiz-btn" style="margin-top:0.5rem">Retry Quiz</button>' : ''}
            ${hasWork && result.work_score < result.work_total ? '<p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.35rem">Tip: open "Show your work" to earn work credit.</p>' : ''}
          `;
          el.style.display = "block";
          if (!passed) {
            document.getElementById("retry-quiz-btn").addEventListener("click", () => {
              document.querySelectorAll('#quiz-form input[type="radio"]').forEach(r => r.checked = false);
              el.style.display = "none";
            });
          }
        } catch(err) {
          const el = document.getElementById("quiz-result");
          el.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`;
          el.style.display = "block";
        }
      });

      // Game items
      document.querySelectorAll(".game-item").forEach(item => {
        item.addEventListener("click", async () => {
          const area = document.getElementById("game-content-area");
          const gid = item.dataset.gameId;
          try {
            const resp = await fetch(`${API_BASE}/games/${gid}/content`, {
              headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
            });
            if (resp.ok) {
              const html = await resp.text();
              area.innerHTML = `
                <iframe style="width:100%;border:none;min-height:300px" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>
                <div style="margin-top:0.75rem">
                  <details>
                    <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">✏️ Scratch Pad</summary>
                    <div data-blackboard data-lesson-id="game-${gid}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
                  </details>
                </div>
              `;
              if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
            }
          } catch(e) {}
        });
      });

    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading lesson.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>'); document.getElementById("back-to-overview")?.addEventListener("click", loadStudentOverview); }
  }

  async function loadStudentDownloads() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading downloads...</p></div>');
    try {
      const lessons = await request("/lessons");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      let cachedIds = [];
      try { cachedIds = JSON.parse(localStorage.getItem("casuya_downloaded_lessons") || "[]"); } catch(e) {}
      const cachedLessons = lessonList.filter(l => cachedIds.includes(l.id));
      const availableLessons = lessonList.filter(l => !cachedIds.includes(l.id));

      showStudentView(`
        <div class="content">
          <h2>Downloads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Save lessons for offline viewing. Cached lessons are stored locally in your browser.</p>
          ${cachedLessons.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Cached Lessons (${cachedLessons.length})</h3>
            <div class="card-grid">
              ${cachedLessons.map(l => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-success);font-size:0.75rem;margin-top:0.25rem">Available offline</p>
                    </div>
                    <button class="btn btn-sm btn-danger" data-remove-download="${l.id}">Remove</button>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ''}
          <h3 style="margin:1.5rem 0 0.75rem">Available Lessons</h3>
          <div class="card-grid">
            ${availableLessons.length === 0 ? '<div class="empty-state"><p>All lessons are cached or none available.</p></div>' :
              availableLessons.map(l => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(l.status)}</p>
                    </div>
                    <button class="btn btn-sm btn-primary" data-download-lesson="${l.id}" data-title="${escapeHtml(l.title)}">Download</button>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("[data-download-lesson]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const lessonId = btn.dataset.downloadLesson;
          const title = btn.dataset.title;
          btn.disabled = true;
          btn.textContent = "Saving...";
          try {
            const contentResp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, {
              headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
            });
            if (contentResp.ok) {
              const html = await contentResp.text();
              const contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}");
              contentCache[lessonId] = { html, title, savedAt: Date.now() };
              localStorage.setItem("casuya_lesson_content_cache", JSON.stringify(contentCache));
              if (!cachedIds.includes(lessonId)) {
                cachedIds.push(lessonId);
                localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(cachedIds));
              }
              showToast("Lesson saved for offline viewing");
              loadStudentDownloads();
            }
          } catch(e) {
            showToast("Failed to save lesson");
            btn.disabled = false;
            btn.textContent = "Download";
          }
        });
      });
      document.querySelectorAll("[data-remove-download]").forEach(btn => {
        btn.addEventListener("click", () => {
          const lessonId = btn.dataset.removeDownload;
          const contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}");
          delete contentCache[lessonId];
          localStorage.setItem("casuya_lesson_content_cache", JSON.stringify(contentCache));
          cachedIds = cachedIds.filter(id => id !== lessonId);
          localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(cachedIds));
          loadStudentDownloads();
        });
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading downloads</p></div>'); }
  }

  // ── Reference Library (student — visible_to_students only) ──────
  async function loadStudentLibrary() {
    const SUBJECTS = [
      { slug: "mathematics", name: "Mathematics" },
      { slug: "biology", name: "Biology" },
      { slug: "chemistry", name: "Chemistry" },
      { slug: "physics", name: "Physics" },
      { slug: "english", name: "English" },
      { slug: "kiswahili", name: "Kiswahili" },
      { slug: "geography", name: "Geography" },
      { slug: "history", name: "History" },
      { slug: "history_civics", name: "Civics" },
      { slug: "computing", name: "Computing & ICT" },
    ];
    let docs = [];
    let total = 0;
    let filters = { doc_type: "", subject_slug: "", form_level: "", query: "" };
    let page = 0;
    const PAGE_SIZE = 20;

    function subjectOpts() {
      return '<option value="">All Subjects</option>' +
        SUBJECTS.map(s => `<option value="${s.slug}">${escapeHtml(s.name)}</option>`).join("");
    }

    async function loadDocs() {
      const params = new URLSearchParams();
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
      if (filters.form_level) params.set("form_level", filters.form_level);
      if (filters.query) params.set("query", filters.query);
      params.set("limit", PAGE_SIZE);
      params.set("offset", page * PAGE_SIZE);
      try {
        const res = await request("/reference-docs/student?" + params.toString());
        docs = res.items || [];
        total = res.total || 0;
      } catch (e) { docs = []; total = 0; }
    }

    function renderDocList() {
      const el = document.getElementById("lib-results");
      if (!el) return;
      if (!docs.length) {
        el.innerHTML = '<div class="tdocs-empty"><div class="tdocs-empty-icon">📖</div><p>No reference documents available yet. Your teacher will publish them here.</p></div>';
        return;
      }
      const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
      el.innerHTML = docs.map(d => {
        const typeLabel = d.doc_type === "scheme_of_work" ? "Scheme of Work" : "Lesson Plan";
        const typeCls = d.doc_type === "scheme_of_work" ? "tdocs-status-info" : "tdocs-status-success";
        const form = d.form_level ? "Form " + (ROMAN[d.form_level] || d.form_level) : "";
        return `
          <div class="lib-card" data-lib-view="${d.id}">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem">
              <span class="tdocs-status ${typeCls}">${typeLabel}</span>
              ${form ? `<span class="tdocs-status" style="background:var(--color-bg);color:var(--color-text-muted)">${form}</span>` : ""}
            </div>
            <h4 style="margin:0;font-size:0.88rem;font-weight:600">${escapeHtml(d.title)}</h4>
            <p style="margin:0.2rem 0 0;font-size:0.72rem;color:var(--color-text-muted)">${escapeHtml(d.subject_name || "")}</p>
          </div>`;
      }).join("");
      const totalPages = Math.ceil(total / PAGE_SIZE);
      const pag = document.getElementById("lib-pagination");
      if (pag) {
        pag.innerHTML = totalPages > 1 ? `
          <div style="display:flex;gap:0.5rem;align-items:center;justify-content:center;margin-top:1rem">
            <button class="btn btn-sm btn-outline" id="lib-prev" ${page === 0 ? "disabled" : ""}>← Prev</button>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">Page ${page + 1} of ${totalPages}</span>
            <button class="btn btn-sm btn-outline" id="lib-next" ${page >= totalPages - 1 ? "disabled" : ""}>Next →</button>
          </div>` : "";
      }
    }

    async function viewDoc(id) {
      const el = document.getElementById("lib-viewer");
      if (!el) return;
      el.innerHTML = '<div class="tdocs-loading"><div class="spinner"></div>Loading document...</div>';
      el.style.display = "block";
      try {
        const resp = await fetch("/reference-docs/" + id + "/render");
        const html = await resp.text();
        el.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
            <h4 style="margin:0;font-size:0.9rem;font-weight:700">Reference Document</h4>
            <button class="btn btn-sm btn-outline" id="lib-close-viewer">✕ Close</button>
          </div>
          <iframe srcdoc="${escapeHtml(html).replace(/"/g, '&quot;')}" style="width:100%;min-height:500px;border:1px solid var(--color-border);border-radius:8px;background:#fff"></iframe>`;
        document.getElementById("lib-close-viewer")?.addEventListener("click", () => { el.style.display = "none"; });
      } catch (e) {
        el.innerHTML = '<p style="color:var(--color-danger)">Error loading document.</p>';
      }
    }

    showStudentView(`
      <div class="content">
        <h2 class="tdocs-page-title">Reference Library</h2>
        <p class="tdocs-page-desc">Browse official TIE lesson plans and schemes of work published by your teacher.</p>

        <div style="display:grid;gap:0.6rem;margin-top:1.25rem">
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <select class="input" id="lib-type" style="max-width:180px;padding:0.45rem 0.6rem;font-size:0.85rem">
              <option value="">All Types</option>
              <option value="lesson_plan">Lesson Plans</option>
              <option value="scheme_of_work">Schemes of Work</option>
            </select>
            <select class="input" id="lib-subject" style="max-width:180px;padding:0.45rem 0.6rem;font-size:0.85rem">${subjectOpts()}</select>
            <select class="input" id="lib-form" style="max-width:140px;padding:0.45rem 0.6rem;font-size:0.85rem">
              <option value="">All Forms</option>
              <option value="1">Form I</option>
              <option value="2">Form II</option>
              <option value="3">Form III</option>
              <option value="4">Form IV</option>
            </select>
            <input class="input" id="lib-search" type="search" placeholder="Search titles..." style="max-width:220px;padding:0.45rem 0.6rem;font-size:0.85rem">
          </div>
          <div id="lib-results"></div>
          <div id="lib-pagination"></div>
        </div>

        <div id="lib-viewer" style="display:none;margin-top:1.5rem"></div>
      </div>
    `);

    const typeEl = document.getElementById("lib-type");
    const subjEl = document.getElementById("lib-subject");
    const formEl = document.getElementById("lib-form");
    const searchEl = document.getElementById("lib-search");
    let searchTimer;

    function applyFilters() {
      filters.doc_type = typeEl.value;
      filters.subject_slug = subjEl.value;
      filters.form_level = formEl.value;
      page = 0;
      loadDocs().then(renderDocList);
    }

    typeEl?.addEventListener("change", applyFilters);
    subjEl?.addEventListener("change", applyFilters);
    formEl?.addEventListener("change", applyFilters);
    searchEl?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filters.query = searchEl.value.trim(); page = 0; loadDocs().then(renderDocList); }, 300);
    });

    document.getElementById("lib-results")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lib-view]");
      if (btn) viewDoc(btn.dataset.libView);
    });
    document.getElementById("lib-pagination")?.addEventListener("click", (e) => {
      if (e.target.id === "lib-prev") { page--; loadDocs().then(renderDocList); }
      if (e.target.id === "lib-next") { page++; loadDocs().then(renderDocList); }
    });

    await loadDocs();
    renderDocList();
  }

  async function loadStudentExams() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading exams...</p></div>');
    try {
      const quizzes = await request("/quizzes");
      const quizList = Array.isArray(quizzes) ? quizzes : [];
      let examHistory = [];
      try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}

      showStudentView(`
        <div class="content">
          <h2>Exams</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Take timed exams. Your progress is saved automatically.</p>
          ${quizList.length === 0 ? '<div class="empty-state" style="margin-top:1rem"><p>No exams available yet.</p></div>' : `
            <div class="card-grid" style="margin-top:1rem">
              ${quizList.map(q => {
                const history = examHistory.filter(h => h.quizId === q.id);
                const bestScore = history.length > 0 ? Math.max(...history.map(h => h.combined_percentage != null ? h.combined_percentage : h.percentage)) : null;
                const bestWork = history.length > 0 ? Math.max(...history.map(h => h.work_percentage ?? 0)) : 0;
                return `
                  <div class="card" style="padding:1rem">
                    <h3 style="margin:0">${escapeHtml(q.title || "Exam")}</h3>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${q.question_count ?? q.questions?.length ?? 0} questions</p>
                    ${bestScore !== null ? `<p style="color:var(--color-success);font-size:0.85rem;margin-top:0.15rem">Best: ${bestScore}%${bestWork ? ` <span style="color:var(--color-text-muted);font-size:0.75rem">(work ${bestWork}%)</span>` : ''}</p>` : ''}
                    <button class="btn btn-primary btn-sm start-exam-btn" data-quiz-id="${q.id}" style="margin-top:0.5rem">Start Exam</button>
                  </div>
                `;
              }).join("")}
            </div>
          `}
          ${examHistory.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Exam History</h3>
            <div class="card" style="padding:1rem">
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
                  <tr style="border-bottom:1px solid var(--color-border)">
                    <th style="padding:0.5rem;text-align:left">Quiz</th>
                    <th style="padding:0.5rem;text-align:left">Score</th>
                    <th style="padding:0.5rem;text-align:left">Date</th>
                  </tr>
                  ${examHistory.slice(-10).reverse().map(h => {
                    const dispPct = h.combined_percentage != null ? h.combined_percentage : h.percentage;
                    const workInfo = h.work_percentage != null ? ` + work ${h.work_score}/${h.work_total}` : '';
                    return `
                    <tr style="border-bottom:1px solid var(--color-border)">
                      <td style="padding:0.5rem">${escapeHtml(h.quizTitle || "Quiz")}</td>
                      <td style="padding:0.5rem;color:${dispPct >= 50 ? 'var(--color-success)' : 'var(--color-danger)'}">${h.score}/${h.total} (${h.percentage}%${workInfo} → <strong>${dispPct}%</strong>)</td>
                      <td style="padding:0.5rem;color:var(--color-text-muted)">${new Date(h.takenAt).toLocaleDateString()}</td>
                    </tr>
                  `}).join("")}
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      `);
      document.querySelectorAll(".start-exam-btn").forEach(btn => {
        btn.addEventListener("click", () => startExam(btn.dataset.quizId));
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading exams</p></div>'); }
  }

  async function startExam(quizId) {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading exam...</p></div>');
    try {
      const quizData = await request(`/quizzes/${quizId}`);
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        showStudentView('<div class="empty-state"><p>No questions in this exam.</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", loadStudentExams);
        return;
      }

      let timeLimit = quizData.time_limit || 30 * 60;
      let timeLeft = timeLimit;
      let examSubmitted = false;

      const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

      showStudentView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding:0.75rem 1rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)">
            <h2 style="margin:0;font-size:1rem">${escapeHtml(quizData.title || "Exam")}</h2>
            <div style="display:flex;align-items:center;gap:1rem">
              <span id="exam-timer" style="font-size:1.1rem;font-weight:700;color:var(--color-primary);font-variant-numeric:tabular-nums">${formatTime(timeLeft)}</span>
              <button class="btn btn-danger btn-sm" id="submit-exam-btn">Submit</button>
            </div>
          </div>
          <form id="exam-form">
            ${quizData.questions.map((q, qi) => `
              <div class="card" style="padding:1rem;margin-bottom:0.75rem">
                <p style="font-weight:600;margin:0 0 0.75rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
                ${q.options.map(o => `
                  <label style="display:block;padding:0.5rem 0.75rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.35rem;transition:background 0.15s">
                    <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required style="margin-right:0.5rem"> ${escapeHtml(o.text)}
                  </label>
                `).join("")}
                <details style="margin-top:0.5rem">
                  <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
                  <div data-blackboard data-lesson-id="exam-${quizId}-${escapeHtml(q.id)}" data-exam-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
                </details>
              </div>
            `).join("")}
          </form>
          <div id="exam-result" style="display:none;margin-top:1rem"></div>
        </div>
      `);

      // Mount blackboards for Show your work (exam)
      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      // Add live badge on each Show your work details when work is drawn
      document.querySelectorAll("details").forEach(d => {
        const bbDiv = d.querySelector("[data-blackboard]");
        if (!bbDiv) return;
        const summ = d.querySelector("summary");
        if (!summ) return;
        const baseLabel = summ.textContent.trim();
        bbDiv.addEventListener("casuya:blackboard-ready", () => {});
        // Poll for hasWork to update badge (lightweight)
        const check = () => {
          const bb = bbDiv._casuyaBlackboard;
          const has = bb && bb.getElements && bb.getElements().length > 0;
          summ.textContent = has ? `${baseLabel} — ✅ work captured` : baseLabel;
          summ.style.color = has ? "var(--color-success)" : "var(--color-text-muted)";
          summ.style.fontWeight = has ? "600" : "";
        };
        bbDiv.addEventListener("click", () => setTimeout(check, 100));
        // Hook blackboard change event if available
        const hook = setInterval(() => {
          const bb = bbDiv._casuyaBlackboard;
          if (bb && bb.on) { bb.on("change", check); clearInterval(hook); }
          if (!document.body.contains(bbDiv)) clearInterval(hook);
        }, 500);
        setTimeout(check, 800);
      });

      const timerEl = document.getElementById("exam-timer");
      const timerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = formatTime(timeLeft);
        if (timeLeft <= 0 && !examSubmitted) {
          clearInterval(timerInterval);
          submitExam();
        }
        if (timeLeft <= 60 && timerEl) timerEl.style.color = "var(--color-danger)";
      }, 1000);

      async function submitExam() {
        if (examSubmitted) return;
        examSubmitted = true;
        clearInterval(timerInterval);
        const submitBtn = document.getElementById("submit-exam-btn");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting..."; }
        const answers = {};
        quizData.questions.forEach(q => {
          const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
          if (sel) answers[q.id] = sel.value;
        });
        // Collect Show your work per exam question (data-exam-question)
        let work = null;
        try {
          if (window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.collectWorkMap) {
            work = window.CasuyaBlackboardEmbed.collectWorkMap("[data-exam-question]");
          } else {
            work = {};
            document.querySelectorAll("[data-exam-question]").forEach(el => {
              const qid = el.dataset.examQuestion;
              const bb = el._casuyaBlackboard;
              if (bb && bb.getWorkSnapshot) work[qid] = bb.getWorkSnapshot();
              else if (bb && bb.getElements) { const els = bb.getElements(); work[qid] = { elements: els, hasWork: els.length>0, recognizedLatex: els.length>0?"__drawing__":"" }; }
            });
          }
          if (work && Object.keys(work).length === 0) work = null;
        } catch {}
        try {
          const body = work ? { answers, work } : { answers };
          const result = await request(`/quizzes/${quizId}/submit`, {
            method: "POST", body: JSON.stringify(body),
          });
          // Also attempt step-grading via the dedicated grading engine for richer feedback (best-effort).
          let extraStepFeedback = null;
          if (work && window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.gradeWorkMap) {
            try { extraStepFeedback = await window.CasuyaBlackboardEmbed.gradeWorkMap(work, null); } catch {}
          }
          let examHistory = [];
          try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}
          const finalPct = result.combined_percentage != null ? result.combined_percentage : result.percentage;
          examHistory.push({
            quizId,
            quizTitle: quizData.title,
            score: result.score,
            total: result.total,
            percentage: Math.round(result.percentage),
            work_score: result.work_score,
            work_total: result.work_total,
            work_percentage: result.work_percentage,
            combined_percentage: result.combined_percentage != null ? Math.round(result.combined_percentage) : Math.round(result.percentage),
            timeSpent: timeLimit - timeLeft,
            takenAt: Date.now(),
          });
          localStorage.setItem("casuya_exam_history", JSON.stringify(examHistory));

          const passed = finalPct >= 50;
          const hasWork = result.work_score != null;
          document.getElementById("exam-result").innerHTML = `
            <div class="card" style="padding:1.5rem;text-align:center">
              <h3 style="color:${passed ? 'var(--color-success)' : 'var(--color-danger)'};margin:0 0 0.5rem">Exam ${passed ? 'Passed!' : 'Not Passed'}</h3>
              <p style="font-size:1.5rem;font-weight:700;margin:0.5rem 0">Score: ${result.score}/${result.total} (${Math.round(result.percentage)}%)</p>
              ${hasWork ? `<p style="font-size:0.95rem;margin:0.25rem 0">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · <strong>Combined: ${Math.round(finalPct)}%</strong> <span style="font-size:0.8rem;color:var(--color-text-muted)">(70% answer + 30% work)</span></p>` : ``}
              ${hasWork && result.work_score < result.work_total ? `<p style="font-size:0.8rem;color:var(--color-text-muted)">You left ${result.work_total - result.work_score} "Show your work" board(s) empty.</p>` : ``}
              ${extraStepFeedback && extraStepFeedback.stepResults && extraStepFeedback.stepResults.length ? `<div style="text-align:left;margin-top:0.75rem;font-size:0.85rem">${extraStepFeedback.stepResults.map((s,i)=>`<div style="padding:0.25rem 0;border-bottom:1px solid var(--color-border)"><span style="font-weight:600">Q${i+1} work:</span> ${escapeHtml(s.feedback)} ${s.hasWork ? '✅' : '⬜'}</div>`).join("")}</div>` : ``}
              <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">Time: ${formatTime(timeLimit - timeLeft)}</p>
              <button class="btn btn-primary" id="back-to-exams" style="margin-top:1rem">Back to Exams</button>
            </div>
          `;
          document.getElementById("exam-result").style.display = "block";
          document.getElementById("exam-form").style.display = "none";
          document.getElementById("back-to-exams")?.addEventListener("click", loadStudentExams);
        } catch(err) {
          document.getElementById("exam-result").innerHTML = `<div class="card" style="padding:1rem"><p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p></div>`;
          document.getElementById("exam-result").style.display = "block";
        }
      }

      document.getElementById("submit-exam-btn")?.addEventListener("click", () => {
        if (!examSubmitted && confirm("Submit exam?")) submitExam();
      });
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading exam</p></div>'); }
  }

  async function loadStudentFiles() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading files...</p></div>');
    try {
      const files = await request("/uploads/public").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];
      let activeFilter = "all";

      function renderStudentFiles() {
        let filtered = fileList;
        if (activeFilter !== "all") {
          const ext = { images: "image", documents: "doc", media: "media" }[activeFilter];
          if (ext === "image") filtered = fileList.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.filename || f.path || ""));
          else if (ext === "doc") filtered = fileList.filter(f => /\.(pdf|doc|docx|txt)$/i.test(f.filename || f.path || ""));
          else if (ext === "media") filtered = fileList.filter(f => /\.(mp4|webm|mp3|wav|ogg)$/i.test(f.filename || f.path || ""));
        }
        const grid = document.getElementById("student-files-grid");
        if (!grid) return;
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No files available</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(f => {
          const name = f.filename || f.path || "unknown";
          const displayName = f.display_name || name;
          const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);
          const isVideo = /\.(mp4|webm)$/i.test(name);
          const isAudio = /\.(mp3|wav|ogg)$/i.test(name);
          const icon = isImage ? "🖼️" : isVideo ? "🎬" : isAudio ? "🎵" : "📄";
          return `
            <div class="card" style="padding:0.75rem;cursor:pointer" onclick="window.open('${API_BASE}/uploads/${encodeURIComponent(name)}', '_blank')">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(displayName)}</p>
                  <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${f.size ? (f.size / 1024).toFixed(1) + " KB" : ""}</p>
                </div>
              </div>
            </div>
          `;
        }).join("");
      }

      showStudentView(`
        <div class="content">
          <h2>📂 Files & Resources</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Browse and download files uploaded by your teachers.</p>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn-filter student-files-filter active" data-filter="all">All</button>
            <button class="btn-filter student-files-filter" data-filter="images">🖼️ Images</button>
            <button class="btn-filter student-files-filter" data-filter="documents">📄 Documents</button>
            <button class="btn-filter student-files-filter" data-filter="media">🎬 Media</button>
          </div>
          <div id="student-files-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.5rem"></div>
        </div>
      `);
      document.querySelectorAll(".student-files-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".student-files-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderStudentFiles();
        });
      });
      renderStudentFiles();
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading files</p></div>'); }
  }

  async function loadStudentPayments() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
    try {
      const [history, subs, invoices] = await Promise.all([
        request("/payments/my-history").catch(() => ({ transactions: [], total_paid: 0, pending_amount: 0, total_transactions: 0 })),
        request("/payments/subscriptions").catch(() => []),
        request("/payments/invoices").catch(() => []),
      ]);
      const txList = Array.isArray(history.transactions) ? history.transactions : [];
      const subList = Array.isArray(subs) ? subs : [];
      const invList = Array.isArray(invoices) ? invoices : [];
      const totalPaid = history.total_paid || 0;
      const pendingAmount = history.pending_amount || 0;
      const totalTx = history.total_transactions || 0;

      function renderTab(tabId) {
        if (tabId === "payments") {
          return `
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <h3>Available Plans</h3>
              <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Pay a plan fee to Casuya (Admin) via mobile money.</p>
              <div id="student-plans-list"><div class="loading-state"><div class="spinner"></div></div></div>
            </div>
            <div class="card" style="padding:0;max-width:560px;margin-top:1rem;overflow:hidden">
              <div class="checkout-header">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <h3>Make a Payment</h3>
              </div>
              <form id="student-payment-form" class="checkout-body">
                <div>
                  <label class="field-label">Mobile Number</label>
                  <div class="input-icon-wrap">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    <input class="input" name="mobile_number" placeholder="0712345678" required>
                  </div>
                </div>
                <div>
                  <label class="field-label">Amount (TZS)</label>
                  <div class="input-icon-wrap">
                    <span class="input-currency-prefix">TZS</span>
                    <input class="input" name="amount_tzs" type="number" placeholder="5,000" required min="100">
                  </div>
                </div>
                <div>
                  <label class="field-label">Provider</label>
                  <div class="provider-grid">
                    <label class="provider-card"><input type="radio" name="provider" value="m-pesa" required><span class="provider-dot" style="background:#16a34a"></span><span>M-Pesa</span></label>
                    <label class="provider-card"><input type="radio" name="provider" value="tigo-pesa"><span class="provider-dot" style="background:#2563eb"></span><span>Tigo Pesa</span></label>
                    <label class="provider-card"><input type="radio" name="provider" value="halopesa"><span class="provider-dot" style="background:#d97706"></span><span>HaloPesa</span></label>
                    <label class="provider-card"><input type="radio" name="provider" value="azampay"><span class="provider-dot" style="background:#8b5cf6"></span><span>AzamPay</span></label>
                  </div>
                </div>
                <button class="btn btn-success btn-block" type="submit" id="student-payment-submit-btn">Pay Now</button>
              </form>
              <div id="student-payment-result" style="padding:0 1.5rem 1.5rem"></div>
            </div>
            <div class="card" style="padding:1.5rem;margin-top:1rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                <h3>Payment History</h3>
                <button class="btn btn-sm" id="student-refresh-tx-btn">Refresh</button>
              </div>
              ${txList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No payments yet</p></div>' : `<div style="overflow-x:auto"><table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem"><thead><tr style="border-bottom:2px solid var(--color-border)"><th style="padding:0.6rem;text-align:left;font-weight:600">Date</th><th style="padding:0.6rem;text-align:left;font-weight:600">Provider</th><th style="padding:0.6rem;text-align:right;font-weight:600">Amount</th><th style="padding:0.6rem;text-align:center;font-weight:600">Status</th></tr></thead><tbody>${txList.map(t => `<tr style="border-bottom:1px solid var(--color-border)"><td style="padding:0.6rem;color:var(--color-text-muted)">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "\u2014"}</td><td style="padding:0.6rem">${escapeHtml(t.provider || "\u2014")}</td><td style="padding:0.6rem;text-align:right;font-weight:600">${(t.amount_tzs || 0).toLocaleString()} TZS</td><td style="padding:0.6rem;text-align:center"><span class="badge badge-${t.status || 'pending'}">${escapeHtml(t.status || "unknown")}</span></td></tr>`).join("")}</tbody></table></div>`}
            </div>`;
        }
        if (tabId === "subscriptions") {
          return subList.length === 0
            ? '<div class="empty-state" style="padding:3rem"><p>No active subscriptions</p></div>'
            : `<div style="display:grid;gap:0.75rem;margin-top:1rem">${subList.map(s => `
              <div class="card" style="padding:1rem;display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-weight:600">${escapeHtml(s.plan_id)}</div><div style="font-size:0.8rem;color:var(--color-text-muted)">Since ${new Date(s.created_at).toLocaleDateString()}</div></div>
                <div style="text-align:right"><div style="font-weight:600">${(s.amount || 0).toLocaleString()} TZS</div><span class="badge badge-${s.status === 'active' ? 'completed' : 'pending'}">${escapeHtml(s.status)}</span></div>
              </div>`).join("")}</div>`;
        }
        if (tabId === "invoices") {
          return invList.length === 0
            ? '<div class="empty-state" style="padding:3rem"><p>No invoices yet</p></div>'
            : `<div style="overflow-x:auto;margin-top:1rem"><table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem"><thead><tr style="border-bottom:2px solid var(--color-border)"><th style="padding:0.6rem;text-align:left;font-weight:600">Invoice #</th><th style="padding:0.6rem;text-align:right;font-weight:600">Amount</th><th style="padding:0.6rem;text-align:left;font-weight:600">Due Date</th><th style="padding:0.6rem;text-align:center;font-weight:600">Status</th></tr></thead><tbody>${invList.map(inv => `<tr style="border-bottom:1px solid var(--color-border)"><td style="padding:0.6rem;font-weight:500">${escapeHtml(inv.invoice_number || "\u2014")}</td><td style="padding:0.6rem;text-align:right;font-weight:600">${(inv.total_amount || 0).toLocaleString()} TZS</td><td style="padding:0.6rem;color:var(--color-text-muted)">${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "\u2014"}</td><td style="padding:0.6rem;text-align:center"><span class="badge badge-${inv.status === 'paid' ? 'completed' : inv.status === 'pending' ? 'pending' : 'failed'}">${escapeHtml(inv.status)}</span></td></tr>`).join("")}</tbody></table></div>`;
        }
        return "";
      }

      showStudentView(`
        <div class="content">
          <h2>Payments</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Manage your payments, subscriptions and invoices</p>
          <div class="stat-grid" style="margin-top:1rem">
            <div class="stat-card"><div class="stat-icon" style="background:#f0fdf4;color:#16a34a">💰</div><div class="stat-value">${totalPaid.toLocaleString()}</div><div class="stat-label">Total Paid (TZS)</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;color:#d97706">⏳</div><div class="stat-value">${pendingAmount.toLocaleString()}</div><div class="stat-label">Pending (TZS)</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#eff6ff;color:#2563eb">📊</div><div class="stat-value">${totalTx}</div><div class="stat-label">Transactions</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#ede9fe;color:#7c3aed">🔄</div><div class="stat-value">${subList.filter(s => s.status === "active").length}</div><div class="stat-label">Active Subs</div></div>
          </div>
          <div class="tab-bar" style="margin-top:1rem">
            <button class="tab-btn active" data-stab="payments">💳 Payments</button>
            <button class="tab-btn" data-stab="subscriptions">🔄 Subscriptions</button>
            <button class="tab-btn" data-stab="invoices">📄 Invoices</button>
          </div>
          <div id="student-payment-tab-content">${renderTab("payments")}</div>
        </div>
      `);

      // Tab switching
      document.querySelectorAll("[data-stab]").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("[data-stab]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          document.getElementById("student-payment-tab-content").innerHTML = renderTab(btn.dataset.stab);
          bindStudentPaymentForm();
          loadStudentPlans();
        });
      });

      function bindStudentPaymentForm() {
        let studentPaymentInProgress = false;
        document.getElementById("student-payment-form")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const btn = document.getElementById("student-payment-submit-btn");
          if (studentPaymentInProgress) return;
          studentPaymentInProgress = true;
          btn.innerHTML = '<span class="btn-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg> Processing...</span>';
          btn.disabled = true;
          const fd = new FormData(ev.target);
          try {
            const result = await request("/payments/checkout", {
              method: "POST",
              body: JSON.stringify({
                mobile_number: fd.get("mobile_number"),
                amount_tzs: parseInt(fd.get("amount_tzs"), 10),
                provider: fd.get("provider"),
                idempotency_key: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
              }),
            });
            if (result === null) return;
            document.getElementById("student-payment-result").innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(result.id || "")}</span></div></div>`;
            loadStudentPayments();
          } catch (err) {
            document.getElementById("student-payment-result").innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
          }
          studentPaymentInProgress = false;
          btn.innerHTML = 'Pay Now';
          btn.disabled = false;
        });
      }
      bindStudentPaymentForm();
      loadStudentPlans();
      document.getElementById("student-refresh-tx-btn")?.addEventListener("click", loadStudentPayments);
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
  }

  async function loadStudentPlans() {
    const el = document.getElementById("student-plans-list");
    if (!el) return;
    try {
      const plans = await request("/payments/plans").catch(() => []);
      if (!Array.isArray(plans) || plans.length === 0) {
        el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>No payment plans available right now.</p></div>';
        return;
      }
      el.innerHTML = plans.map(p => `
        <div class="plan-card" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:1rem;margin-top:0.75rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">
            <div>
              <div style="font-weight:600;font-size:1rem">${escapeHtml(p.name)}</div>
              <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem">${escapeHtml(p.description || "")}</div>
              <div style="font-weight:700;font-size:1.1rem;margin-top:0.5rem">${Number(p.amount_tzs).toLocaleString()} ${escapeHtml(p.currency || "TZS")}</div>
            </div>
            <span class="badge badge-completed" style="text-transform:capitalize">${escapeHtml(p.audience)}</span>
          </div>
          <form class="student-plan-form" data-plan-id="${p.id}" style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:end">
            <div style="flex:1;min-width:140px">
              <label class="field-label">Mobile Number</label>
              <input class="input" name="mobile_number" placeholder="0712345678" required>
            </div>
            <div style="min-width:130px">
              <label class="field-label">Provider</label>
              <select class="input" name="provider" required>
                <option value="m-pesa">M-Pesa</option>
                <option value="tigo-pesa">Tigo Pesa</option>
                <option value="halopesa">HaloPesa</option>
                <option value="azampay">AzamPay</option>
              </select>
            </div>
            <button class="btn btn-success" type="submit">Pay ${Number(p.amount_tzs).toLocaleString()} ${escapeHtml(p.currency || "TZS")}</button>
          </form>
          <div class="student-plan-result" data-plan-id="${p.id}" style="margin-top:0.5rem"></div>
        </div>
      `).join("");
      bindStudentPlanForms();
    } catch (e) {
      el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>Could not load plans.</p></div>';
    }
  }

  function bindStudentPlanForms() {
    document.querySelectorAll(".student-plan-form").forEach(form => {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const planId = form.getAttribute("data-plan-id");
        const btn = form.querySelector("button[type=submit]");
        const resultEl = document.querySelector(`.student-plan-result[data-plan-id="${planId}"]`);
        const fd = new FormData(ev.target);
        btn.disabled = true; btn.innerHTML = '<span class="btn-spinner">Processing...</span>';
        try {
          const result = await request(`/payments/plans/${planId}/checkout`, {
            method: "POST",
            body: JSON.stringify({
              mobile_number: fd.get("mobile_number"),
              provider: fd.get("provider"),
              idempotency_key: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            }),
          });
          if (result === null) return;
          resultEl.innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(result.id || "")}</span></div></div>`;
          loadStudentPayments();
        } catch (err) {
          resultEl.innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
        } finally {
          btn.disabled = false; btn.textContent = "Pay";
        }
      });
    });
  }

  async function loadStudentNotifications() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const data = await request("/notifications");
      const allNotifs = Array.isArray(data) ? data : [];
      const unread = allNotifs.filter(n => !n.is_read);
      const read = allNotifs.filter(n => n.is_read);
      let showFilter = "all";

      function render() {
        let list = allNotifs;
        if (showFilter === "unread") list = unread;
        else if (showFilter === "read") list = read;
        const el = document.getElementById("student-notif-list");
        if (!el) return;
        if (list.length === 0) {
          el.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No notifications</p></div>';
          return;
        }
        el.innerHTML = list.map(n => `
          <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.5rem;${n.is_read ? "opacity:0.7" : "border-left:3px solid var(--color-primary)"}">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem">
              <div style="flex:1">
                <p style="margin:0;font-size:0.875rem;${n.is_read ? "" : "font-weight:600"}">${escapeHtml(n.message)}</p>
                <p style="margin:0.25rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">${n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
              </div>
              ${!n.is_read ? `<button class="btn btn-primary btn-xs student-notif-read" data-id="${n.id}">✓ Read</button>` : ""}
            </div>
          </div>
        `).join("");
        document.querySelectorAll(".student-notif-read").forEach(btn => {
          btn.addEventListener("click", async () => {
            await request(`/notifications/${btn.dataset.id}/read`, { method: "POST" });
            const n = allNotifs.find(x => x.id === btn.dataset.id);
            if (n) n.is_read = true;
            unread.length = 0; unread.push(...allNotifs.filter(x => !x.is_read));
            read.length = 0; read.push(...allNotifs.filter(x => x.is_read));
            const badge = document.getElementById("notif-badge");
            if (badge) { const c = unread.length; badge.textContent = c; badge.style.display = c > 0 ? "inline" : "none"; }
            render();
          });
        });
      }

      showStudentView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>🔔 Notifications</h2>
            <button class="btn btn-ghost btn-sm" id="student-mark-all-read">✓ Mark All Read</button>
          </div>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter student-notif-filter active" data-filter="all">All <span class="filter-count">${allNotifs.length}</span></button>
            <button class="btn-filter student-notif-filter" data-filter="unread">🔴 Unread <span class="filter-count">${unread.length}</span></button>
            <button class="btn-filter student-notif-filter" data-filter="read">✅ Read <span class="filter-count">${read.length}</span></button>
          </div>
          <div id="student-notif-list" style="margin-top:0.75rem"></div>
        </div>
      `);
      document.querySelectorAll(".student-notif-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          showFilter = btn.dataset.filter;
          document.querySelectorAll(".student-notif-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === showFilter));
          render();
        });
      });
      document.getElementById("student-mark-all-read")?.addEventListener("click", async () => {
        await Promise.all(unread.map(n =>
          request(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {})
        ));
        unread.forEach(n => n.is_read = true);
        unread.length = 0; read.length = 0; read.push(...allNotifs);
        const badge = document.getElementById("notif-badge");
        if (badge) badge.style.display = "none";
        render();
      });
      render();
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
  }

  async function loadStudentSettings() {
    showStudentView('<div class="loading-state"><div class="spinner"></div><p>Loading settings...</p></div>');
    try {
      const [me, profile] = await Promise.all([
        request("/users/me").catch(() => ({})),
        request("/students/me").catch(() => ({})),
      ]);
      const activeTab = localStorage.getItem("student_settings_tab") || "profile";

      function renderTab(tab) {
        localStorage.setItem("student_settings_tab", tab);
        document.querySelectorAll(".student-settings-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        const panel = document.getElementById("student-settings-panel");
        if (!panel) return;

        if (tab === "profile") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">My Profile</h3>
              <form id="student-profile-form" style="display:flex;flex-direction:column;gap:0.75rem">
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Full Name</label>
                  <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" placeholder="Your name">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Email</label>
                  <input class="input" value="${escapeHtml(me.email || "")}" disabled style="opacity:0.6">
                </div>
                <div>
                  <label style="font-size:0.85rem;font-weight:500;display:block;margin-bottom:0.25rem">Form Level</label>
                  <select class="input" name="form_level">
                    <option value="">Select...</option>
                    ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => `<option value="${f}" ${profile.form_level === f ? "selected" : ""}>${f}</option>`).join("")}
                  </select>
                </div>
                <button class="btn btn-primary btn-pattern" type="submit" style="align-self:flex-start">💾 Save Changes</button>
              </form>
              <p id="student-profile-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
            </div>
          `;
          document.getElementById("student-profile-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("student-profile-msg");
            try {
              await request("/students/me", { method: "PATCH", body: JSON.stringify({ full_name: fd.get("full_name"), form_level: fd.get("form_level") }) });
              msg.textContent = "✅ Profile updated!"; msg.style.color = "var(--color-success)"; msg.style.display = "block";
              setTimeout(() => msg.style.display = "none", 3000);
            } catch(err) { msg.textContent = "❌ " + err.message; msg.style.color = "var(--color-danger)"; msg.style.display = "block"; }
          });
        } else if (tab === "password") {
          panel.innerHTML = `
            <div class="card" style="padding:1.5rem">
              <h3 style="margin-bottom:0.75rem">Change Password</h3>
              <form id="student-pw-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">
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
              <p id="student-pw-msg" style="font-size:0.85rem;margin-top:0.5rem;display:none"></p>
            </div>
          `;
          document.getElementById("student-pw-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const msg = document.getElementById("student-pw-msg");
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

      showStudentView(`
        <div class="content">
          <h2>⚙️ Settings</h2>
          <div class="tab-bar">
            <button class="tab-btn student-settings-tab${activeTab === "profile" ? " active" : ""}" data-tab="profile">👤 Profile</button>
            <button class="tab-btn student-settings-tab${activeTab === "password" ? " active" : ""}" data-tab="password">🔒 Password</button>
            <button class="tab-btn student-settings-tab${activeTab === "appearance" ? " active" : ""}" data-tab="appearance">🎨 Appearance</button>
          </div>
          <div id="student-settings-panel"></div>
        </div>
      `);
      document.querySelectorAll(".student-settings-tab").forEach(btn => {
        btn.addEventListener("click", () => renderTab(btn.dataset.tab));
      });
      renderTab(activeTab);
    } catch(e) { showStudentView('<div class="empty-state"><p>Error loading settings</p></div>'); }
  }

  // Load initial view from URL hash, fallback to dashboard
  const initialView = location.hash.slice(1) || "dashboard";
  if (navHandlers[initialView]) {
    navHandlers[initialView]();
  } else {
    loadStudentOverview();
  }
}
