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

          <div class="card" style="padding:1.5rem;margin-top:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <h3>Payment Plans</h3>
              <button class="btn btn-sm btn-primary" id="admin-add-plan-btn">+ New Plan</button>
            </div>
            <div id="admin-plan-form-wrap" style="display:none;margin-bottom:1rem">
              <form id="admin-plan-form" class="checkout-body">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                  <div style="flex:1;min-width:0"><label class="field-label">Name</label><input class="input" name="name" required></div>
                  <div style="flex:1;min-width:0"><label class="field-label">Description</label><input class="input" name="description"></div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
                  <div style="min-width:0"><label class="field-label">Amount (TZS)</label><input class="input" name="amount_tzs" type="number" min="100" required></div>
                  <div style="min-width:0"><label class="field-label">Audience</label><select class="input" name="audience"><option value="both">Both</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>
                  <div style="min-width:0"><label class="field-label">Active</label><select class="input" name="is_active"><option value="true">Yes</option><option value="false">No</option></select></div>
                </div>
                <div style="margin-top:0.75rem">
                  <button class="btn btn-success" type="submit" id="admin-plan-submit">Save Plan</button>
                  <button class="btn btn-ghost" type="button" id="admin-plan-cancel">Cancel</button>
                </div>
              </form>
              <div id="admin-plan-result" style="margin-top:0.5rem"></div>
            </div>
            <div id="admin-plans-list"><div class="loading-state"><div class="spinner"></div></div></div>
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
                         <th style="padding:0.6rem;text-align:left;font-weight:600">Plan</th>
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
                           <td style="padding:0.6rem">${escapeHtml(t.plan_name || "\u2014")}</td>
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

      // ── Payment Plans management ───────────────────────────────────────
      let _adminEditingPlanId = null;
      const planFormWrap = document.getElementById("admin-plan-form-wrap");
      const planForm = document.getElementById("admin-plan-form");

      document.getElementById("admin-add-plan-btn")?.addEventListener("click", () => {
        _adminEditingPlanId = null;
        planForm.reset();
        planFormWrap.style.display = planFormWrap.style.display === "none" ? "block" : "block";
        document.getElementById("admin-plan-result").innerHTML = "";
      });
      document.getElementById("admin-plan-cancel")?.addEventListener("click", () => {
        planFormWrap.style.display = "none";
        _adminEditingPlanId = null;
      });

      planForm?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const btn = document.getElementById("admin-plan-submit");
        const resultEl = document.getElementById("admin-plan-result");
        const fd = new FormData(ev.target);
        const payload = {
          name: fd.get("name"),
          description: fd.get("description") || null,
          amount_tzs: parseFloat(fd.get("amount_tzs")),
          audience: fd.get("audience"),
          is_active: fd.get("is_active") === "true",
        };
        btn.disabled = true; btn.textContent = "Saving...";
        try {
          if (_adminEditingPlanId) {
            await request(`/payments/plans/${_adminEditingPlanId}`, { method: "PUT", body: JSON.stringify(payload) });
          } else {
            await request("/payments/plans", { method: "POST", body: JSON.stringify(payload) });
          }
          resultEl.innerHTML = '<div class="payment-result success">Plan saved.</div>';
          planFormWrap.style.display = "none";
          _adminEditingPlanId = null;
          loadAdminPlans();
        } catch (err) {
          resultEl.innerHTML = `<div class="payment-result error">${escapeHtml(err.message)}</div>`;
        } finally {
          btn.disabled = false; btn.textContent = "Save Plan";
        }
      });

      async function loadAdminPlans() {
        const el = document.getElementById("admin-plans-list");
        if (!el) return;
        try {
          const plans = await request("/payments/plans/all").catch(() => []);
          if (!Array.isArray(plans) || plans.length === 0) {
            el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>No plans created yet.</p></div>';
            return;
          }
          el.innerHTML = plans.map(p => `
            <div class="plan-card" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:1rem;margin-top:0.75rem;display:flex;justify-content:space-between;align-items:center;gap:0.5rem">
              <div>
                <div style="font-weight:600">${escapeHtml(p.name)} ${p.is_active ? '' : '<span class="badge badge-pending">inactive</span>'}</div>
                <div style="font-size:0.8rem;color:var(--color-text-muted)">${escapeHtml(p.description || "")}</div>
                <div style="font-weight:700;margin-top:0.25rem">${Number(p.amount_tzs).toLocaleString()} ${escapeHtml(p.currency || "TZS")} · <span style="text-transform:capitalize">${escapeHtml(p.audience)}</span></div>
              </div>
              <div style="display:flex;gap:0.4rem">
                <button class="btn btn-sm admin-edit-plan" data-id="${p.id}">Edit</button>
                <button class="btn btn-sm btn-danger admin-delete-plan" data-id="${p.id}">Delete</button>
              </div>
            </div>
          `).join("");
          document.querySelectorAll(".admin-edit-plan").forEach(b => b.addEventListener("click", () => {
            const id = b.getAttribute("data-id");
            const plan = plans.find(x => x.id === id);
            if (!plan) return;
            _adminEditingPlanId = id;
            planForm.name.value = plan.name;
            planForm.description.value = plan.description || "";
            planForm.amount_tzs.value = plan.amount_tzs;
            planForm.audience.value = plan.audience;
            planForm.is_active.value = String(plan.is_active);
            planFormWrap.style.display = "block";
            document.getElementById("admin-plan-result").innerHTML = "";
            planForm.scrollIntoView({ behavior: "smooth" });
          }));
          document.querySelectorAll(".admin-delete-plan").forEach(b => b.addEventListener("click", async () => {
            if (!confirm("Delete this plan?")) return;
            try {
              await request(`/payments/plans/${b.getAttribute("data-id")}`, { method: "DELETE" });
              loadAdminPlans();
            } catch (err) {
              alert(escapeHtml(err.message));
            }
          }));
        } catch (e) {
          el.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>Could not load plans.</p></div>';
        }
      }
      loadAdminPlans();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
  }
