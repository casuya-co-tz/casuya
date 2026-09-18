// modules/student/downloads.js — offline downloads management.
// Lesson HTML lives in IndexedDB (pinned). localStorage only keeps the id list
// as a fallback index — it used to store full HTML and hit the 5 MB quota.

"use strict";

function _downloadedIdList() {
  try { return JSON.parse(localStorage.getItem("casuya_downloaded_lessons") || "[]"); } catch (e) { return []; }
}

function _setDownloadedIdList(ids) {
  localStorage.setItem("casuya_downloaded_lessons", JSON.stringify(ids));
}

function migrateLocalLessonCache() {
  var contentCache;
  try { contentCache = JSON.parse(localStorage.getItem("casuya_lesson_content_cache") || "{}"); } catch (e) { return Promise.resolve(); }
  var ids = Object.keys(contentCache || {});
  if (!ids.length) return Promise.resolve();
  var jobs = ids.map(function (id) {
    var html = contentCache[id] && contentCache[id].html;
    if (!html || typeof putIdbLessonContent !== "function") return Promise.resolve();
    return putIdbLessonContent(id, html, true);
  });
  return Promise.all(jobs).then(function () {
    try { localStorage.removeItem("casuya_lesson_content_cache"); } catch (e) {}
  });
}

function registerDownloadsView(d) {
  async function loadStudentDownloads() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading downloads...</p></div>');
    try {
      await migrateLocalLessonCache();
      const lessons = await request("/lessons");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      let cachedIds = _downloadedIdList();
      if (typeof listIdbLessonIds === "function") {
        const pinned = await listIdbLessonIds(true);
        if (pinned.length) {
          cachedIds = Array.from(new Set(cachedIds.concat(pinned)));
          _setDownloadedIdList(cachedIds);
        }
      }
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
          btn.disabled = true;
          btn.textContent = "Saving...";
          try {
            const html = typeof loadLessonHtml === "function"
              ? await loadLessonHtml(lessonId)
              : "";
            if (html) {
              if (typeof putIdbLessonContent === "function") {
                await putIdbLessonContent(lessonId, html, true);
              }
              if (typeof cacheLessonContent === "function") cacheLessonContent(lessonId, html);
              if (!cachedIds.includes(lessonId)) {
                cachedIds.push(lessonId);
                _setDownloadedIdList(cachedIds);
              }
              showToast("Lesson saved for offline viewing");
              loadStudentDownloads();
            } else {
              showToast("Failed to save lesson");
              btn.disabled = false;
              btn.textContent = "Download";
            }
          } catch(e) {
            showToast("Failed to save lesson");
            btn.disabled = false;
            btn.textContent = "Download";
          }
        });
      });
      document.querySelectorAll("[data-remove-download]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const lessonId = btn.dataset.removeDownload;
          if (typeof deleteIdbLessonContent === "function") {
            await deleteIdbLessonContent(lessonId);
          }
          if (typeof dropCachedLessonContent === "function") {
            dropCachedLessonContent(lessonId);
          }
          cachedIds = cachedIds.filter(id => id !== lessonId);
          _setDownloadedIdList(cachedIds);
          loadStudentDownloads();
        });
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading downloads</p></div>'); }
  }

  d.registerView("downloads", loadStudentDownloads);
}
