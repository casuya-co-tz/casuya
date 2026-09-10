// modules/student/downloads.js — offline downloads management.

"use strict";

function registerDownloadsView(d) {
  async function loadStudentDownloads() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading downloads...</p></div>');
    try {
      const lessons = await request("/lessons");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      let cachedIds = [];
      try { cachedIds = JSON.parse(localStorage.getItem("casuya_downloaded_lessons") || "[]"); } catch(e) {}
      const cachedLessons = lessonList.filter(l => cachedIds.includes(l.id));
      const availableLessons = lessonList.filter(l => !cachedIds.includes(l.id));

      d.showView(`
        <div class="content">
          <h2>Downloads</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Save lessons for offline viewing. Cached lessons are stored locally in your browser.</p>
          ${cachedLessons.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Cached Lessons (${cachedLessons.length})</h3>
            <div class="card-grid">
              ${cachedLessons.map(l => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-success);font-size:0.75rem;margin-top:0.25rem">Available offline</p>
                    </div>
                    <button class="btn btn-sm btn-danger" data-remove-download="${l.id}">Remove</button>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ''}
          <h3 style="margin:1.5rem 0 0.75rem">Available Lessons</h3>
          <div class="card-grid">
            ${availableLessons.length === 0 ? '<div class="empty-state"><p>All lessons are cached or none available.</p></div>' :
              availableLessons.map(l => `
                <div class="card" style="padding:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h4 style="margin:0">${escapeHtml(l.title)}</h4>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(l.status)}</p>
                    </div>
                    <button class="btn btn-sm btn-primary" data-download-lesson="${l.id}" data-title="${escapeHtml(l.title)}">Download</button>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("[data-download-lesson]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const lessonId = btn.dataset.downloadLesson;
          const title = btn.dataset.title;
          btn.disabled = true;
          btn.textContent = "Saving...";
          try {
            const contentResp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, {
              headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
            });
            if (contentResp.ok) {
              const html = await contentResp.text();
              const contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}");
              contentCache[lessonId] = { html, title, savedAt: Date.now() };
              localStorage.setItem("casuya_lesson_content_cache", JSON.stringify(contentCache));
              if (!cachedIds.includes(lessonId)) {
                cachedIds.push(lessonId);
                localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(cachedIds));
              }
              showToast("Lesson saved for offline viewing");
              loadStudentDownloads();
            }
          } catch(e) {
            showToast("Failed to save lesson");
            btn.disabled = false;
            btn.textContent = "Download";
          }
        });
      });
      document.querySelectorAll("[data-remove-download]").forEach(btn => {
        btn.addEventListener("click", () => {
          const lessonId = btn.dataset.removeDownload;
          const contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}");
          delete contentCache[lessonId];
          localStorage.setItem("casuya_lesson_content_cache", JSON.stringify(contentCache));
          cachedIds = cachedIds.filter(id => id !== lessonId);
          localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(cachedIds));
          loadStudentDownloads();
        });
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading downloads</p></div>'); }
  }

  d.registerView("downloads", loadStudentDownloads);
}
