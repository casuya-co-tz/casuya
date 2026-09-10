// modules/teacher/plans/saved.js — saved teaching documents list.

async function loadSaved(state) {
  try { state.savedPlans = await request("/teacher-plans/list?_t=" + Date.now()).catch(() => []); } catch(e) { state.savedPlans = []; }
}

function renderSavedList(state) {
  const listDiv = document.getElementById("tdocs-saved-list");
  if (!listDiv) return;
  if (!state.savedPlans.length) {
    listDiv.innerHTML = '<div class="tdocs-empty"><div class="tdocs-empty-icon">📂</div><p>No saved documents yet. Generate one above.</p></div>';
    return;
  }
  listDiv.innerHTML = state.savedPlans.map(p => {
    const isSw = p.language === "sw";
    const typeLabel = p.plan_type === "scheme_of_work" ? (isSw ? "Mpango wa Kazi" : "Scheme of Work") : (isSw ? "Mpango wa Somo" : "Lesson Plan");
    const f = p.form_level ? ("Form " + (plansRoman[p.form_level] || p.form_level)) : "";
    return `
      <div class="card tdocs-doc-card" style="padding:1rem 1.15rem;margin-bottom:0.6rem">
        <div class="tdocs-doc-row">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.2rem">
              <span class="tdocs-status ${p.plan_type === 'scheme_of_work' ? 'tdocs-status-info' : 'tdocs-status-success'}">${escapeHtml(typeLabel)}</span>
              ${f ? `<span class="tdocs-status" style="background:var(--color-bg);color:var(--color-text-muted)">${escapeHtml(f)}</span>` : ""}
            </div>
            <h4 style="margin:0;font-size:0.9rem">${escapeHtml(plansPlanLabel(p))}</h4>
            <p style="margin:0.15rem 0 0;font-size:0.72rem;color:var(--color-text-muted)">
              ${escapeHtml(p.subject_name || p.subject_slug || "")} &middot; ${escapeHtml(p.created_at ? new Date(p.created_at).toLocaleDateString() : "")}
            </p>
          </div>
          <div class="tdocs-actions">
            <button class="btn btn-sm btn-outline" data-view="${p.id}">👁</button>
            <button class="btn btn-sm btn-outline" data-print="${p.id}">🖨</button>
            <button class="btn btn-sm btn-outline" data-doc="${p.id}">📥</button>
            <button class="btn btn-sm btn-danger" data-del="${p.id}">✕</button>
          </div>
        </div>
      </div>`;
  }).join("");
}