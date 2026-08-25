  async function loadAdminOverview() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const overview = await request("/analytics/overview");
      const name = payload.full_name || payload.email || "Admin";

      // Greeting based on time
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17) greeting = "Good evening";

      showAdminView(`
        <div class="content" style="max-width:960px">
          <!-- Welcome Banner -->
          <div class="welcome-banner">
            <small>${greeting}</small>
            <h2>Welcome, ${escapeHtml(name)}</h2>
            <p>Here's your platform overview at a glance.</p>
          </div>

          <!-- Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon" style="background:#eff6ff;color:#2563eb">ðŸ‘¥</div>
              <div class="stat-value">${overview?.total_students ?? 0}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">ðŸ‘©â€ðŸ«</div>
              <div class="stat-value">${overview?.total_teachers ?? 0}</div>
              <div class="stat-label">Teachers</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef3c7;color:#d97706">ðŸ“</div>
              <div class="stat-value">${overview?.total_lessons ?? 0}</div>
              <div class="stat-label">Lessons</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fce7f3;color:#db2777">â“</div>
              <div class="stat-value">${overview?.total_quizzes ?? 0}</div>
              <div class="stat-label">Quizzes</div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="section-header">
            <h3>Quick Actions</h3>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem">
            <div class="recent-lesson-card" data-nav="subjects" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ“š</div>
              <h4 style="margin:0">Manage Subjects</h4>
            </div>
            <div class="recent-lesson-card" data-nav="lessons" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ“</div>
              <h4 style="margin:0">Manage Lessons</h4>
            </div>
            <div class="recent-lesson-card" data-nav="users" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ‘¥</div>
              <h4 style="margin:0">Manage Users</h4>
            </div>
            <div class="recent-lesson-card" data-nav="progress" style="text-align:center">
              <div style="font-size:1.5rem;margin-bottom:0.25rem">ðŸ“ˆ</div>
              <h4 style="margin:0">View Progress</h4>
            </div>
          </div>
        </div>
      `);

      // Wire up quick action clicks
      document.querySelectorAll("#admin-content .recent-lesson-card[data-nav]").forEach(el => {
        el.addEventListener("click", () => {
          const view = el.dataset.nav;
          if (navHandlers[view]) navHandlers[view]();
        });
      });
    } catch (err) {
      showAdminView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

  async function loadAdminSubjects() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const subjects = await request("/subjects");
      const list = Array.isArray(subjects) ? subjects : [];
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Subjects</h2>
            <button class="btn btn-primary" id="add-subject-btn">+ Add Subject</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No subjects yet</p></div>' :
              list.map(s => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(s.name)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(s.slug || "")}</p>
                    </div>
                    ${deleteBtn(s.id, s.name, "/subjects")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.getElementById("add-subject-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Subject</h3>
            <form id="create-subject-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <input class="input" name="name" placeholder="Subject name (e.g. Mathematics)" required>
              <input class="input" name="slug" placeholder="Slug (e.g. mathematics)" required>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-subject-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/subjects", { method: "POST", body: JSON.stringify({ name: fd.get("name"), slug: fd.get("slug") }) });
            loadAdminSubjects();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminTopics(card.dataset.id, card.dataset.name);
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }

  async function loadAdminTopics(subjectId, subjectName) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading topics...</p></div>');
    try {
      const topics = await request(`/topics/${subjectId ? "?subject_id=" + subjectId : ""}`);
      const list = Array.isArray(topics) ? topics : [];
      showAdminView(`
        <div class="content">
          ${subjectId ? '<button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>' : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${subjectId ? escapeHtml(subjectName) + " â€” " : ""}Topics</h2>
            <button class="btn btn-primary" id="add-topic-btn">+ Add Topic</button>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No topics yet</p></div>' :
              list.map(t => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(t.id)}" data-title="${escapeHtml(t.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(t.title)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">Form ${escapeHtml(t.form_level || "")}</p>
                    </div>
                    ${deleteBtn(t.id, t.title, "/topics")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      if (subjectId) document.getElementById("back-btn")?.addEventListener("click", loadAdminSubjects);
      document.getElementById("add-topic-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Topic</h3>
            <form id="create-topic-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              ${!subjectId ? '<select class="input" name="subject_id" required><option value="">Select subject...</option></select>' : ""}
              <input class="input" name="title" placeholder="Topic title" required>
              <select class="input" name="form_level">
                <option value="">Select form level...</option>
                ${["Form I","Form II","Form III","Form IV","Form V","Form VI"].map(f => '<option value="'+f+'">'+f+'</option>').join("")}
              </select>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        if (!subjectId) {
          request("/subjects").then(subs => {
            const sel = document.querySelector('[name="subject_id"]');
            if (sel && Array.isArray(subs)) subs.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
          });
        }
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-topic-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const sid = subjectId || fd.get("subject_id");
          if (!title || !sid) { showToast("Title and subject are required"); return; }
          try {
            await request("/topics", { method: "POST", body: JSON.stringify({ title, subject_id: sid, form_level: fd.get("form_level") || "" }) });
            loadAdminTopics(subjectId, subjectName);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          loadAdminSubtopics(card.dataset.id, card.dataset.title, loadAdminTopics.bind(null, subjectId, subjectName));
        });
      });
      initDeleteButtons();
    } catch (err) {
      showAdminView('<div class="empty-state"><h2>Error</h2><p>' + escapeHtml(err.message) + '</p></div>');
    }
  }

  async function loadAdminSubtopics(topicId, topicTitle, backFn) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading subtopics...</p></div>');
    try {
      const subtopics = await request(`/subtopics/${topicId ? "?topic_id=" + topicId : ""}`);
      const list = Array.isArray(subtopics) ? subtopics : [];
      showAdminView(`
        <div class="content">
          ${topicId ? '<button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>' : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${topicId ? escapeHtml(topicTitle) + " â€” " : ""}Subtopics</h2>
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
            <h2>${escapeHtml(subtopicTitle)} â€” Lessons</h2>
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

