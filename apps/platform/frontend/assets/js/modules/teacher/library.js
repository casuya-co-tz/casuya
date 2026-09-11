// modules/teacher/library.js — reference library view

async function loadLibrary(dashboard) {
  const SUBJECTS = [
    { slug: "mathematics", name: "Mathematics" },
    { slug: "chemistry", name: "Chemistry" },
    { slug: "physics", name: "Physics" },
  ];
  let docs = [];
  let stats = {};
  let filters = { doc_type: "", subject_slug: "", form_level: "", query: "" };
  let page = 0;
  const PAGE_SIZE = 20;

  function subjectOpts() {
    return '<option value="">All Subjects</option>' + SUBJECTS.map(s => `<option value="${s.slug}">${escapeHtml(s.name)}</option>`).join("");
  }

  async function loadDocs() {
    const params = new URLSearchParams();
    if (filters.doc_type) params.set("doc_type", filters.doc_type);
    if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
    if (filters.form_level) params.set("form_level", filters.form_level);
    if (filters.query) params.set("query", filters.query);
    params.set("limit", PAGE_SIZE);
    params.set("offset", page * PAGE_SIZE);
    try {
      const res = await request("/reference-docs?" + params.toString());
      docs = res.items || [];
      stats = { total: res.total || 0 };
    } catch(e) { docs = []; stats = { total: 0 }; }
  }

  function renderDocList() {
    const el = document.getElementById("lib-results");
    if (!el) return;
    if (!docs.length) {
      el.innerHTML = '<div class="tdocs-empty"><div class="tdocs-empty-icon">📖</div><p>No reference documents found.</p></div>';
      return;
    }
    const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };
    el.innerHTML = docs.map(d => {
      const typeLabel = d.doc_type === "scheme_of_work" ? "Scheme of Work" : "Lesson Plan";
      const typeCls = d.doc_type === "scheme_of_work" ? "tdocs-status-info" : "tdocs-status-success";
      const form = d.form_level ? "Form " + (ROMAN[d.form_level] || d.form_level) : "";
      return `
        <div class="lib-card" data-lib-view="${d.id}">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem">
            <span class="tdocs-status ${typeCls}">${typeLabel}</span>
            ${form ? `<span class="tdocs-status" style="background:var(--color-bg);color:var(--color-text-muted)">${form}</span>` : ""}
          </div>
          <h4 style="margin:0;font-size:0.88rem;font-weight:600">${escapeHtml(d.title)}</h4>
          <p style="margin:0.2rem 0 0;font-size:0.72rem;color:var(--color-text-muted)">${escapeHtml(d.subject_name || "")}</p>
        </div>`;
    }).join("");
    const totalPages = Math.ceil(stats.total / PAGE_SIZE);
    const pag = document.getElementById("lib-pagination");
    if (pag) {
      pag.innerHTML = totalPages > 1 ? `
        <div style="display:flex;gap:0.5rem;align-items:center;justify-content:center;margin-top:1rem">
          <button class="btn btn-sm btn-outline" id="lib-prev" ${page === 0 ? "disabled" : ""}>← Prev</button>
          <span style="font-size:0.8rem;color:var(--color-text-muted)">Page ${page + 1} of ${totalPages} (${stats.total} total)</span>
          <button class="btn btn-sm btn-outline" id="lib-next" ${page >= totalPages - 1 ? "disabled" : ""}>Next →</button>
        </div>` : "";
    }
  }

  async function viewDoc(id) {
    const el = document.getElementById("lib-viewer");
    if (!el) return;
    el.innerHTML = '<div class="tdocs-loading"><div class="spinner"></div>Loading document...</div>';
    el.style.display = "block";
    try {
      const resp = await fetch(`${API_BASE}/reference-docs/${id}/render`);
      const html = await resp.text();
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
          <h4 style="margin:0;font-size:0.9rem;font-weight:700">Reference Document</h4>
          <button class="btn btn-sm btn-outline" id="lib-close-viewer">✕ Close</button>
        </div>
        <iframe srcdoc="${escapeHtml(html).replace(/"/g, '&quot;')}" style="width:100%;min-height:500px;border:1px solid var(--color-border);border-radius:8px;background:#fff"></iframe>`;
      document.getElementById("lib-close-viewer")?.addEventListener("click", () => { el.style.display = "none"; });
    } catch(e) {
      el.innerHTML = '<p style="color:var(--color-danger)">Error loading document.</p>';
    }
  }

  dashboard.showView(`
    <div class="content">
      <h2 class="tdocs-page-title">Reference Library</h2>
      <p class="tdocs-page-desc">Browse official TIE lesson plans and schemes of work. Use these as reference when generating your own documents.</p>
      <div style="display:grid;gap:0.6rem;margin-top:1.25rem">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <select class="input" id="lib-type" style="max-width:180px;padding:0.45rem 0.6rem;font-size:0.85rem">
            <option value="">All Types</option>
            <option value="lesson_plan">Lesson Plans</option>
            <option value="scheme_of_work">Schemes of Work</option>
          </select>
          <select class="input" id="lib-subject" style="max-width:180px;padding:0.45rem 0.6rem;font-size:0.85rem">${subjectOpts()}</select>
          <select class="input" id="lib-form" style="max-width:140px;padding:0.45rem 0.6rem;font-size:0.85rem">
            <option value="">All Forms</option>
            <option value="1">Form I</option>
            <option value="2">Form II</option>
            <option value="3">Form III</option>
            <option value="4">Form IV</option>
          </select>
          <input class="input" id="lib-search" type="search" placeholder="Search titles..." style="max-width:220px;padding:0.45rem 0.6rem;font-size:0.85rem">
        </div>
        <div id="lib-results"></div>
        <div id="lib-pagination"></div>
      </div>
      <div id="lib-viewer" style="display:none;margin-top:1.5rem"></div>
    </div>
  `);

  const typeEl = document.getElementById("lib-type");
  const subjEl = document.getElementById("lib-subject");
  const formEl = document.getElementById("lib-form");
  const searchEl = document.getElementById("lib-search");
  let searchTimer;

  function applyFilters() {
    filters.doc_type = typeEl.value;
    filters.subject_slug = subjEl.value;
    filters.form_level = formEl.value;
    page = 0;
    loadDocs().then(renderDocList);
  }

  typeEl?.addEventListener("change", applyFilters);
  subjEl?.addEventListener("change", applyFilters);
  formEl?.addEventListener("change", applyFilters);
  searchEl?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filters.query = searchEl.value.trim(); page = 0; loadDocs().then(renderDocList); }, 300);
  });

  document.getElementById("lib-results")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-lib-view]");
    if (btn) viewDoc(btn.dataset.libView);
  });
  document.getElementById("lib-pagination")?.addEventListener("click", e => {
    if (e.target.id === "lib-prev") { page--; loadDocs().then(renderDocList); }
    if (e.target.id === "lib-next") { page++; loadDocs().then(renderDocList); }
  });

  await loadDocs();
  renderDocList();
}
