  async function loadAdminLessons() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lessons...</p></div>');
    try {
      const lessons = await request("/lessons/");
      const list = Array.isArray(lessons) ? lessons : [];
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Lessons</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary" id="ai-generate-questions-btn">🤖 AI Generate Questions</button>
              <button class="btn btn-primary" id="add-lesson-btn">+ Add Lesson</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div id="ai-form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No lessons</p></div>' :
              list.map(l => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(l.id)}" data-title="${escapeHtml(l.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                      <h3>${escapeHtml(l.title)}</h3>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${escapeHtml(l.status||"")}</p>
                    </div>
                    ${deleteBtn(l.id, l.title, "/lessons")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          viewAdminLesson(card.dataset.id, card.dataset.title);
        });
      });
      initDeleteButtons();
      document.getElementById("add-lesson-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Lesson</h3>
            <form id="create-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="subtopic_id" required><option value="">Select subtopic...</option></select>
              <input class="input" name="title" placeholder="Lesson title" required>
              <textarea class="input" name="content" rows="6" placeholder="Lesson content (HTML supported)"></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/subtopics").then(subs => {
          const sel = document.querySelector('[name="subtopic_id"]');
          if (sel && Array.isArray(subs)) subs.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.title; sel.appendChild(o); });
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-lesson-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          try {
            await request("/lessons", { method: "POST", body: JSON.stringify({ title, slug, html_content: fd.get("content"), subtopic_id: fd.get("subtopic_id") }) });
            loadAdminLessons();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.getElementById("ai-generate-questions-btn")?.addEventListener("click", () => {
        document.getElementById("ai-form-area").innerHTML = `
          <div class="card" style="padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Generate Quiz Questions</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Auto-generate quiz questions from lesson content.</p>
            <form id="ai-gen-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <div style="display:flex;gap:0.5rem">
                <select class="input" name="subject_slug" style="flex:1">
                  <option value="mathematics">Mathematics</option>
                  <option value="biology">Biology</option>
                  <option value="chemistry">Chemistry</option>
                  <option value="physics">Physics</option>
                  <option value="english">English</option>
                  <option value="kiswahili">Kiswahili</option>
                  <option value="geography">Geography</option>
                  <option value="history">History</option>
                  <option value="historia-ya-tanzania-na-maadili">Historia ya Tanzania na Maadili</option>
                  <option value="bible_knowledge">Bible Knowledge</option>
                  <option value="business_studies">Business Studies</option>
                  <option value="computing">Computing</option>
                </select>
                <select class="input" name="form_level" style="flex:0.5">
                  <option value="1">Form I</option>
                  <option value="2">Form II</option>
                  <option value="3">Form III</option>
                  <option value="4">Form IV</option>
                </select>
              </div>
              <textarea class="input" name="lesson_html" rows="5" placeholder="Paste lesson content..." required></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Number of questions:</label>
                <input class="input" type="number" name="count" value="5" min="1" max="20" style="width:80px">
              </div>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Generate Questions</button>
                <button class="btn" type="button" id="cancel-ai-gen">Cancel</button>
              </div>
            </form>
            <div id="ai-gen-result" style="margin-top:1rem;display:none">
              <div id="ai-gen-text"></div>
            </div>
          </div>
        `;
        document.getElementById("cancel-ai-gen").addEventListener("click", () => document.getElementById("ai-form-area").innerHTML = "");
        document.getElementById("ai-gen-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const resultDiv = document.getElementById("ai-gen-result");
          const textDiv = document.getElementById("ai-gen-text");
          resultDiv.style.display = "block";
          textDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Generating...</div>';
          try {
            const result = await request("/ai/questions/generate", {
              method: "POST",
              body: JSON.stringify({
                lesson_html: fd.get("lesson_html"),
                count: parseInt(fd.get("count")) || 5,
                subject_slug: fd.get("subject_slug"),
                form_level: parseInt(fd.get("form_level")) || 2,
              }),
            });
            const questions = result?.questions || result;
            if (Array.isArray(questions) && questions.length) {
              textDiv.innerHTML = renderQuizQuestions(questions, {
                subject: fd.get("subject_slug"),
                formLevel: fd.get("form_level"),
                topic: questions[0]?.topic || "",
              });
              window.renderMath(textDiv);
            } else {
              textDiv.innerHTML = '<p style="color:var(--color-text-muted)">No questions generated. Try different content.</p>';
            }
          } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lessons</p></div>'); }
  }

  async function viewAdminLesson(lessonId, lessonTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      const lesson = await request(`/lessons/${lessonId}`);
      if (!lesson) return;
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(lesson.title || lessonTitle)}</h2>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span class="badge" style="background:var(--color-${lesson.status === "published" ? "success" : "warning"});color:#fff;padding:0.2rem 0.6rem;border-radius:var(--radius);font-size:0.8rem">${escapeHtml(lesson.status)}</span>
              ${lesson.status !== "published" ? `<button class="btn btn-primary" id="publish-btn">Publish</button>` : ""}
              <button class="btn" id="edit-btn">Edit</button>
            </div>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <iframe id="lesson-frame" style="width:100%;border:none;display:block;min-height:500px"></iframe>
          </div>
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminLessons);
      document.getElementById("publish-btn")?.addEventListener("click", async () => {
        try {
          await request(`/lessons/${lessonId}/publish`, { method: "POST" });
          showToast("Lesson published!");
          viewAdminLesson(lessonId, lessonTitle);
        } catch(err) { showToast("Error: " + err.message); }
      });
      document.getElementById("edit-btn")?.addEventListener("click", async () => {
        let currentHtml = "";
        try {
          const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
          if (resp.ok) currentHtml = await resp.text();
        } catch(e) {}
        showAdminView(`
          <div class="content">
            <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
            <h2>Edit Lesson</h2>
            <div class="card" style="margin-top:1rem">
              <form id="edit-lesson-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <input class="input" name="title" value="${escapeHtml(lesson.title || "")}" required>
                <textarea class="input" name="content" rows="14" style="font-family:monospace">${escapeHtml(currentHtml)}</textarea>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `);
        document.getElementById("back-btn")?.addEventListener("click", () => viewAdminLesson(lessonId, lessonTitle));
        document.getElementById("cancel-btn")?.addEventListener("click", () => viewAdminLesson(lessonId, lessonTitle));
        document.getElementById("edit-lesson-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request(`/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify({ title: fd.get("title"), html_content: fd.get("content") }) });
            showToast("Lesson updated!");
            viewAdminLesson(lessonId, lessonTitle);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      try {
        const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
        if (resp.ok) {
          const html = await resp.text();
          const iframe = document.getElementById("lesson-frame");
          iframe.srcdoc = injectNodeBase(html);
          iframe.onload = () => {
            try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
          };
        }
      } catch(e) {}
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lesson</p></div>'); }
  }
