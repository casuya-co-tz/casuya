  async function loadAdminNotifications() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const [data, users] = await Promise.all([
        request("/notifications"),
        request("/users"),
      ]);
      const allNotifs = Array.isArray(data) ? data : [];
      const userList = Array.isArray(users?.items) ? users.items : [];
      let currentFilter = "all";
      let searchQuery = "";
      const PAGE_SIZE = 15;
      let currentPage = 1;

      function getFiltered() {
        let list = allNotifs;
        if (currentFilter === "unread") list = list.filter(n => !n.is_read);
        else if (currentFilter === "read") list = list.filter(n => n.is_read);
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          list = list.filter(n => (n.message || "").toLowerCase().includes(q));
        }
        return list;
      }

      function renderNotifHistory() {
        const filtered = getFiltered();
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const page = filtered.slice(start, start + PAGE_SIZE);
        const unreadCount = allNotifs.filter(n => !n.is_read).length;

        document.getElementById("notif-stats").innerHTML = `
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <span style="font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:var(--radius);background:var(--color-bg);border:1px solid var(--color-border)">Total: ${allNotifs.length}</span>
            <span style="font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:var(--radius);background:#fef3c7;border:1px solid #fde68a">Unread: ${unreadCount}</span>
            <span style="font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:var(--radius);background:var(--color-bg);border:1px solid var(--color-border)">Showing: ${filtered.length}</span>
          </div>
        `;

        const notifList = document.getElementById("notif-list");
        if (page.length === 0) {
          notifList.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No notifications match your filter</p></div>';
        } else {
          notifList.innerHTML = page.map(n => `
            <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.5rem;${n.is_read ? "opacity:0.7" : "border-left:3px solid var(--color-primary)"}">
              <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem">
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.875rem;${n.is_read ? "" : "font-weight:600"}">${escapeHtml(n.message)}</p>
                  <p style="margin:0.25rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">${n.created_at ? new Date(n.created_at).toLocaleString() : ""} · ${n.is_read ? "Read" : "Unread"}</p>
                </div>
                <div style="display:flex;gap:0.25rem;flex-shrink:0">
                  ${!n.is_read ? `<button class="btn btn-primary btn-xs notif-mark-read" data-id="${n.id}">✓ Read</button>` : ""}
                </div>
              </div>
            </div>
          `).join("");
        }

        const pag = document.getElementById("notif-pagination");
        if (totalPages <= 1) { pag.innerHTML = ""; return; }
        pag.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin-top:1rem">
            <button class="btn btn-ghost btn-sm notif-page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>← Prev</button>
            <span style="font-size:0.85rem;color:var(--color-text-muted)">Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-ghost btn-sm notif-page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>Next →</button>
          </div>
        `;
        document.querySelectorAll(".notif-page-btn").forEach(btn => {
          btn.addEventListener("click", () => { currentPage = parseInt(btn.dataset.page); renderNotifHistory(); });
        });
        document.querySelectorAll(".notif-mark-read").forEach(btn => {
          btn.addEventListener("click", async () => {
            await request(`/notifications/${btn.dataset.id}/read`, { method: "POST" });
            const n = allNotifs.find(x => x.id === btn.dataset.id);
            if (n) n.is_read = true;
            renderNotifHistory();
          });
        });
      }

      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
            <h2>🔔 Notifications</h2>
            <button class="btn btn-primary btn-pattern" id="notif-send-btn">✉️ Send Notification</button>
          </div>
          <div class="card" style="margin-top:1rem;display:none" id="notif-send-form-area">
            <h3 style="margin-bottom:0.75rem">Send Notification</h3>
            <form id="send-notif-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <label style="font-size:0.85rem;font-weight:500">Recipient</label>
              <select class="input" name="recipient_type" id="notif-recipient-type" required>
                <option value="role_student">All Students</option>
                <option value="role_teacher">All Teachers</option>
                <option value="specific">Specific User...</option>
              </select>
              <div id="notif-specific-user" style="display:none">
                <select class="input" name="user_id" id="notif-user-select">
                  <option value="">Select user...</option>
                  ${userList.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.email)} (${escapeHtml(u.role)})</option>`).join("")}
                </select>
              </div>
              <label style="font-size:0.85rem;font-weight:500">Message</label>
              <textarea class="input" name="message" rows="3" placeholder="Write your notification message..." required></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <button class="btn btn-success btn-pattern" type="submit">📤 Send Notification</button>
                <button class="btn btn-ghost" type="button" id="notif-cancel-send">Cancel</button>
                <p id="notif-send-status" style="font-size:0.85rem;display:none;margin:0"></p>
              </div>
            </form>
          </div>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter notif-filter-btn active" data-filter="all">All</button>
            <button class="btn-filter notif-filter-btn" data-filter="unread">🔴 Unread</button>
            <button class="btn-filter notif-filter-btn" data-filter="read">✅ Read</button>
            <input type="search" class="input" id="notif-search" placeholder="Search..." style="flex:1;min-width:120px;padding:0.35rem 0.6rem;font-size:0.85rem">
            <button class="btn btn-ghost btn-sm" id="notif-mark-all" style="margin-left:auto">✓ Mark All Read</button>
          </div>
          <div id="notif-stats" style="margin-top:0.75rem"></div>
          <div style="margin-top:0.5rem" id="notif-list"></div>
          <div id="notif-pagination"></div>
        </div>
      `);

      document.getElementById("notif-send-btn")?.addEventListener("click", () => {
        const area = document.getElementById("notif-send-form-area");
        area.style.display = area.style.display === "none" ? "block" : "none";
      });
      document.getElementById("notif-cancel-send")?.addEventListener("click", () => {
        document.getElementById("notif-send-form-area").style.display = "none";
      });
      document.getElementById("notif-recipient-type")?.addEventListener("change", (e) => {
        document.getElementById("notif-specific-user").style.display = e.target.value === "specific" ? "block" : "none";
      });
      document.getElementById("send-notif-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const type = fd.get("recipient_type");
        const message = fd.get("message");
        const statusEl = document.getElementById("notif-send-status");
        try {
          let body = { message };
          if (type === "role_student") body.role = "student";
          else if (type === "role_teacher") body.role = "teacher";
          else body.user_id = fd.get("user_id");
          if (!body.role && !body.user_id) {
            statusEl.textContent = "Please select a user"; statusEl.style.color = "var(--color-danger)"; statusEl.style.display = "inline";
            return;
          }
          const result = await request("/notifications", { method: "POST", body: JSON.stringify(body) });
          statusEl.textContent = `Sent to ${result.sent} user(s)`; statusEl.style.color = "var(--color-success)"; statusEl.style.display = "inline";
          e.target.reset();
          document.getElementById("notif-specific-user").style.display = "none";
          loadAdminNotifications();
        } catch(err) {
          statusEl.textContent = "Error: " + err.message; statusEl.style.color = "var(--color-danger)"; statusEl.style.display = "inline";
        }
      });

      document.querySelectorAll(".notif-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentFilter = btn.dataset.filter; currentPage = 1;
          document.querySelectorAll(".notif-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === currentFilter));
          renderNotifHistory();
        });
      });
      document.getElementById("notif-search")?.addEventListener("input", (e) => {
        searchQuery = e.target.value; currentPage = 1; renderNotifHistory();
      });
      document.getElementById("notif-mark-all")?.addEventListener("click", async () => {
        const unread = allNotifs.filter(n => !n.is_read);
        if (unread.length === 0) return;
        for (const n of unread) {
          try { await request(`/notifications/${n.id}/read`, { method: "POST" }); n.is_read = true; } catch(e) {}
        }
        renderNotifHistory();
      });

      renderNotifHistory();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading notifications</p></div>'); }
  }
