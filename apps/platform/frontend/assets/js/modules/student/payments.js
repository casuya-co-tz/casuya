// modules/student/payments.js — payments, plans, and subscriptions.

"use strict";

function registerPaymentsView(d) {
  async function loadStudentPayments() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading payments...</p></div>');
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

      d.showView(`
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
      document.getElementById("student-refresh-tx-btn")?.addEventListener("click", () => loadStudentPayments());
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading payments: ' + escapeHtml(e.message) + '</p></div>'); }
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

  d.registerView("payments", loadStudentPayments);
}
