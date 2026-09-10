// modules/teacher/notifications.js — notifications management view

async function loadNotifications(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
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
      const el = document.getElementById("teacher-notif-list");
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
            ${!n.is_read ? `<button class="btn btn-primary btn-xs teacher-notif-read" data-id="${n.id}">✓ Read</button>` : ""}
          </div>
        </div>
      `).join("");
      document.querySelectorAll(".teacher-notif-read").forEach(btn => {
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

    dashboard.showView(`
      <div class="content">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2>🔔 Notifications</h2>
          <button class="btn btn-ghost btn-sm" id="teacher-mark-all-read">✓ Mark All Read</button>
        </div>
        <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
          <button class="btn-filter teacher-notif-filter active" data-filter="all">All <span class="filter-count">${allNotifs.length}</span></button>
          <button class="btn-filter teacher-notif-filter" data-filter="unread">🔴 Unread <span class="filter-count">${unread.length}</span></button>
          <button class="btn-filter teacher-notif-filter" data-filter="read">✅ Read <span class="filter-count">${read.length}</span></button>
        </div>
        <div id="teacher-notif-list" style="margin-top:0.75rem"></div>
      </div>
    `);
    document.querySelectorAll(".teacher-notif-filter").forEach(btn => {
      btn.addEventListener("click", () => {
        showFilter = btn.dataset.filter;
        document.querySelectorAll(".teacher-notif-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === showFilter));
        render();
      });
    });
    document.getElementById("teacher-mark-all-read")?.addEventListener("click", async () => {
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
  } catch(e) { dashboard.showView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
}
