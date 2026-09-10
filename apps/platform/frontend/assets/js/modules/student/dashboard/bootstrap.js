// modules/student/dashboard/bootstrap.js — StudentDashboard startup/lifecycle helpers.
// Extends StudentDashboard.prototype with init + feature setups.

Object.assign(StudentDashboard.prototype, {
  // ── Bootstrap ───────────────────────────────────────────────────────
  async init() {
    this._applyA11yPrefs();
    this._renderShell();
    this._injectSidebarStyles();
    this._setupSidebarToggle();
    this._setupFormFilter();
    this._setupSearch();
    this._setupNotifications();
    this._setupProfileDropdown();
    this._setupNavigation();
    this._applyModuleVisibility();
    this._setupHashListener();
    this._loadInitialView();
  },

  // ── Accessibility preferences ───────────────────────────────────────
  _applyA11yPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem("casuya_accessibility_prefs") || "null");
      if (prefs) {
        if (prefs.pref_dyslexia) document.body.classList.add("dyslexia-mode");
        if (prefs.pref_high_contrast) document.body.classList.add("high-contrast");
        if (prefs.pref_larger_text) document.body.style.fontSize = "1.15em";
        if (prefs.pref_tts) document.body.setAttribute("data-tts-enabled", "true");
      }
    } catch (e) {}
  },

  // ── Form filter (persisted) ─────────────────────────────────────────
  _setupFormFilter() {
    const formFilterEl = document.getElementById("form-filter");
    const savedFormFilter = localStorage.getItem("casuya_form_filter") || "";
    if (this.payload.form_level && !savedFormFilter) {
      localStorage.setItem("casuya_form_filter", this.payload.form_level);
      formFilterEl.value = this.payload.form_level;
    } else if (savedFormFilter) {
      formFilterEl.value = savedFormFilter;
    }
    formFilterEl.addEventListener("change", (e) => {
      localStorage.setItem("casuya_form_filter", e.target.value);
      this.callView("subjects");
    });
  },

  // ── Search functionality ────────────────────────────────────────────
  _setupSearch() {
    const searchInput = document.getElementById("student-search");
    const searchResults = document.getElementById("student-search-results");
    let searchTimer;
    let searchSeq = 0;
    const self = this;

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (q.length < 2) { searchResults.style.display = "none"; return; }
      const mySeq = ++searchSeq;
      searchTimer = setTimeout(async () => {
        try {
          const results = await request(`/search/?q=${encodeURIComponent(q)}`);
          if (mySeq !== searchSeq) return;
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
                if (el.dataset.type === "lesson") self.callView("lesson", el.dataset.id);
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
  },

  // ── Notifications bell ──────────────────────────────────────────────
  _setupNotifications() {
    const self = this;
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
  },

  // ── Module visibility (admin-controlled) ────────────────────────────
  async _applyModuleVisibility() {
    try {
      const vis = await request("/settings/modules/my");
      if (!vis || typeof vis !== "object") return;
      const items = document.querySelectorAll("#student-nav .sidebar-nav-item");
      let firstEnabled = null;
      items.forEach(el => {
        const view = el.getAttribute("data-view");
        if (vis[view] === false) {
          el.style.display = "none";
        } else if (!firstEnabled) {
          firstEnabled = view;
        }
      });
      const currentHash = location.hash.slice(1) || "dashboard";
      if (vis[currentHash] === false && firstEnabled) {
        this.navigateTo(firstEnabled);
      }
    } catch(e) {}
  },

  // ── Hash change listener ────────────────────────────────────────────
  _setupHashListener() {
    const self = this;
    window.addEventListener("hashchange", () => {
      const view = location.hash.slice(1) || "dashboard";
      if (self._views[view]) self._views[view]();
    });
  },

  // ── Load initial view from URL hash ─────────────────────────────────
  _loadInitialView() {
    const initialView = location.hash.slice(1) || "dashboard";
    if (this._views[initialView]) {
      this._views[initialView]();
    } else {
      this.callView("dashboard");
    }
  },
});