  async function loadAdminProgress() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');
    try {
      const [students, teachers, subjects, distribution] = await Promise.all([
        request("/students"),
        request("/teachers"),
        request("/subjects"),
        request("/analytics/lesson-distribution"),
      ]);

      const dist = Array.isArray(distribution) ? distribution : [];
      const lessonCount = dist.length;

      showAdminView(`
        <div class="content">
          <h2>Platform Progress</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-top:0.5rem">
            <div class="card" style="padding:0.75rem"><h4>Students</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(students) ? students.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Teachers</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(teachers) ? teachers.length : 0}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Lessons</h4><p style="font-size:1.6rem;font-weight:700">${lessonCount}</p></div>
            <div class="card" style="padding:0.75rem"><h4>Subjects</h4><p style="font-size:1.6rem;font-weight:700">${Array.isArray(subjects) ? subjects.length : 0}</p></div>
          </div>
          ${dist.length > 0 ? `
            <h3 style="margin-top:1.5rem">Lesson Distribution</h3>
            <div style="margin-top:0.5rem">
              ${dist.map(d => `
                <div style="margin-bottom:0.5rem">
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem">
                    <span style="font-size:0.85rem">${escapeHtml(d.lesson_title)}</span>
                    <span style="font-size:0.85rem;color:var(--color-text-muted)">${d.avg_completion_percentage}% (${d.session_count} sessions)</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-bar-fill" style="width:${d.avg_completion_percentage}%"></div>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : '<div class="empty-state" style="margin-top:1rem"><p>No lesson progress data yet. Have students started lessons?</p></div>'}
        </div>
      `);
    } catch (err) {
      showAdminView(`<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`);
    }
  }

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
              <button class="btn btn-primary" id="ai-generate-questions-btn">ðŸ¤– AI Generate Questions</button>
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
          <div class="card" style="margin-bottom:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">AI Generate Quiz Questions</h3>
            <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Paste lesson content to auto-generate quiz questions.</p>
            <form id="ai-gen-form" style="display:flex;flex-direction:column;gap:0.5rem">
              <textarea class="input" name="lesson_html" rows="8" placeholder="Paste lesson HTML content here..." required style="font-family:monospace;font-size:0.85rem"></textarea>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Questions:</label>
                <input class="input" type="number" name="count" value="5" min="1" max="20" style="width:80px">
                <button class="btn btn-primary" type="submit">Generate</button>
                <button class="btn" type="button" id="cancel-ai-gen">Cancel</button>
              </div>
            </form>
            <div id="ai-gen-result" style="margin-top:1rem;display:none">
              <div class="card" style="background:var(--color-bg);padding:1rem">
                <h4 style="margin:0 0 0.5rem">Generated Questions</h4>
                <pre id="ai-gen-text" style="font-size:0.85rem;line-height:1.5;white-space:pre-wrap;overflow-x:auto"></pre>
                <button class="btn btn-sm btn-primary" id="copy-ai-gen" style="margin-top:0.5rem">Copy to Clipboard</button>
              </div>
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
          textDiv.textContent = "Generating...";
          try {
            const result = await request("/ai/questions/generate", {
              method: "POST",
              body: JSON.stringify({ lesson_html: fd.get("lesson_html"), count: parseInt(fd.get("count")) || 5 }),
            });
            const questions = result?.questions || result;
            textDiv.textContent = typeof questions === "string" ? questions : JSON.stringify(questions, null, 2);
          } catch(err) { textDiv.textContent = "Error: " + err.message; }
        });
        document.getElementById("copy-ai-gen")?.addEventListener("click", () => {
          const text = document.getElementById("ai-gen-text").textContent;
          navigator.clipboard?.writeText(text).then(() => showToast("Copied!")).catch(() => {});
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
          iframe.srcdoc = html.replace("<head>", `<head><base href="${API_BASE}/">`);
          iframe.onload = () => {
            try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
          };
        }
      } catch(e) {}
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading lesson</p></div>'); }
  }

  async function loadAdminQuizzes() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading quizzes...</p></div>');
    try {
      const quizzes = await request("/quizzes/");
      const list = Array.isArray(quizzes) ? quizzes : [];
      const lessons = await request("/lessons/");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const lessonMap = {};
      lessonList.forEach(l => lessonMap[l.id] = l.title);
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Quizzes</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary" id="add-quiz-html-btn">+ HTML Quiz</button>
              <button class="btn btn-primary" id="add-quiz-btn">+ Builder Quiz</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No quizzes yet</p></div>' :
              list.map(q => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(q.id)}" data-title="${escapeHtml(q.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${escapeHtml(q.title)}</h3>
                        <span class="badge" style="background:var(--color-${q.status === "published" ? "success" : "warning"});color:#fff;padding:0.15rem 0.5rem;border-radius:var(--radius);font-size:0.75rem">${escapeHtml(q.status)}</span>
                      </div>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(lessonMap[q.lesson_id] || "Standalone")}</p>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${q.slug ? "HTML Quiz" : "Structured Quiz"}</p>
                    </div>
                    ${deleteBtn(q.id, q.title, "/quizzes")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          viewAdminQuiz(card.dataset.id, card.dataset.title);
        });
      });
      initDeleteButtons();
      document.getElementById("add-quiz-html-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New HTML Quiz</h3>
            <form id="create-quiz-html-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Quiz title" required>
              <textarea class="input" name="html_content" rows="8" placeholder="Paste or write full HTML quiz content..." required></textarea>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/lessons/").then(ls => {
          const sel = document.querySelector('[name="lesson_id"]');
          if (sel && Array.isArray(ls)) ls.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.title; sel.appendChild(o); });
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-quiz-html-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if (!fd.get("title") || !fd.get("html_content")) { showToast("Title and content are required"); return; }
          try {
            await request("/quizzes/from-html", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title: fd.get("title"), html_content: fd.get("html_content") }) });
            showToast("Quiz created!");
            loadAdminQuizzes();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.getElementById("add-quiz-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Builder Quiz</h3>
            <form id="create-quiz-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Quiz title" required>
              <div id="questions-area"></div>
              <button class="btn" type="button" id="add-question-btn" style="align-self:flex-start">+ Add Question</button>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary" type="submit">Save Quiz</button>
                <button class="btn" type="button" id="cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        `;
        request("/lessons/").then(ls => {
          const sel = document.querySelector('[name="lesson_id"]');
          if (sel && Array.isArray(ls)) ls.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.title; sel.appendChild(o); });
        });
        let qIdx = 0;
        function addQuestion() {
          const area = document.getElementById("questions-area");
          const i = qIdx++;
          const div = document.createElement("div");
          div.className = "card";
          div.style.cssText = "padding:0.75rem;margin-bottom:0.5rem";
          div.innerHTML = `
            <input class="input" name="q_text_${i}" placeholder="Question text" required style="margin-bottom:0.5rem">
            <input class="input" name="q_a_${i}" placeholder="Option A" required style="margin-bottom:0.25rem">
            <input class="input" name="q_b_${i}" placeholder="Option B" required style="margin-bottom:0.25rem">
            <input class="input" name="q_c_${i}" placeholder="Option C" style="margin-bottom:0.25rem">
            <input class="input" name="q_d_${i}" placeholder="Option D" style="margin-bottom:0.25rem">
            <select class="input" name="q_answer_${i}">
              <option value="A">Correct: A</option>
              <option value="B">Correct: B</option>
              <option value="C">Correct: C</option>
              <option value="D">Correct: D</option>
            </select>
          `;
          area.appendChild(div);
        }
        addQuestion();
        document.getElementById("add-question-btn").addEventListener("click", addQuestion);
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-quiz-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const questions = [];
          for (let i = 0; i < qIdx; i++) {
            const text = fd.get(`q_text_${i}`);
            if (!text) continue;
            questions.push({
              prompt: text,
              options: [
                { text: fd.get(`q_a_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "A" },
                { text: fd.get(`q_b_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "B" },
                { text: fd.get(`q_c_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "C" },
                { text: fd.get(`q_d_${i}`) || "", is_correct: fd.get(`q_answer_${i}`) === "D" },
              ]
            });
          }
          if (!fd.get("title")) { showToast("Title is required"); return; }
          try {
            await request("/quizzes", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title: fd.get("title"), questions }) });
            showToast("Quiz created!");
            loadAdminQuizzes();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading quizzes</p></div>'); }
  }

  async function viewAdminQuiz(quizId, quizTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading quiz...</p></div>');
    try {
      const quiz = await request(`/quizzes/${quizId}`);
      if (!quiz) return;
      let htmlContent = "";
      if (quiz.slug) {
        try {
          const resp = await fetch(`${API_BASE}/quizzes/${quizId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
          if (resp.ok) htmlContent = await resp.text();
        } catch(e) {}
      }
      let questionsHtml = "";
      if (!quiz.slug) {
        const fullQuiz = await request(`/quizzes/by-lesson/${quiz.lesson_id}`).catch(() => null);
        if (fullQuiz && Array.isArray(fullQuiz.questions)) {
          questionsHtml = fullQuiz.questions.map((q, i) => `
            <div class="card" style="padding:0.75rem;margin-bottom:0.5rem">
              <p style="font-weight:600;margin-bottom:0.5rem">${i + 1}. ${escapeHtml(q.prompt)}</p>
              ${q.options.map(o => `<p style="font-size:0.85rem;margin:0.15rem 0;padding-left:1rem">â€¢ ${escapeHtml(o.text)}</p>`).join("")}
            </div>
          `).join("");
        }
      }
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(quiz.title || quizTitle)}</h2>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span class="badge" style="background:var(--color-${quiz.status === "published" ? "success" : "warning"});color:#fff;padding:0.2rem 0.6rem;border-radius:var(--radius);font-size:0.8rem">${escapeHtml(quiz.status)}</span>
              ${quiz.status !== "published" ? `<button class="btn btn-primary" id="publish-btn">Publish</button>` : ""}
              <button class="btn" id="edit-btn">Edit</button>
            </div>
          </div>
          ${htmlContent ?
            `<div class="card" style="padding:0;overflow:hidden"><iframe id="quiz-frame" style="width:100%;border:none;display:block;min-height:500px"></iframe></div>` :
            questionsHtml ?
              `<div>${questionsHtml}</div>` :
              '<div class="empty-state"><p>No quiz content</p></div>'
          }
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminQuizzes);
      document.getElementById("publish-btn")?.addEventListener("click", async () => {
        try {
          await request(`/quizzes/${quizId}/publish`, { method: "POST" });
          showToast("Quiz published!");
          viewAdminQuiz(quizId, quizTitle);
        } catch(err) { showToast("Error: " + err.message); }
      });
      document.getElementById("edit-btn")?.addEventListener("click", () => {
        showAdminView(`
          <div class="content">
            <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
            <h2>Edit Quiz</h2>
            <div class="card" style="margin-top:1rem">
              <form id="edit-quiz-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <input class="input" name="title" value="${escapeHtml(quiz.title || "")}" required>
                <textarea class="input" name="content" rows="14" style="font-family:monospace">${escapeHtml(htmlContent)}</textarea>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `);
        document.getElementById("back-btn")?.addEventListener("click", () => viewAdminQuiz(quizId, quizTitle));
        document.getElementById("cancel-btn")?.addEventListener("click", () => viewAdminQuiz(quizId, quizTitle));
        document.getElementById("edit-quiz-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request(`/quizzes/${quizId}`, { method: "PUT", body: JSON.stringify({ title: fd.get("title"), html_content: fd.get("content") }) });
            showToast("Quiz updated!");
            viewAdminQuiz(quizId, quizTitle);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      if (htmlContent) {
        const iframe = document.getElementById("quiz-frame");
        iframe.srcdoc = htmlContent;
        iframe.onload = () => {
          try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
        };
      }
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading quiz</p></div>'); }
  }

