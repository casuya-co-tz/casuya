  async function loadAdminPayments() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
    try {
      const transactions = await request("/payments/transactions").catch(() => []);
      const txList = Array.isArray(transactions) ? transactions : [];
      const totalRevenue = txList.filter(t => t.status === "completed").reduce((s, t) => s + (t.amount_tzs || 0), 0);
      const completedCount = txList.filter(t => t.status === "completed").length;
      const pendingCount = txList.filter(t => t.status === "pending").length;

      showAdminView(`
        <div class="content">
          <h2>Payments</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">AzamPay mobile money integration</p>

          <div class="stat-grid" style="margin-top:1rem">
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">💰</div>
              <div class="stat-value">${totalRevenue.toLocaleString()}</div>
              <div class="stat-label">Total Revenue (TZS)</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">✅</div>
              <div class="stat-value">${completedCount}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">⏳</div>
              <div class="stat-value">${pendingCount}</div>
              <div class="stat-label">Pending</div>
            </div>
          </div>

          <div class="card" style="padding:0;max-width:560px;margin-top:1rem;overflow:hidden">
              <div class="checkout-header">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <h3>Initiate Checkout</h3>
              </div>
              <form id="payment-form" class="checkout-body">
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
                    <label class="provider-card">
                      <input type="radio" name="provider" value="m-pesa" required>
                      <span class="provider-dot" style="background:#16a34a"></span>
                      <span>M-Pesa</span>
                    </label>
                    <label class="provider-card">
                      <input type="radio" name="provider" value="tigo-pesa">
                      <span class="provider-dot" style="background:#2563eb"></span>
                      <span>Tigo Pesa</span>
                    </label>
                    <label class="provider-card">
                      <input type="radio" name="provider" value="halopesa">
                      <span class="provider-dot" style="background:#d97706"></span>
                      <span>HaloPesa</span>
                    </label>
                    <label class="provider-card">
                      <input type="radio" name="provider" value="azampay">
                      <span class="provider-dot" style="background:#8b5cf6"></span>
                      <span>AzamPay</span>
                    </label>
                  </div>
                </div>
                <button class="btn btn-success btn-block" type="submit" id="payment-submit-btn">Initiate Payment</button>
              </form>
              <div id="payment-result" style="padding:0 1.5rem 1.5rem"></div>
            </div>

          <div class="card" style="padding:1.5rem;margin-top:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <h3>Transaction History</h3>
              <button class="btn btn-sm" id="refresh-tx-btn">Refresh</button>
            </div>
            ${txList.length === 0
              ? '<div class="empty-state" style="padding:2rem"><p>No transactions yet</p></div>'
              : `<div style="overflow-x:auto">
                  <table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem">
                    <thead>
                      <tr style="border-bottom:2px solid var(--color-border)">
                        <th style="padding:0.6rem;text-align:left;font-weight:600">Date</th>
                        <th style="padding:0.6rem;text-align:left;font-weight:600">Phone</th>
                        <th style="padding:0.6rem;text-align:left;font-weight:600">Provider</th>
                        <th style="padding:0.6rem;text-align:right;font-weight:600">Amount</th>
                        <th style="padding:0.6rem;text-align:center;font-weight:600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${txList.map(t => `
                        <tr style="border-bottom:1px solid var(--color-border)">
                          <td style="padding:0.6rem;color:var(--color-text-muted)">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "\u2014"}</td>
                          <td style="padding:0.6rem;font-weight:500">${escapeHtml(t.mobile_number || "\u2014")}</td>
                          <td style="padding:0.6rem">${escapeHtml(t.provider || "\u2014")}</td>
                          <td style="padding:0.6rem;text-align:right;font-weight:600">${(t.amount_tzs || 0).toLocaleString()} TZS</td>
                          <td style="padding:0.6rem;text-align:center"><span class="badge badge-${t.status || 'pending'}">${escapeHtml(t.status || "unknown")}</span></td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>`
            }
          </div>
        </div>
      `);

      let paymentInProgress = false;
      document.getElementById("payment-form")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const btn = document.getElementById("payment-submit-btn");
        if (paymentInProgress) return;
        paymentInProgress = true;
        btn.innerHTML = '<span class="btn-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg> Processing...</span>';
        btn.disabled = true;
        const fd = new FormData(ev.target);
        try {
          const data = await request("/payments/checkout", {
            method: "POST",
            body: JSON.stringify({
              mobile_number: fd.get("mobile_number"),
              amount_tzs: parseInt(fd.get("amount_tzs"), 10),
              provider: fd.get("provider"),
              idempotency_key: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            }),
          });
          if (data === null) return;
          document.getElementById("payment-result").innerHTML = `<div class="payment-result success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div><strong>Payment initiated!</strong><br><span style="opacity:0.8;font-size:0.8rem">${escapeHtml(data.external_transaction_id || data.id || "")}</span></div></div>`;
          loadAdminPayments();
        } catch (err) {
          document.getElementById("payment-result").innerHTML = `<div class="payment-result error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><div>${escapeHtml(err.message)}</div></div>`;
        }
        paymentInProgress = false;
        btn.innerHTML = 'Initiate Payment';
        btn.disabled = false;
      });

      document.getElementById("refresh-tx-btn")?.addEventListener("click", loadAdminPayments);
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
  }

  async function loadAdminNotifications() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading notifications...</p></div>');
    try {
      const [data, users] = await Promise.all([
        request("/notifications"),
        request("/users"),
      ]);
      const allNotifs = Array.isArray(data) ? data : [];
      const userList = Array.isArray(users) ? users : [];
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
            <input type="search" class="input" id="notif-search" placeholder="Search notifications..." style="max-width:240px;padding:0.35rem 0.6rem;font-size:0.85rem">
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

  async function loadAdminUploads() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading uploads...</p></div>');
    try {
      const files = await request("/uploads").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];
      const imageFiles = fileList.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.filename || f.path || ""));
      const docFiles = fileList.filter(f => /\.(pdf|doc|docx|txt)$/i.test(f.filename || f.path || ""));
      const mediaFiles = fileList.filter(f => /\.(mp4|webm|mp3|wav|ogg)$/i.test(f.filename || f.path || ""));
      let activeFilter = "all";

      function renderFiles() {
        let filtered = fileList;
        if (activeFilter === "images") filtered = imageFiles;
        else if (activeFilter === "documents") filtered = docFiles;
        else if (activeFilter === "media") filtered = mediaFiles;

        const grid = document.getElementById("uploads-grid");
        if (!grid) return;
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No files uploaded yet</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(f => {
          const name = f.filename || f.path || "unknown";
          const displayName = f.display_name || name;
          const isVisible = f.is_visible !== false;
          const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);
          const isVideo = /\.(mp4|webm)$/i.test(name);
          const isAudio = /\.(mp3|wav|ogg)$/i.test(name);
          const icon = isImage ? "🖼️" : isVideo ? "🎬" : isAudio ? "🎵" : "📄";
          return `
            <div class="card upload-card" style="padding:0.75rem;cursor:pointer" data-filename="${escapeHtml(name)}">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="upload-display-name">${escapeHtml(displayName)}</p>
                  <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${f.size ? (f.size / 1024).toFixed(1) + " KB" : ""} · ${f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ""}</p>
                  ${!isVisible ? '<span style="display:inline-block;margin-top:0.25rem;font-size:0.65rem;padding:0.1rem 0.4rem;background:#fee2e2;color:#dc2626;border-radius:4px">Hidden</span>' : ""}
                </div>
                <div style="display:flex;flex-direction:column;gap:0.25rem;flex-shrink:0">
                   <button class="btn btn-xs upload-rename-btn" data-filename="${escapeHtml(name)}" data-display="${escapeHtml(displayName)}" title="Rename">✏️</button>
                   <button class="btn btn-xs upload-vis-btn" data-filename="${escapeHtml(name)}" data-visible="${isVisible}" title="${isVisible ? 'Hide from students & teachers' : 'Show to students & teachers'}">${isVisible ? "👁️" : "🚫"}</button>
                   <button class="btn btn-outline-danger btn-xs upload-delete-btn" data-filename="${escapeHtml(name)}" title="Delete file">✕</button>
                </div>
              </div>
            </div>
          `;
        }).join("");

        document.querySelectorAll(".upload-rename-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const oldName = btn.dataset.display;
            const newName = prompt("Rename file:", oldName);
            if (newName && newName !== oldName) {
              try {
                await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, {
                  method: "PATCH",
                  body: JSON.stringify({ display_name: newName }),
                });
                showToast("File renamed");
                loadAdminUploads();
              } catch(err) { showToast(err.message || "Rename failed"); }
            }
          });
        });

        document.querySelectorAll(".upload-vis-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const currentVisible = btn.dataset.visible === "true";
            try {
              await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, {
                method: "PATCH",
                body: JSON.stringify({ is_visible: !currentVisible }),
              });
              showToast(currentVisible ? "File hidden from students & teachers" : "File now visible to students & teachers");
              loadAdminUploads();
            } catch(err) { showToast(err.message || "Update failed"); }
          });
        });

        document.querySelectorAll(".upload-delete-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirmDelete(btn.dataset.filename)) return;
            try {
              await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, { method: "DELETE" });
              showToast("File deleted");
              loadAdminUploads();
            } catch(err) { showToast(err.message || "Delete failed"); }
          });
        });
        document.querySelectorAll("#uploads-grid .card[data-filename]").forEach(card => {
          if (card.querySelector(".upload-delete-btn")) {
            card.addEventListener("click", (e) => {
              if (e.target.closest(".upload-delete-btn") || e.target.closest(".upload-rename-btn") || e.target.closest(".upload-vis-btn")) return;
              window.open(`${API_BASE}/uploads/${encodeURIComponent(card.dataset.filename)}`, "_blank");
            });
          }
        });
      }

      showAdminView(`
        <div class="content">
          <h2>📁 Uploads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Manage uploaded files. Control visibility for students and teachers.</p>

          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">📤 Upload New File</h3>
            <form id="upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <p style="font-size:0.8rem;color:var(--color-text-muted);margin:0">Supports images (png, jpg, gif, svg, webp), documents (pdf, doc), videos (mp4, webm), audio (mp3, wav, ogg)</p>
              <input class="input" type="file" id="upload-file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" required>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <button class="btn btn-success btn-pattern" type="submit" id="upload-submit-btn" style="width:100%">📤 Upload File</button>
              </div>
            </form>
            <div id="upload-result" style="margin-top:0.5rem"></div>
          </div>

          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn-filter upload-filter-btn active" data-filter="all">All <span class="filter-count">${fileList.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="images">🖼️ Images <span class="filter-count">${imageFiles.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="documents">📄 Documents <span class="filter-count">${docFiles.length}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="media">🎬 Media <span class="filter-count">${mediaFiles.length}</span></button>
          </div>
          <div id="uploads-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.5rem"></div>
        </div>
      `);

      document.querySelectorAll(".upload-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".upload-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderFiles();
        });
      });

      let uploading = false;
      document.getElementById("upload-form")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fileInput = document.getElementById("upload-file");
        const file = fileInput?.files?.[0];
        if (!file || uploading) return;
        const btn = document.getElementById("upload-submit-btn");
        uploading = true;
        btn.textContent = "Uploading..."; btn.disabled = true; btn.style.opacity = "0.7";
        const token = localStorage.getItem("casuya_token");
        const formData = new FormData();
        formData.append("file", file);
        try {
          const resp = await fetch(`${API_BASE}/uploads/`, {
            method: "POST",
            headers: token ? { "Authorization": `Bearer ${token}` } : {},
            body: formData,
          });
          const data = await resp.json();
          if (resp.ok) {
            document.getElementById("upload-result").innerHTML = `<div style="padding:0.5rem;background:#dcfce7;border-radius:var(--radius);font-size:0.85rem;color:var(--color-success)">Uploaded: ${escapeHtml(data.filename || file.name)}</div>`;
            loadAdminUploads();
          } else {
            document.getElementById("upload-result").innerHTML = `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.85rem;color:var(--color-danger)">${escapeHtml(data.detail || "Upload failed")}</div>`;
          }
        } catch (err) {
          document.getElementById("upload-result").innerHTML = `<div style="padding:0.5rem;background:#fee2e2;border-radius:var(--radius);font-size:0.85rem;color:var(--color-danger)">${escapeHtml(err.message)}</div>`;
        }
        uploading = false;
        btn.textContent = "Upload File"; btn.disabled = false; btn.style.opacity = "1";
      });

      renderFiles();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading uploads</p></div>'); }
  }

