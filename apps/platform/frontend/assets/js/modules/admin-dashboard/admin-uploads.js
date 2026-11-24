  async function loadAdminUploads() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading uploads...</p></div>');
    try {
      const files = await request("/uploads").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];

      let activeFilter = "all";
      let searchQuery = "";
      let sortBy = "date-desc";
      const selected = new Set();

      function matchesFilter(f) {
        const name = (f.filename || f.path || "").toLowerCase();
        const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);
        const isDoc = /\.(pdf|doc|docx|txt)$/i.test(name);
        const isMedia = /\.(mp4|webm|mp3|wav|ogg)$/i.test(name);
        if (activeFilter === "images") return isImage;
        if (activeFilter === "documents") return isDoc;
        if (activeFilter === "media") return isMedia;
        return true;
      }

      function matchesSearch(f) {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const name = (f.filename || f.path || "").toLowerCase();
        const display = (f.display_name || "").toLowerCase();
        return name.includes(q) || display.includes(q);
      }

      function sortFiles(arr) {
        const copy = arr.slice();
        copy.sort((a, b) => {
          const na = a.filename || a.path || "";
          const nb = b.filename || b.path || "";
          if (sortBy === "name-asc") return na.localeCompare(nb);
          if (sortBy === "name-desc") return nb.localeCompare(na);
          if (sortBy === "size-desc") return (b.size || 0) - (a.size || 0);
          if (sortBy === "size-asc") return (a.size || 0) - (b.size || 0);
          // date-desc default
          return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
        });
        return copy;
      }

      function filteredList() {
        return sortFiles(fileList.filter(f => matchesFilter(f) && matchesSearch(f)));
      }

      function iconFor(name) {
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name)) return "🖼️";
        if (/\.(mp4|webm)$/i.test(name)) return "🎬";
        if (/\.(mp3|wav|ogg)$/i.test(name)) return "🎵";
        return "📄";
      }

      function renderFiles() {
        const filtered = filteredList();
        const grid = document.getElementById("uploads-grid");
        if (!grid) return;
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No files match your filters</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(f => {
          const name = f.filename || f.path || "unknown";
          const displayName = f.display_name || name;
          const isVisible = f.is_visible !== false;
          const checked = selected.has(name);
          return `
            <div class="card upload-card" style="padding:0.75rem;cursor:pointer;${checked ? "outline:2px solid var(--color-primary)" : ""}" data-filename="${escapeHtml(name)}">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <input type="checkbox" class="upload-select-cb" data-filename="${escapeHtml(name)}" ${checked ? "checked" : ""} style="width:16px;height:16px;accent-color:var(--color-primary);flex-shrink:0" aria-label="Select ${escapeHtml(displayName)}">
                <div style="font-size:1.5rem;flex-shrink:0">${iconFor(name)}</div>
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

        // select checkboxes
        document.querySelectorAll(".upload-select-cb").forEach(cb => {
          cb.addEventListener("change", (e) => {
            e.stopPropagation();
            const fn = cb.dataset.filename;
            if (cb.checked) selected.add(fn); else selected.delete(fn);
            updateBulkBar();
            const card = cb.closest(".upload-card");
            if (card) card.style.outline = cb.checked ? "2px solid var(--color-primary)" : "none";
          });
          cb.addEventListener("click", (e) => e.stopPropagation());
        });

        // rename
        document.querySelectorAll(".upload-rename-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const oldName = btn.dataset.display;
            const newName = prompt("Rename file:", oldName);
            if (newName && newName !== oldName) {
              try {
                await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, { method: "PATCH", body: JSON.stringify({ display_name: newName }) });
                showToast("File renamed");
                loadAdminUploads();
              } catch(err) { showToast(err.message || "Rename failed"); }
            }
          });
        });

        // visibility toggle
        document.querySelectorAll(".upload-vis-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const currentVisible = btn.dataset.visible === "true";
            try {
              await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, { method: "PATCH", body: JSON.stringify({ is_visible: !currentVisible }) });
              showToast(currentVisible ? "File hidden" : "File now visible");
              loadAdminUploads();
            } catch(err) { showToast(err.message || "Update failed"); }
          });
        });

        // delete
        document.querySelectorAll(".upload-delete-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirmDelete(btn.dataset.filename)) return;
            try {
              await request(`/uploads/${encodeURIComponent(btn.dataset.filename)}`, { method: "DELETE" });
              showToast("File deleted");
              selected.delete(btn.dataset.filename);
              loadAdminUploads();
            } catch(err) { showToast(err.message || "Delete failed"); }
          });
        });

        // open on card click
        document.querySelectorAll("#uploads-grid .upload-card").forEach(card => {
          card.addEventListener("click", (e) => {
            if (e.target.closest("button") || e.target.closest("input")) return;
            window.open(`${API_BASE}/uploads/${encodeURIComponent(card.dataset.filename)}`, "_blank");
          });
        });
      }

      function updateBulkBar() {
        const bar = document.getElementById("bulk-bar");
        if (!bar) return;
        if (selected.size === 0) { bar.style.display = "none"; return; }
        bar.style.display = "flex";
        const cnt = document.getElementById("bulk-count");
        if (cnt) cnt.textContent = selected.size;
      }

      function escapeFilterCounts() {
        const counts = { all: fileList.length, images: 0, documents: 0, media: 0 };
        fileList.forEach(f => {
          const name = (f.filename || f.path || "").toLowerCase();
          if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name)) counts.images++;
          else if (/\.(pdf|doc|docx|txt)$/i.test(name)) counts.documents++;
          else if (/\.(mp4|webm|mp3|wav|ogg)$/i.test(name)) counts.media++;
        });
        return counts;
      }

      const counts = escapeFilterCounts();

      showAdminView(`
        <div class="content">
          <h2>📁 Uploads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Manage uploaded files. Control visibility for students and teachers.</p>

          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">📤 Upload New File(s)</h3>
            <form id="upload-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <p style="font-size:0.8rem;color:var(--color-text-muted);margin:0">Supports images, documents, videos, audio. Select multiple files at once.</p>
              <div id="drop-zone" style="border:2px dashed var(--color-border);border-radius:var(--radius);padding:1.5rem;text-align:center;color:var(--color-text-muted);font-size:0.85rem;cursor:pointer">
                Drag & drop files here, or click to choose
                <input type="file" id="upload-file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display:none">
              </div>
              <div id="upload-result" style="margin-top:0.5rem"></div>
            </form>
          </div>

          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
            <input class="input" id="upload-search" placeholder="Search files..." style="max-width:220px;padding:0.4rem 0.6rem;font-size:0.85rem">
            <select class="input" id="upload-sort" style="max-width:160px;padding:0.4rem 0.6rem;font-size:0.85rem">
              <option value="date-desc">Newest first</option>
              <option value="name-asc">Name A→Z</option>
              <option value="name-desc">Name Z→A</option>
              <option value="size-desc">Largest first</option>
            </select>
            <button class="btn-filter upload-filter-btn active" data-filter="all">All <span class="filter-count">${counts.all}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="images">🖼️ Images <span class="filter-count">${counts.images}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="documents">📄 Documents <span class="filter-count">${counts.documents}</span></button>
            <button class="btn-filter upload-filter-btn" data-filter="media">🎬 Media <span class="filter-count">${counts.media}</span></button>
          </div>

          <div id="bulk-bar" style="display:none;margin-top:0.75rem;padding:0.5rem 0.75rem;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);align-items:center;gap:0.5rem;flex-wrap:wrap">
            <span style="font-size:0.85rem;font-weight:600"><span id="bulk-count">0</span> selected</span>
            <button class="btn btn-sm" id="bulk-show-btn">Show</button>
            <button class="btn btn-sm" id="bulk-hide-btn">Hide</button>
            <button class="btn btn-outline-danger btn-sm" id="bulk-delete-btn">Delete</button>
            <button class="btn btn-sm" id="bulk-clear-btn">Clear</button>
          </div>

          <div id="uploads-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.5rem"></div>
        </div>
      `);

      // filter buttons
      document.querySelectorAll(".upload-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".upload-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderFiles();
        });
      });

      // search
      document.getElementById("upload-search")?.addEventListener("input", (e) => {
        searchQuery = e.target.value || "";
        renderFiles();
      });

      // sort
      document.getElementById("upload-sort")?.addEventListener("change", (e) => {
        sortBy = e.target.value;
        renderFiles();
      });

      // drop zone
      const dropZone = document.getElementById("drop-zone");
      const fileInput = document.getElementById("upload-file");
      dropZone?.addEventListener("click", () => fileInput?.click());
      dropZone?.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--color-primary)"; dropZone.style.background = "var(--color-bg)"; });
      dropZone?.addEventListener("dragleave", () => { dropZone.style.borderColor = "var(--color-border)"; dropZone.style.background = ""; });
      dropZone?.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--color-border)"; dropZone.style.background = "";
        if (e.dataTransfer?.files?.length) {
          fileInput.files = e.dataTransfer.files;
          document.getElementById("upload-form")?.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      });

      fileInput?.addEventListener("change", () => {
        if (fileInput.files && fileInput.files.length) {
          document.getElementById("upload-form")?.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      });

      // bulk actions
      async function bulkSetVisible(visible) {
        const targets = [...selected];
        let ok = 0, fail = 0;
        for (const fn of targets) {
          try {
            await request(`/uploads/${encodeURIComponent(fn)}`, { method: "PATCH", body: JSON.stringify({ is_visible: visible }) });
            ok++;
          } catch (e) { fail++; }
        }
        showToast(`Updated ${ok} file(s)${fail ? `, ${fail} failed` : ""}`);
        selected.clear();
        loadAdminUploads();
      }

      async function bulkDelete() {
        if (!confirm(`Delete ${selected.size} file(s)? This cannot be undone.`)) return;
        const targets = [...selected];
        let ok = 0, fail = 0;
        for (const fn of targets) {
          try {
            await request(`/uploads/${encodeURIComponent(fn)}`, { method: "DELETE" });
            ok++;
          } catch (e) { fail++; }
        }
        showToast(`Deleted ${ok} file(s)${fail ? `, ${fail} failed` : ""}`);
        selected.clear();
        loadAdminUploads();
      }

      document.getElementById("bulk-show-btn")?.addEventListener("click", () => bulkSetVisible(true));
      document.getElementById("bulk-hide-btn")?.addEventListener("click", () => bulkSetVisible(false));
      document.getElementById("bulk-delete-btn")?.addEventListener("click", bulkDelete);
      document.getElementById("bulk-clear-btn")?.addEventListener("click", () => { selected.clear(); updateBulkBar(); renderFiles(); });

      // select all via header checkbox (none present) — add a select-all toggle in filter row? Instead add via bulk bar "Select all visible"
      // We'll add a select-all button dynamically inside bulk bar by reusing bulk-clear area? Add separate:
      // (handled by clicking filter? no) — add a small "Select all shown" button in filter row
      // Insert after search input creation: add button
      // (We'll append a select-all button to bulk bar)
      const bulkBar = document.getElementById("bulk-bar");
      if (bulkBar) {
        const sa = document.createElement("button");
        sa.className = "btn btn-sm";
        sa.textContent = "Select all shown";
        sa.addEventListener("click", () => {
          filteredList().forEach(f => selected.add(f.filename || f.path));
          updateBulkBar(); renderFiles();
        });
        bulkBar.appendChild(sa);
      }

      // upload (multi-file)
      let uploading = false;
      document.getElementById("upload-form")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const input = document.getElementById("upload-file");
        const filesToUpload = Array.from(input?.files || []);
        if (filesToUpload.length === 0 || uploading) return;
        uploading = true;
        const btn = document.getElementById("upload-submit-btn");
        if (btn) { btn.textContent = "Uploading..."; btn.disabled = true; btn.style.opacity = "0.7"; }
        const token = localStorage.getItem("casuya_token");
        const results = [];
        for (const file of filesToUpload) {
          const formData = new FormData();
          formData.append("file", file);
          try {
            const resp = await fetch(`${API_BASE}/uploads/`, { method: "POST", headers: token ? { "Authorization": `Bearer ${token}` } : {}, body: formData });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) results.push(`✓ ${data.filename || file.name}`);
            else results.push(`✗ ${file.name}: ${data.detail || "failed"}`);
          } catch (err) {
            results.push(`✗ ${file.name}: ${err.message}`);
          }
        }
        const resEl = document.getElementById("upload-result");
        if (resEl) resEl.innerHTML = `<div style="padding:0.5rem;background:var(--color-bg);border-radius:var(--radius);font-size:0.8rem">${results.map(r => escapeHtml(r)).join("<br>")}</div>`;
        uploading = false;
        if (btn) { btn.textContent = "📤 Upload File(s)"; btn.disabled = false; btn.style.opacity = "1"; }
        if (input) input.value = "";
        loadAdminUploads();
      });

      renderFiles();
      updateBulkBar();
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading uploads</p></div>'); }
  }