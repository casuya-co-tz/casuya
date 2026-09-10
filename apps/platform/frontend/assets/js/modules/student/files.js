// modules/student/files.js — file management view.

"use strict";

function registerFilesView(d) {
  async function loadStudentFiles() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading files...</p></div>');
    try {
      const files = await request("/uploads/public").catch(() => []);
      const fileList = Array.isArray(files) ? files : [];
      let activeFilter = "all";

      function renderStudentFiles() {
        let filtered = fileList;
        if (activeFilter !== "all") {
          const ext = { images: "image", documents: "doc", media: "media" }[activeFilter];
          if (ext === "image") filtered = fileList.filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.filename || f.path || ""));
          else if (ext === "doc") filtered = fileList.filter(f => /\.(pdf|doc|docx|txt)$/i.test(f.filename || f.path || ""));
          else if (ext === "media") filtered = fileList.filter(f => /\.(mp4|webm|mp3|wav|ogg)$/i.test(f.filename || f.path || ""));
        }
        const grid = document.getElementById("student-files-grid");
        if (!grid) return;
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No files available</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(f => {
          const name = f.filename || f.path || "unknown";
          const displayName = f.display_name || name;
          const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);
          const isVideo = /\.(mp4|webm)$/i.test(name);
          const isAudio = /\.(mp3|wav|ogg)$/i.test(name);
          const icon = isImage ? "🖼️" : isVideo ? "🎬" : isAudio ? "🎵" : "📄";
          return `
            <div class="card" style="padding:0.75rem;cursor:pointer" onclick="window.open('${API_BASE}/uploads/${encodeURIComponent(name)}', '_blank')">
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div style="font-size:1.5rem;flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <p style="margin:0;font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(displayName)}</p>
                  <p style="margin:0.15rem 0 0;font-size:0.7rem;color:var(--color-text-muted)">${f.size ? (f.size / 1024).toFixed(1) + " KB" : ""}</p>
                </div>
              </div>
            </div>
          `;
        }).join("");
      }

      d.showView(`
        <div class="content">
          <h2>📂 Files & Resources</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Browse and download files uploaded by your teachers.</p>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn-filter student-files-filter active" data-filter="all">All</button>
            <button class="btn-filter student-files-filter" data-filter="images">🖼️ Images</button>
            <button class="btn-filter student-files-filter" data-filter="documents">📄 Documents</button>
            <button class="btn-filter student-files-filter" data-filter="media">🎬 Media</button>
          </div>
          <div id="student-files-grid" style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.5rem"></div>
        </div>
      `);
      document.querySelectorAll(".student-files-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.filter;
          document.querySelectorAll(".student-files-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
          renderStudentFiles();
        });
      });
      renderStudentFiles();
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading files</p></div>'); }
  }

  d.registerView("files", loadStudentFiles);
}
