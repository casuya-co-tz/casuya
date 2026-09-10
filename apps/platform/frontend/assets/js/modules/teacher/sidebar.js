// modules/teacher/sidebar.js — sidebar setup, search, notifications bell, profile

function setupSidebar(dashboard) {
  const { signal } = dashboard._abort;

  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.getElementById("teacher-sidebar").classList.toggle("open");
  }, { signal });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#teacher-sidebar") && !e.target.closest("#sidebar-toggle")) {
      document.getElementById("teacher-sidebar")?.classList.remove("open");
    }
  }, { signal });

  const teacherSearchInput = document.getElementById("teacher-search");
  const teacherSearchResults = document.getElementById("teacher-search-results");
  let searchTimer;

  teacherSearchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = teacherSearchInput.value.trim();
    if (q.length < 2) { teacherSearchResults.style.display = "none"; return; }
    searchTimer = setTimeout(async () => {
      try {
        const results = await request(`/search/?q=${encodeURIComponent(q)}`);
        if (!Array.isArray(results) || results.length === 0) {
          teacherSearchResults.innerHTML = '<div style="padding:0.5rem;color:var(--color-text-muted)">No results</div>';
        } else {
          teacherSearchResults.innerHTML = results.map(r => `
            <div class="teacher-search-item" data-id="${escapeHtml(r.id)}" data-type="${escapeHtml(r.type)}" style="padding:0.5rem;cursor:pointer;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between">
              <span>${escapeHtml(r.title)}</span>
              <span style="color:var(--color-text-muted);font-size:0.8rem">${escapeHtml(r.type)}</span>
            </div>
          `).join("");
          teacherSearchResults.querySelectorAll(".teacher-search-item").forEach(el => {
            el.addEventListener("click", () => {
              teacherSearchResults.style.display = "none";
              teacherSearchInput.value = "";
              const type = el.dataset.type;
              const id = el.dataset.id;
              if (type === "lesson") {
                viewLessonContent("#teacher-content", id, () => loadLessons(dashboard));
              } else if (type === "student") {
                viewStudent(dashboard, id, el.querySelector("span")?.textContent || "Student");
              } else {
                dashboard.showViewByName("overview");
              }
            });
          });
        }
        teacherSearchResults.style.display = "block";
      } catch(e) { teacherSearchResults.style.display = "none"; }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#teacher-search") && !e.target.closest("#teacher-search-results")) teacherSearchResults.style.display = "none";
  }, { signal });

  const notifBell = document.getElementById("notif-bell");
  const notifDropdown = document.getElementById("notif-dropdown");
  const notifBadge = document.getElementById("notif-badge");

  async function loadNotifs() {
    try {
      dashboard.notifData = await request("/notifications");
      const unread = dashboard.notifData.filter(n => !n.is_read).length;
      if (unread > 0) { notifBadge.textContent = unread; notifBadge.style.display = "inline"; }
      else notifBadge.style.display = "none";
    } catch(e) {}
  }

  notifBell.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (notifDropdown.style.display === "block") { notifDropdown.style.display = "none"; return; }
    await loadNotifs();
    if (dashboard.notifData.length === 0) {
      notifDropdown.innerHTML = '<div style="padding:0.75rem;color:var(--color-text-muted)">No notifications</div>';
    } else {
      notifDropdown.innerHTML = dashboard.notifData.map(n => `
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
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#notif-bell") && !e.target.closest("#notif-dropdown")) notifDropdown.style.display = "none";
  }, { signal });

  document.getElementById("profile-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("profile-dropdown");
    dd.style.display = dd.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", (e) => {
    const pd = document.getElementById("profile-dropdown");
    if (pd && !e.target.closest("#profile-btn") && !e.target.closest("#profile-dropdown")) pd.style.display = "none";
  }, { signal });

  document.getElementById("prof-logout").addEventListener("click", handleLogout);
  document.getElementById("prof-edit").addEventListener("click", () => {
    document.getElementById("profile-dropdown").style.display = "none";
    showProfileEditor(dashboard);
  });

  document.querySelectorAll("#teacher-nav .sidebar-nav-item").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("teacher-sidebar")?.classList.remove("open");
      dashboard.showViewByName(el.dataset.view);
    });
  });

  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1) || "overview";
    if (dashboard._viewLoaders[view]) dashboard._viewLoaders[view]();
  });

  (async function applyModuleVisibility() {
    try {
      var vis = await request("/settings/modules/my");
      if (!vis || typeof vis !== "object") return;
      var items = document.querySelectorAll("#teacher-nav .sidebar-nav-item");
      var firstEnabled = null;
      items.forEach(function(el) {
        var view = el.getAttribute("data-view");
        if (vis[view] === false) {
          el.style.display = "none";
        } else if (!firstEnabled) {
          firstEnabled = view;
        }
      });
      var currentHash = location.hash.slice(1) || "overview";
      if (vis[currentHash] === false && firstEnabled) {
        dashboard.showViewByName(firstEnabled);
      }
    } catch(e) {}
  })();

  loadNotifs();
}
