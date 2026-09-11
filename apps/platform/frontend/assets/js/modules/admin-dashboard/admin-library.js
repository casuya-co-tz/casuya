  // ── Reference Library (admin — manage visibility) ────────────────
  async function loadAdminLibrary() {
    const SUBJECTS = [
      { slug: "mathematics", name: "Mathematics" },
      { slug: "chemistry", name: "Chemistry" },
      { slug: "physics", name: "Physics" },
    ];
    let docs = [];
    let libStats = {};
    let filters = { doc_type: "", subject_slug: "", form_level: "", query: "" };
    let page = 0;
    const PAGE_SIZE = 30;

    function subjectOpts() {
      return '<option value="">All Subjects</option>' +
        SUBJECTS.map(s => `<option value="${s.slug}">${escapeHtml(s.name)}</option>`).join("");
    }

    async function loadStats() {
      try { libStats = await request("/reference-docs/stats"); } catch(e) { libStats = {}; }
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
        const res = await request("/reference-docs/admin/list?" + params.toString());
        docs = res.items || [];
        libStats = { ...libStats, total: res.total || 0 };
      } catch (e) { docs = []; }
    }

    function renderStats() {
      const el = document.getElementById("lib-stats");
      if (!el) return;
      el.innerHTML = `
        <div class="stat-grid" style="margin-bottom:1rem">
          <div class="stat-card"><div class="stat-value">${libStats.total || 0}</div><div class="stat-label">Total Documents</div></div>
          <div class="stat-card"><div class="stat-value">${libStats.lesson_plans || 0}</div><div class="stat-label">Lesson Plans</div></div>
          <div class="stat-card"><div class="stat-value">${libStats.schemes_of_work || 0}</div><div class="stat-label">Schemes of Work</div></div>
        </div>`;
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
        const vis = d.visible_to_students;
        return `
          <div class="card" style="padding:0.75rem 1rem;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.15rem">
                <span class="tdocs-status ${typeCls}">${typeLabel}</span>
                ${form ? `<span class="tdocs-status" style="background:var(--color-bg);color:var(--color-text-muted)">${form}</span>` : ""}
              </div>
              <h4 style="margin:0;font-size:0.85rem;font-weight:600">${escapeHtml(d.title)}</h4>
              <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${escapeHtml(d.subject_name || "")}</p>
            </div>
            <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer;font-size:0.78rem;font-weight:600;white-space:nowrap">
              <input type="checkbox" data-toggle-vis="${d.id}" ${vis ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--color-primary)">
              Students
            </label>
          </div>`;
      }).join("");
      const totalPages = Math.ceil(libStats.total / PAGE_SIZE);
      const pag = document.getElementById("lib-pagination");
      if (pag) {
        pag.innerHTML = totalPages > 1 ? `
          <div style="display:flex;gap:0.5rem;align-items:center;justify-content:center;margin-top:1rem">
            <button class="btn btn-sm btn-outline" id="lib-prev" ${page === 0 ? "disabled" : ""}>← Prev</button>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">Page ${page + 1} of ${totalPages}</span>
            <button class="btn btn-sm btn-outline" id="lib-next" ${page >= totalPages - 1 ? "disabled" : ""}>Next →</button>
          </div>` : "";
      }
    }

    showAdminView(`
      <div class="content">
        <h2 class="tdocs-page-title">Reference Library</h2>
        <p class="tdocs-page-desc">Manage which reference documents are visible to students. Toggle visibility per document.</p>

        <div id="lib-stats"></div>

        <div style="display:grid;gap:0.6rem;margin-top:0.5rem">
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
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
              <option value="5">Form V</option>
              <option value="6">Form VI</option>
            </select>
            <input class="input" id="lib-search" type="search" placeholder="Search titles..." style="max-width:220px;padding:0.45rem 0.6rem;font-size:0.85rem">
            <div style="margin-left:auto;display:flex;gap:0.4rem">
              <button class="btn btn-sm btn-outline" id="lib-set-all-visible">Show All to Students</button>
              <button class="btn btn-sm btn-outline" id="lib-set-all-hidden">Hide All from Students</button>
            </div>
          </div>
          <div id="lib-results"></div>
          <div id="lib-pagination"></div>
        </div>
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

    document.getElementById("lib-results")?.addEventListener("change", async (e) => {
      const cb = e.target.closest("[data-toggle-vis]");
      if (!cb) return;
      const docId = cb.dataset.toggleVis;
      try {
        await request("/reference-docs/" + docId + "/visibility", {
          method: "PATCH",
          body: JSON.stringify({ visible_to_students: cb.checked }),
        });
      } catch (err) {
        cb.checked = !cb.checked;
        alert("Failed to update visibility");
      }
    });

    document.getElementById("lib-pagination")?.addEventListener("click", (e) => {
      if (e.target.id === "lib-prev") { page--; loadDocs().then(renderDocList); }
      if (e.target.id === "lib-next") { page++; loadDocs().then(renderDocList); }
    });

    document.getElementById("lib-set-all-visible")?.addEventListener("click", async () => {
      if (!confirm("Show ALL matching documents to students?")) return;
      const params = new URLSearchParams();
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
      if (filters.form_level) params.set("form_level", filters.form_level);
      try {
        await request("/reference-docs/admin/set-all-visibility?" + params.toString(), {
          method: "POST",
          body: JSON.stringify({ visible_to_students: true }),
        });
        await loadDocs();
        renderDocList();
      } catch(e) { alert("Failed"); }
    });

    document.getElementById("lib-set-all-hidden")?.addEventListener("click", async () => {
      if (!confirm("Hide ALL matching documents from students?")) return;
      const params = new URLSearchParams();
      if (filters.doc_type) params.set("doc_type", filters.doc_type);
      if (filters.subject_slug) params.set("subject_slug", filters.subject_slug);
      if (filters.form_level) params.set("form_level", filters.form_level);
      try {
        await request("/reference-docs/admin/set-all-visibility?" + params.toString(), {
          method: "POST",
          body: JSON.stringify({ visible_to_students: false }),
        });
        await loadDocs();
        renderDocList();
      } catch(e) { alert("Failed"); }
    });

    await Promise.all([loadStats(), loadDocs()]);
    renderStats();
    renderDocList();
  }
