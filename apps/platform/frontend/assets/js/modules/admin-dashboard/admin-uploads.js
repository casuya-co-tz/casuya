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
