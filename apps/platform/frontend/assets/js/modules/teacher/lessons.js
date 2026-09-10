// modules/teacher/lessons.js — lesson browser and bookmarks

async function loadLessons(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
  try {
    const [lessons, classroom] = await Promise.all([
      request("/lessons"),
      request("/classrooms/me").catch(() => null),
    ]);
    let drafts = [];
    try { drafts = JSON.parse(localStorage.getItem("casuya_teacher_drafts") || "[]"); } catch(e) {}
    const pubLessons = (Array.isArray(lessons) ? lessons : []).filter(l => l.status === "published");
    const lessonLimit = classroom?.lesson_limit ?? 2;
    const lessonLimitLine = `Published lessons: <b>${pubLessons.length}/${lessonLimit}</b>${pubLessons.length >= lessonLimit ? ' — limit reached. Ask an administrator to raise your allocation.' : ''}`;
    dashboard.showView(`
      <div class="content">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
          <h2>Lessons</h2>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-primary" id="publish-lesson-btn">＋ Publish Lesson</button>
            <button class="btn btn-sm" id="create-draft-btn">Create Draft</button>
          </div>
        </div>
        <div id="lesson-form-area"></div>
        <div id="draft-form-area"></div>
        ${lessonLimitLine ? `<p style="font-size:0.8rem;color:var(--color-text-muted);margin:0.5rem 0 0">${lessonLimitLine}</p>` : ""}
        ${drafts.length > 0 ? `
          <h3 style="margin:1.5rem 0 0.75rem">Your Drafts (${drafts.length})</h3>
          <div class="card-grid">
            ${drafts.map((d, i) => `
              <div class="card" style="padding:1rem">
                <div style="display:flex;justify-content:space-between;align-items:start">
                  <div>
                    <h4 style="margin:0">${escapeHtml(d.title)}</h4>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Created: ${new Date(d.createdAt).toLocaleDateString()}</p>
                    <p style="color:var(--color-text-muted);font-size:0.75rem;margin-top:0.15rem">Content: ${d.html_content.length} chars</p>
                  </div>
                  <div style="display:flex;gap:0.25rem">
                    <button class="btn btn-sm" data-view-draft="${i}">View</button>
                    <button class="btn btn-sm btn-danger" data-delete-draft="${i}">Delete</button>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ''}
        <h3 style="margin:1.5rem 0 0.75rem">Published Lessons</h3>
        <div class="card-grid">
          ${!Array.isArray(lessons) || lessons.length === 0 ? '<div class="empty-state"><p>No lessons yet</p></div>' :
            lessons.map(l => `
              <div class="card lesson-card clickable" data-id="${escapeHtml(l.id)}">
                <h3>${escapeHtml(l.title)}</h3>
                <p style="color:var(--color-text-muted)">${escapeHtml(l.status)}</p>
              </div>
            `).join("")}
        </div>
      </div>
    `);
    document.querySelectorAll("#teacher-content .lesson-card.clickable").forEach(el => {
      el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, () => loadLessons(dashboard)));
    });
    document.getElementById("create-draft-btn")?.addEventListener("click", () => {
      document.getElementById("draft-form-area").innerHTML = `
        <div class="card" style="margin-top:1rem;padding:1.5rem">
          <h3 style="margin-bottom:0.75rem">Create Lesson Draft</h3>
          <form id="draft-form" style="display:flex;flex-direction:column;gap:0.75rem">
            <div>
              <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Title</label>
              <input class="input" name="title" placeholder="Lesson title" required>
            </div>
            <div>
              <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">HTML Content</label>
              <textarea class="input" name="html_content" rows="12" placeholder="Write lesson content in HTML..." required style="font-family:monospace;font-size:0.85rem"></textarea>
            </div>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-success" type="submit">Save Draft</button>
              <button class="btn" type="button" id="cancel-draft">Cancel</button>
            </div>
          </form>
        </div>
      `;
      document.getElementById("cancel-draft").addEventListener("click", () => document.getElementById("draft-form-area").innerHTML = "");
      document.getElementById("draft-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        drafts.unshift({
          title: fd.get("title"),
          html_content: fd.get("html_content"),
          createdAt: Date.now(),
        });
        localStorage.setItem("casuya_teacher_drafts", JSON.stringify(drafts));
        loadLessons(dashboard);
      });
    });
    document.getElementById("publish-lesson-btn")?.addEventListener("click", async () => {
      if (pubLessons.length >= lessonLimit) {
        alert("You have reached your limit of " + lessonLimit + " published lessons. Ask an administrator to increase your allocation.");
        return;
      }
      try {
        const subjects = await request("/subjects");
        const subjList = Array.isArray(subjects) ? subjects : [];
        document.getElementById("lesson-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.5rem">Publish a Lesson</h3>
            <p style="font-size:0.8rem;color:var(--color-text-muted);margin:0 0 1rem">
              This lesson is published instantly to your connected students. Remaining allowance: <b>${lessonLimit - pubLessons.length}</b>.
            </p>
            <form id="publish-form" style="display:flex;flex-direction:column;gap:0.75rem">
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Title</label>
                <input class="input" name="title" placeholder="e.g. Introduction to Algebra" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Subject</label>
                <select class="input" id="pub-subject" required>
                  <option value="">Select subject...</option>
                  ${subjList.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Topic</label>
                <select class="input" id="pub-topic" required><option value="">Select subject first...</option></select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Subtopic</label>
                <select class="input" id="pub-subtopic" required><option value="">Select topic first...</option></select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Lesson Content (HTML)</label>
                <textarea class="input" name="html_content" rows="12" placeholder="Write lesson content in HTML..." required style="font-family:monospace;font-size:0.85rem"></textarea>
              </div>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit" id="publish-submit">Publish Lesson</button>
                <button class="btn" type="button" id="cancel-publish">Cancel</button>
              </div>
              <p id="publish-status" style="display:none;font-size:0.85rem;margin:0"></p>
            </form>
          </div>
        `;
        document.getElementById("cancel-publish").addEventListener("click", () => document.getElementById("lesson-form-area").innerHTML = "");
        const subjSel = document.getElementById("pub-subject");
        const topicSel = document.getElementById("pub-topic");
        const subtopicSel = document.getElementById("pub-subtopic");
        subjSel.addEventListener("change", async () => {
          topicSel.innerHTML = '<option value="">Loading...</option>';
          subtopicSel.innerHTML = '<option value="">Select topic first...</option>';
          if (!subjSel.value) { topicSel.innerHTML = '<option value="">Select subject first...</option>'; return; }
          try {
            const topics = await request(`/topics/?subject_id=${encodeURIComponent(subjSel.value)}`);
            const tList = Array.isArray(topics) ? topics : [];
            topicSel.innerHTML = '<option value="">Select topic...</option>' + tList.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`).join("");
          } catch(e) { topicSel.innerHTML = '<option value="">No topics found</option>'; }
        });
        topicSel.addEventListener("change", async () => {
          subtopicSel.innerHTML = '<option value="">Loading...</option>';
          if (!topicSel.value) { subtopicSel.innerHTML = '<option value="">Select topic first...</option>'; return; }
          try {
            const subs = await request(`/subtopics/?topic_id=${encodeURIComponent(topicSel.value)}`);
            const sList = Array.isArray(subs) ? subs : [];
            subtopicSel.innerHTML = '<option value="">Select subtopic...</option>' + sList.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`).join("");
          } catch(e) { subtopicSel.innerHTML = '<option value="">No subtopics found</option>'; }
        });
        document.getElementById("publish-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const status = document.getElementById("publish-status");
          status.style.display = "block";
          status.style.color = "var(--color-text-muted)";
          status.textContent = "Publishing lesson...";
          document.getElementById("publish-submit").disabled = true;
          try {
            await request("/lessons", {
              method: "POST",
              body: JSON.stringify({
                subtopic_id: subtopicSel.value,
                title: fd.get("title"),
                html_content: fd.get("html_content"),
              }),
            });
            status.style.color = "var(--color-success)";
            status.textContent = "Lesson published successfully!";
            setTimeout(() => loadLessons(dashboard), 1200);
          } catch(err) {
            status.style.color = "red";
            status.textContent = "Failed: " + err.message;
            document.getElementById("publish-submit").disabled = false;
          }
        });
      } catch(e) {
        alert("Could not load subjects: " + e.message);
      }
    });
    document.querySelectorAll("[data-view-draft]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.viewDraft);
        const draft = drafts[idx];
        dashboard.showView(`
          <div class="content">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
              <button class="btn" id="back-btn">← Back</button>
              <h2>${escapeHtml(draft.title)}</h2>
              <span style="font-size:0.75rem;padding:0.2rem 0.6rem;background:#fef3c7;color:#d97706;border-radius:var(--radius);font-weight:600">Draft</span>
            </div>
            <div class="lesson-viewer" id="draft-viewer"></div>
          </div>
        `);
        const viewer = document.getElementById("draft-viewer");
        if (viewer) {
          const iframe = document.createElement("iframe");
          iframe.style.cssText = "width:100%;min-height:600px;border:1px solid var(--color-border);border-radius:var(--radius);background:#fff";
          iframe.sandbox = "allow-same-origin";
          iframe.srcdoc = draft.html_content || "<p>No content</p>";
          viewer.appendChild(iframe);
        }
        document.getElementById("back-btn").addEventListener("click", () => loadLessons(dashboard));
      });
    });
    document.querySelectorAll("[data-delete-draft]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.deleteDraft);
        drafts.splice(idx, 1);
        localStorage.setItem("casuya_teacher_drafts", JSON.stringify(drafts));
        loadLessons(dashboard);
      });
    });
  } catch (err) {
    dashboard.showView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
  }
}

async function loadBookmarks(dashboard) {
  dashboard.showView('<div class="loading-state"><div class="spinner"></div><p>Loading bookmarks...</p></div>');
  try {
    const data = await request("/bookmarks/");
    const bookmarks = Array.isArray(data) ? data : [];
    if (bookmarks.length === 0) {
      dashboard.showView('<div class="content"><h2>Bookmarks</h2><div class="empty-state"><p>No bookmarks yet. Open a lesson and click ☆ to bookmark it.</p></div></div>');
      return;
    }
    dashboard.showView(`
      <div class="content">
        <h2>Bookmarks</h2>
        <div class="card-grid" style="margin-top:1rem">
          ${bookmarks.map(b => `
            <div class="card lesson-card clickable" data-id="${escapeHtml(b.lesson_id || b.id)}" style="position:relative">
              <h3>${escapeHtml(b.lesson_title || b.title || "Untitled")}</h3>
              <span style="position:absolute;top:0.5rem;right:0.5rem;font-size:0.75rem">🔖</span>
            </div>
          `).join("")}
        </div>
      </div>
    `);
    document.querySelectorAll("#teacher-content .lesson-card.clickable").forEach(el => {
      el.addEventListener("click", () => viewLessonContent("#teacher-content", el.dataset.id, () => loadBookmarks(dashboard)));
    });
  } catch(e) {
    dashboard.showView('<div class="content"><h2>Bookmarks</h2><div class="empty-state"><p>Error loading bookmarks</p></div></div>');
  }
}
