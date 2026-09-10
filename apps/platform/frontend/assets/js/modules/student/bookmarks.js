// modules/student/bookmarks.js — bookmarks view.

"use strict";

function registerBookmarksView(d) {
  async function loadStudentBookmarks() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading bookmarks...</p></div>');
    try {
      const data = await request("/bookmarks/");
      const bookmarks = Array.isArray(data) ? data : [];
      if (bookmarks.length === 0) {
        d.showView('<div class="empty-state"><p>No bookmarks yet</p></div>');
        return;
      }
      d.showView(`
        <h2>My Bookmarks</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${bookmarks.map(b => `
            <div class="card" style="cursor:pointer" data-id="${b.lesson_id || b.id}">
              <h3>${escapeHtml(b.lesson_title || b.title || "Untitled")}</h3>
            </div>
          `).join("")}
        </div>
      `);
      document.querySelectorAll(".card[data-id]").forEach(card => {
        card.addEventListener("click", () => d.callView("lesson", card.dataset.id));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading bookmarks</p></div>'); }
  }

  d.registerView("bookmarks", loadStudentBookmarks);
}
