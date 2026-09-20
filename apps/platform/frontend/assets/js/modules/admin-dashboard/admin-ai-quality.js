async function loadAdminAiQuality() {
  showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading AI tutor metrics…</p></div>');
  try {
    const data = await request("/ai/quality");
    const ai = data.casuya_ai || {};
    const tel = data.telemetry || {};
    const rates = tel.rates || {};
    const counters = tel.counters || {};
    const samples = tel.samples || [];
    const queue = data.review_queue || [];

    const chain = (ai.provider_chain || []).join(" → ") || "—";
    const rows = [
      ["Total tutor requests", counters.requests || 0],
      ["Streaming", counters.stream || 0],
      ["Explain (fallback)", counters.explain || 0],
      ["Format complete", (rates.format_complete_pct || 0) + "%"],
      ["Offline / cache", (rates.offline_pct || 0) + "%"],
      ["Flagged for review", (rates.needs_review_pct || 0) + "%"],
      ["Deep mode (quality tier)", counters.deep_mode || 0],
      ["Pending review queue", queue.length],
    ];

    const queueHtml = queue.length
      ? queue.map(function (item) {
          return (
            '<div class="tutor-review-row" data-id="' + escapeHtml(item.id) + '" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.65rem">'
            + '<div style="font-size:0.78rem;color:var(--color-text-muted);margin-bottom:0.35rem">'
            + escapeHtml(item.created_at || "") + (item.subject_slug ? " · " + escapeHtml(item.subject_slug) : "")
            + "</div>"
            + '<div style="font-size:0.85rem"><strong>Q:</strong> ' + escapeHtml(item.question || "") + "</div>"
            + '<div style="font-size:0.85rem;margin-top:0.35rem"><strong>A:</strong> ' + escapeHtml((item.response || "").slice(0, 280)) + "</div>"
            + (item.flagged_terms && item.flagged_terms.length
              ? '<div style="font-size:0.75rem;color:var(--color-warning);margin-top:0.35rem">Flagged: '
                + escapeHtml(item.flagged_terms.join(", ")) + "</div>"
              : "")
            + '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;flex-wrap:wrap">'
            + '<button type="button" class="btn btn-sm btn-primary" data-review-action="approved">Approve</button>'
            + '<button type="button" class="btn btn-sm btn-outline" data-review-action="dismissed">Dismiss</button>'
            + "</div></div>"
          );
        }).join("")
      : '<p style="font-size:0.85rem;color:var(--color-text-muted)">No answers awaiting review.</p>';

    showAdminView(`
      <div class="card" style="padding:1.5rem">
        <h2 style="margin-bottom:0.25rem">AI Tutor Quality</h2>
        <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:1rem">
          Live casuya-ai connectivity, telemetry, and teacher review queue.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-bottom:1.25rem">
          <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;text-align:center">
            <div style="font-size:0.75rem;color:var(--color-text-muted)">casuya-ai</div>
            <strong style="color:${ai.reachable ? "var(--color-success)" : "var(--color-danger)"}">
              ${ai.reachable ? "● Online" : "● Offline"}
            </strong>
          </div>
          <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;text-align:center">
            <div style="font-size:0.75rem;color:var(--color-text-muted)">Knowledge base</div>
            <strong>${ai.kb_ready ? "Ready" : "Missing"}</strong>
          </div>
          <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;text-align:center">
            <div style="font-size:0.75rem;color:var(--color-text-muted)">Provider chain</div>
            <strong style="font-size:0.8rem">${escapeHtml(chain)}</strong>
          </div>
        </div>
        <h3 style="margin:0 0 0.5rem">Usage counters</h3>
        ${rows.map(function (r) {
          return '<div style="display:flex;justify-content:space-between;padding:0.45rem 0;border-bottom:1px solid var(--color-border)">'
            + '<span style="font-size:0.9rem">' + escapeHtml(String(r[0])) + '</span>'
            + '<strong style="font-size:0.9rem">' + escapeHtml(String(r[1])) + '</strong></div>';
        }).join("")}
        <h3 style="margin:1.25rem 0 0.5rem">Review queue</h3>
        <div id="tutor-review-queue">${queueHtml}</div>
        <h3 style="margin:1.25rem 0 0.5rem">Recent samples</h3>
        ${samples.length ? samples.map(function (s) {
          var when = s.at ? new Date(s.at * 1000).toLocaleString() : "—";
          return '<div style="font-size:0.8rem;padding:0.45rem 0;border-bottom:1px solid var(--color-border)">'
            + escapeHtml(when) + " · " + escapeHtml(s.path || "")
            + " · " + escapeHtml(s.source || "") + " · format=" + escapeHtml(s.format_level || "")
            + (s.needs_review ? " · <span style=\"color:var(--color-warning)\">review</span>" : "")
            + "</div>";
        }).join("") : '<p style="font-size:0.85rem;color:var(--color-text-muted)">No tutor events recorded yet on this instance.</p>'}
      </div>
    `);

    document.querySelectorAll("[data-review-action]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var row = btn.closest(".tutor-review-row");
        if (!row) return;
        var id = row.getAttribute("data-id");
        var status = btn.getAttribute("data-review-action");
        try {
          await request("/ai/review/" + encodeURIComponent(id), {
            method: "PATCH",
            body: JSON.stringify({ status: status }),
          });
          row.remove();
        } catch (e) {
          alert(e.message || "Review update failed");
        }
      });
    });
  } catch (err) {
    showAdminView('<div class="card" style="padding:1.5rem"><p style="color:var(--color-danger)">Failed to load AI quality: '
      + escapeHtml(err.message || "error") + "</p></div>");
  }
}
