// modules/admin-dashboard/01-overview/charts.js — admin subtopics & lessons drill-down

  async function loadAdminSubtopics(topicId, topicTitle, backFn) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      const subtopics = await request(`/subtopics/${topicId ? "?topic_id=" + topicId : ""}`);
      const list = Array.isArray(subtopics) ? subtopics : [];
      showAdminView(`
        <div class="content">
          ${topicId ? '<button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>' : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${topicId ? escapeHtml(topicTitle) + " — " : ""}Subtopics</h2>
            <button class="btn btn-primary" id="add-subtopic-btn">+ Add Subtopic</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No subtopics yet</p></div>' :
              list.map(st => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(st.id)}" data-title="${escapeHtml(st.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <h3>${escapeHtml(st.title)}</h3>
                    ${deleteBtn(st.id, st.title, "/subtopics")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      if (topicId) document.getElementById("back-btn")?.addEventListener("click", backFn);
      document.getElementById("add-subtopic-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Subtopic</h3>
            <form id="create-subtopic-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              ${!topicId ? '<select class="input" name="topic_id" required><option value="">Select topic...</option></select>' : ""}
              <input class="input" name="title" placeholder="Subtopic title" required>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        if (!topicId) {
          request("/topics").then(tpcs => {
            const sel = document.querySelector('[name="topic_id"]');
            if (sel && Array.isArray(tpcs)) tpcs.forEach(t => { const o = document.createElement("option"); o.value = t.id; o.textContent = t.title; sel.appendChild(o); });
          });
        }
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-subtopic-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const tid = topicId || fd.get("topic_id");
          if (!title || !tid) { showToast("Title and topic are required"); return; }
          try {
            await request("/subtopics", { method: "POST", body: JSON.stringify({ title, topic_id: tid }) });
            loadAdminSubtopics(topicId, topicTitle, backFn);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminLessonsList(card.dataset.id, card.dataset.title, loadAdminSubtopics.bind(null, topicId, topicTitle, backFn));
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }

  async function loadAdminLessonsList(subtopicId, subtopicTitle, backFn) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      const lessons = await request(`/lessons/?subtopic_id=${subtopicId}&status=published`);
      const list = Array.isArray(lessons) ? lessons : [];
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(subtopicTitle)} — Lessons</h2>
            <button class="btn btn-primary" id="add-lesson-btn">+ Add Lesson</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No lessons yet</p></div>' :
              list.map(l => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(l.id)}">
                  <h3>${escapeHtml(l.title)}</h3>
                  <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status)}</p>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", backFn);
      document.getElementById("add-lesson-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Lesson</h3>
            <form id="create-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <input class="input" name="title" placeholder="Lesson title" required>
              <textarea class="input" name="content" rows="6" placeholder="Lesson content (HTML supported)"></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-lesson-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          try {
            await request("/lessons", { method: "POST", body: JSON.stringify({ title, slug, html_content: fd.get("content"), subtopic_id: subtopicId }) });
            loadAdminLessonsList(subtopicId, subtopicTitle, backFn);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", () => viewLessonContent("#admin-content", card.dataset.id, loadAdminLessonsList.bind(null, subtopicId, subtopicTitle, backFn)));
      });
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }