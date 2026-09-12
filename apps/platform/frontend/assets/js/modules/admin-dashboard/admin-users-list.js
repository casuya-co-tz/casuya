const _adminRoleLabels = { student: "Student", teacher: "Teacher", admin: "Admin", pending: "Pending", special_needs: "Student (Special Needs)" };

  async function _fetchAllUsers() {
    const items = [];
    const pageSize = 200;
    const page = await request(`/users?offset=0&limit=${pageSize}`);
    if (!page || !Array.isArray(page.items)) {
      throw new Error("invalid_response");
    }
    items.push(...page.items);
    let offset = page.items.length;
    const total = page.total ?? offset;
    while (offset < total) {
      const next = await request(`/users?offset=${offset}&limit=${pageSize}`);
      if (!next || !Array.isArray(next.items)) break;
      items.push(...next.items);
      offset += next.items.length;
    }
    return items;
  }

  async function loadAdminUsers() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>');
    try {
      const items = await _fetchAllUsers();
      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
            <h2>Users (${items.length})</h2>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn btn-primary" id="register-user-btn">+ Register User</button>
              <button class="btn btn-outline-primary" id="export-users-btn">⬇️ Download XLSX</button>
            </div>
          </div>
          <div id="user-form-area"></div>
          <div id="users-msg" style="font-size:0.85rem;margin-top:0.5rem;min-height:1.2em"></div>

          ${items.length === 0
            ? '<div class="empty-state" style="padding:2rem"><p>No users registered yet</p></div>'
            : `<div style="overflow-x:auto">
                <table class="tx-table" style="width:100%;border-collapse:collapse;font-size:0.85rem">
                  <thead>
                    <tr style="border-bottom:2px solid var(--color-border)">
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Name</th>
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Role</th>
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Email</th>
                      <th style="padding:0.6rem;text-align:left;font-weight:600">Phone</th>
                      <th style="padding:0.6rem;text-align:center;font-weight:600">Status</th>
                      <th style="padding:0.6rem;text-align:center;font-weight:600">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(u => {
                      const name = escapeHtml(u.full_name || "Unnamed");
                      const profileLink = u.profile && u.profile.id
                        ? `<a href="#" class="user-view-link" data-id="${escapeHtml(u.profile.id)}" data-type="${escapeHtml(u.profile.type)}" data-name="${escapeHtml(u.full_name || "")}" style="color:var(--color-primary);text-decoration:none;font-weight:600">${name}</a>`
                        : name;
                      const extra = u.profile && u.profile.type === "student" && u.profile.form_level
                        ? ' <span style="color:var(--color-text-muted)">· ' + escapeHtml(u.profile.form_level) + '</span>'
                        : "";
                      return `
                        <tr class="user-row" data-user-id="${escapeHtml(u.id)}" style="border-bottom:1px solid var(--color-border)">
                          <td style="padding:0.6rem">${profileLink}${extra}</td>
                          <td style="padding:0.6rem">${escapeHtml(_adminRoleLabels[u.role] || u.role || "—")}</td>
                          <td style="padding:0.6rem">${escapeHtml(u.email || "—")}</td>
                          <td style="padding:0.6rem">${escapeHtml(u.phone || "—")}</td>
                          <td class="user-status-cell" style="padding:0.6rem;text-align:center">
                            <span class="badge ${u.is_active ? "badge-completed" : "badge-failed"}">${u.is_active ? "Active" : "Inactive"}</span>
                          </td>
                          <td style="padding:0.6rem;text-align:center">
                            <label style="display:inline-flex;align-items:center;cursor:pointer" title="${u.is_active ? "Click to deactivate" : "Click to activate"}">
                              <input type="checkbox" class="user-status-toggle" data-id="${escapeHtml(u.id)}" ${u.is_active ? "checked" : ""} style="width:17px;height:17px;accent-color:var(--color-primary)">
                            </label>
                          </td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>`}
        </div>
      `);

      const msgEl = document.getElementById("users-msg");

      document.querySelectorAll(".user-view-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          viewAdminUser(link.dataset.id, link.dataset.type, link.dataset.name);
        });
      });

      document.querySelectorAll(".user-status-toggle").forEach(cb => {
        cb.addEventListener("change", async () => {
          const userId = cb.dataset.id;
          const row = cb.closest(".user-row");
          try {
            await request(`/users/${encodeURIComponent(userId)}`, {
              method: "PATCH",
              body: JSON.stringify({ is_active: cb.checked }),
            });
            if (row) {
              const badge = row.querySelector(".user-status-cell .badge");
              if (badge) {
                badge.className = "badge " + (cb.checked ? "badge-completed" : "badge-failed");
                badge.textContent = cb.checked ? "Active" : "Inactive";
              }
              row.querySelector('label[title]')?.setAttribute("title", cb.checked ? "Click to deactivate" : "Click to activate");
            }
            if (msgEl) {
              msgEl.innerHTML = `<span style="color:var(--color-success)">${cb.checked ? "User activated" : "User deactivated"}</span>`;
              setTimeout(() => { msgEl.innerHTML = ""; }, 3000);
            }
          } catch (err) {
            cb.checked = !cb.checked;
            if (msgEl) msgEl.innerHTML = `<span style="color:var(--color-danger)">Could not update user: ${escapeHtml(err.message)}</span>`;
          }
        });
      });

      document.getElementById("export-users-btn")?.addEventListener("click", async () => {
        const btn = document.getElementById("export-users-btn");
        const original = btn.innerHTML;
        try {
          btn.disabled = true;
          btn.textContent = "Preparing…";
          const token = localStorage.getItem("casuya_token");
          const res = await fetch(API_BASE + "/users/export", {
            headers: token ? { "Authorization": "Bearer " + token } : {},
          });
          if (!res.ok) {
            let detail = res.statusText || "Request failed";
            try { const body = await res.json(); if (body && body.detail) detail = body.detail; } catch (e) {}
            throw new Error(detail);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "casuya-users.xlsx";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          if (msgEl) msgEl.innerHTML = '<span style="color:var(--color-success)">Users exported to casuya-users.xlsx</span>';
        } catch (err) {
          if (msgEl) msgEl.innerHTML = `<span style="color:var(--color-danger)">Export failed: ${escapeHtml(err.message)}</span>`;
        } finally {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });

      document.getElementById("register-user-btn")?.addEventListener("click", () => {
        document.getElementById("user-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Register New User</h3>
            <form id="register-user-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Full Name</label>
                <input class="input" name="full_name" placeholder="John Doe" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Email</label>
                <input class="input" type="email" name="email" placeholder="john@example.com" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Password</label>
                <input class="input" type="password" name="password" placeholder="Min 6 characters" required minlength="6">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Phone</label>
                <input class="input" name="phone" placeholder="+255...">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Role</label>
                <select class="input" name="role" required>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Form Level (Students)</label>
                <select class="input" name="form_level">
                  <option value="">N/A</option>
                  <option value="Form I">Form I</option>
                  <option value="Form II">Form II</option>
                  <option value="Form III">Form III</option>
                  <option value="Form IV">Form IV</option>
                  <option value="Form V">Form V</option>
                  <option value="Form VI">Form VI</option>
                </select>
              </div>
              <div style="grid-column:1/-1;display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit">Register</button>
                <button class="btn" type="button" id="cancel-register">Cancel</button>
              </div>
            </form>
            <div id="register-user-result" style="margin-top:0.75rem;font-size:0.85rem"></div>
          </div>
        `;
        document.getElementById("cancel-register").addEventListener("click", () => document.getElementById("user-form-area").innerHTML = "");
        document.getElementById("register-user-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                full_name: fd.get("full_name"),
                email: fd.get("email"),
                password: fd.get("password"),
                phone: fd.get("phone") || null,
                role: fd.get("role"),
                form_level: fd.get("form_level") || null,
              }),
            });
            document.getElementById("register-user-result").innerHTML = '<span style="color:var(--color-success)">User registered!</span>';
            setTimeout(() => loadAdminUsers(), 1000);
          } catch(err) {
            document.getElementById("register-user-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(err.message)}</span>`;
          }
        });
      });
    } catch(e) {
      if (e.message === "invalid_response") {
        showAdminView('<div class="content"><h2>Users</h2><div class="empty-state"><p>Unable to load users. Your session may have expired. <a href="#" id="reload-link">Click here to reload</a>.</p></div></div>');
        document.getElementById("reload-link")?.addEventListener("click", (ev) => { ev.preventDefault(); loadAdminUsers(); });
      } else {
        showAdminView('<div class="empty-state"><p>Error loading users</p></div>');
      }
    }
  }