async function loadAdminAiQuality() {
  showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading AI tutor metrics…</p></div>');
  try {
    const data = await request("/ai/quality");
    const ai = data.casuya_ai || {};
    const tel = data.telemetry || {};
    const rates = tel.rates || {};
    const counters = tel.counters || {};
    const samples = tel.samples || [];
    const queue = Array.isArray(data.review_queue) ? data.review_queue : [];

    const chain = (ai.provider_chain || []).join(" → ") || "—";
    const online = !!ai.reachable;
    const kbReady = !!ai.kb_ready;
    const embReady = !!ai.embeddings_ready;
    const embCount = Number(ai.embeddings_count || 0);
    const pendingCount = queue.length;

    function statusColor(ok) {
      return ok ? "var(--color-success)" : "var(--color-danger)";
    }

    function pct(n) {
      return (Number(n) || 0) + "%";
    }

    function renderReviewCard(item) {
      const meta = [
        item.created_at ? item.created_at.slice(0, 19).replace("T", " ") : "",
        item.subject_slug || "",
        item.format_level || "",
      ].filter(Boolean).join(" · ");

      const flags = Array.isArray(item.flagged_terms) ? item.flagged_terms : [];
      const response = String(item.response || "");
      const question = String(item.question || "");
      const responseClipped = response.length > 280
        ? response.slice(0, 280) + "…"
        : response;

      return `
        <article class="card tutor-review-row" data-id="${escapeHtml(String(item.id))}" style="padding:1rem">
          <div class="section-header" style="margin-bottom:0.5rem">
            <div style="font-size:0.75rem;color:var(--color-text-muted)">${escapeHtml(meta) || "—"}</div>
            <span class="badge badge-pending" data-review-status>Pending</span>
          </div>
          <div style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:0.35rem">Review the answer below:</div>
          <div style="font-size:0.85rem;line-height:1.45">
            <strong>Q:</strong> ${escapeHtml(question)}
          </div>
          <div style="font-size:0.85rem;line-height:1.45;margin-top:0.4rem;color:var(--color-text-muted)">
            <strong>A:</strong> ${escapeHtml(responseClipped)}
          </div>
          ${flags.length ? `
            <div style="font-size:0.75rem;color:var(--color-warning);margin-top:0.45rem">
              Flagged: ${escapeHtml(flags.join(", "))}
            </div>
          ` : ""}
          <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap">
            <button type="button" class="btn btn-sm btn-primary" data-review-action="approved">Approve</button>
            <button type="button" class="btn btn-sm btn-outline" data-review-action="dismissed">Dismiss</button>
          </div>
        </article>
      `;
    }

    function renderSampleRow(s) {
      const when = s.at ? new Date(s.at * 1000).toLocaleString() : "—";
      const meta = [s.path || "", s.source || "", "format=" + (s.format_level || "")].filter(Boolean).join(" · ");
      return `
        <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;padding:0.5rem 0;border-bottom:1px solid var(--color-border);font-size:0.8rem">
          <span style="color:var(--color-text-muted);white-space:nowrap">${escapeHtml(when)}</span>
          <span style="flex:1;min-width:180px">${escapeHtml(meta)}</span>
          <span>${s.needs_review ? '<span class="badge badge-pending">review</span>' : '<span class="badge badge-completed">ok</span>'}</span>
        </div>
      `;
    }

    showAdminView(`
      <div class="content">
        <div class="section-header">
          <div>
            <h2 style="margin:0">AI Tutor Quality</h2>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0.25rem 0 0">
              Live casuya-ai connectivity, telemetry, and teacher review queue.
            </p>
          </div>
          <button type="button" id="ai-quality-refresh" class="btn btn-outline btn-sm">Refresh</button>
        </div>

        <div class="stat-grid" style="margin-top:0.75rem">
          <div class="stat-card">
            <div class="stat-value" style="color:${statusColor(online)}">${online ? "Online" : "Offline"}</div>
            <div class="stat-label">casuya-ai</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:${statusColor(kbReady)}">${kbReady ? "Ready" : "Missing"}</div>
            <div class="stat-label">Knowledge base</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:${embReady ? "var(--color-success)" : "var(--color-warning)"}">
              ${embReady ? embCount + " vecs" : "BM25"}
            </div>
            <div class="stat-label">Hybrid embeddings</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="font-size:0.95rem;line-height:1.35">${escapeHtml(chain)}</div>
            <div class="stat-label">Provider chain</div>
          </div>
        </div>

        <h3 style="margin:1.25rem 0 0.75rem">Usage</h3>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${Number(counters.requests) || 0}</div><div class="stat-label">Total requests</div></div>
          <div class="stat-card"><div class="stat-value">${Number(counters.stream) || 0}</div><div class="stat-label">Streaming</div></div>
          <div class="stat-card"><div class="stat-value">${Number(counters.explain) || 0}</div><div class="stat-label">Explain (fallback)</div></div>
          <div class="stat-card"><div class="stat-value">${Number(counters.deep_mode) || 0}</div><div class="stat-label">Deep mode</div></div>
          <div class="stat-card"><div class="stat-value" style="color:${(Number(rates.format_complete_pct) || 0) >= 80 ? "var(--color-success)" : "var(--color-warning)"}">${pct(rates.format_complete_pct)}</div><div class="stat-label">Format complete</div></div>
          <div class="stat-card"><div class="stat-value">${pct(rates.offline_pct)}</div><div class="stat-label">Offline / cache</div></div>
          <div class="stat-card"><div class="stat-value" style="color:${(Number(rates.needs_review_pct) || 0) > 10 ? "var(--color-warning)" : "var(--color-text)"}">${pct(rates.needs_review_pct)}</div><div class="stat-label">Flagged for review</div></div>
          <div class="stat-card"><div class="stat-value">${pendingCount}</div><div class="stat-label">Pending review</div></div>
        </div>

        <div class="section-header" style="margin-top:1.5rem">
          <h3>Review queue</h3>
          <span style="font-size:0.75rem;color:var(--color-text-muted)">${pendingCount} pending</span>
        </div>
        <div id="tutor-review-queue">
          ${queue.length
            ? '<div class="card-grid">' + queue.map(renderReviewCard).join("") + "</div>"
            : '<div class="empty-state" style="padding:2rem 1rem"><p>No answers awaiting review.</p></div>'}
        </div>

        <h3 style="margin:1.5rem 0 0.75rem">Recent samples</h3>
        ${samples.length
          ? '<div style="border-top:1px solid var(--color-border)">' + samples.map(renderSampleRow).join("") + "</div>"
          : '<div class="empty-state" style="padding:1.5rem 1rem"><p>No tutor events recorded yet on this instance.</p></div>'}
      </div>
    `);

    document.getElementById("ai-quality-refresh")?.addEventListener("click", function () {
      loadAdminAiQuality();
    });

    document.querySelectorAll("[data-review-action]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const row = btn.closest(".tutor-review-row");
        if (!row) return;
        const id = row.getAttribute("data-id");
        const status = btn.getAttribute("data-review-action");
        const statusEl = row.querySelector("[data-review-status]");
        const buttons = row.querySelectorAll("[data-review-action]");
        buttons.forEach(function (b) { b.disabled = true; });
        if (statusEl) {
          statusEl.className = "badge " + (status === "approved" ? "badge-completed" : "badge-failed");
          statusEl.textContent = status === "approved" ? "Approved" : "Dismissed";
        }
        try {
          await request("/ai/review/" + encodeURIComponent(id), {
            method: "PATCH",
            body: JSON.stringify({ status: status }),
          });
          window.setTimeout(function () {
            row.style.opacity = "0.4";
            const queueEl = document.getElementById("tutor-review-queue");
            const remaining = queueEl ? queueEl.querySelectorAll(".tutor-review-row").length - 1 : 0;
            if (queueEl && remaining <= 0) {
              queueEl.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p>No answers awaiting review.</p></div>';
              const headerCount = document.querySelector("#tutor-review-queue")?.previousElementSibling;
              if (headerCount && headerCount.querySelector("span")) {
                headerCount.querySelector("span").textContent = "0 pending";
              }
            } else {
              window.setTimeout(function () { row.remove(); }, 250);
            }
          }, 200);
        } catch (e) {
          buttons.forEach(function (b) { b.disabled = false; });
          if (statusEl) {
            statusEl.className = "badge badge-pending";
            statusEl.textContent = "Pending";
          }
          alert(e.message || "Review update failed");
        }
      });
    });
  } catch (err) {
    showAdminView(`
      <div class="content">
        <div class="empty-state">
          <h2>AI Tutor Quality</h2>
          <p>Failed to load AI quality: ${escapeHtml(err.message || "error")}</p>
          <p><a href="#" id="ai-quality-retry">Try again</a></p>
        </div>
      </div>
    `);
    document.getElementById("ai-quality-retry")?.addEventListener("click", function (e) {
      e.preventDefault();
      loadAdminAiQuality();
    });
  }
}
