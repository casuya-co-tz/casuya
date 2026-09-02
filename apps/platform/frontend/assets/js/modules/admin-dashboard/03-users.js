  async function loadAdminGames() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading games...</p></div>');
    try {
      const games = await request("/games/");
      const list = Array.isArray(games?.items) ? games.items : [];
      const lessons = await request("/lessons/");
      const lessonList = Array.isArray(lessons) ? lessons : [];
      const lessonMap = {};
      lessonList.forEach(l => lessonMap[l.id] = l.title);
      showAdminView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>Games</h2>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary" id="add-game-html-btn">+ HTML Game</button>
              <button class="btn btn-primary" id="add-game-btn">+ Builder Game</button>
            </div>
          </div>
          <div id="form-area"></div>
          <div class="card-grid">
            ${list.length === 0 ? '<div class="empty-state"><p>No games yet</p></div>' :
              list.map(g => `
                <div class="card" style="cursor:pointer" data-id="${escapeHtml(g.id)}" data-title="${escapeHtml(g.title)}">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${escapeHtml(g.title)}</h3>
                        <span class="badge" style="background:var(--color-${g.status === "published" ? "success" : "warning"});color:#fff;padding:0.15rem 0.5rem;border-radius:var(--radius);font-size:0.75rem">${escapeHtml(g.status)}</span>
                      </div>
                      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${escapeHtml(lessonMap[g.lesson_id] || "Standalone")}</p>
                      <p style="color:var(--color-text-muted);font-size:0.85rem">${g.slug ? "HTML Game" : "Structured Game"}</p>
                    </div>
                    ${deleteBtn(g.id, g.title, "/games")}
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .card[data-id]").forEach(card => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-delete]")) return;
          viewAdminGame(card.dataset.id, card.dataset.title);
        });
      });
      initDeleteButtons();
      document.getElementById("add-game-html-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New HTML Game</h3>
            <form id="create-game-html-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Game title" required>
              <textarea class="input" name="html_content" rows="8" placeholder="Paste or write full HTML game content..." required></textarea>
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
        document.getElementById("create-game-html-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if (!fd.get("title") || !fd.get("html_content")) { showToast("Title and content are required"); return; }
          try {
            await request("/games/from-html", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title: fd.get("title"), html_content: fd.get("html_content") }) });
            showToast("Game created!");
            loadAdminGames();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      document.getElementById("add-game-btn")?.addEventListener("click", () => {
        document.getElementById("form-area").innerHTML = `
          <div class="card" style="margin-bottom:1rem">
            <h3>New Builder Game</h3>
            <form id="create-game-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
              <select class="input" name="lesson_id"><option value="">Select lesson (optional)...</option></select>
              <input class="input" name="title" placeholder="Game title" required>
              <div id="builder-questions">
                <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.5rem">Questions (add at least one)</p>
                <div class="builder-question" style="border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.5rem">
                  <input class="input" name="q_prompt_0" placeholder="Question text" required style="margin-bottom:0.5rem">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem">
                    <input class="input" name="q_opt0_0" placeholder="Option A" required>
                    <input class="input" name="q_opt1_0" placeholder="Option B" required>
                    <input class="input" name="q_opt2_0" placeholder="Option C" required>
                    <input class="input" name="q_opt3_0" placeholder="Option D" required>
                  </div>
                  <select class="input" name="q_correct_0" style="margin-top:0.35rem">
                    <option value="0">Correct: Option A</option>
                    <option value="1">Correct: Option B</option>
                    <option value="2">Correct: Option C</option>
                    <option value="3">Correct: Option D</option>
                  </select>
                </div>
              </div>
              <button type="button" class="btn btn-sm" id="add-question-btn">+ Add Question</button>
              <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
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
        let qIdx = 1;
        document.getElementById("add-question-btn").addEventListener("click", () => {
          const i = qIdx++;
          const div = document.createElement("div");
          div.className = "builder-question";
          div.style.cssText = "border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.5rem";
          div.innerHTML = `
            <input class="input" name="q_prompt_${i}" placeholder="Question text" required style="margin-bottom:0.5rem">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem">
              <input class="input" name="q_opt0_${i}" placeholder="Option A" required>
              <input class="input" name="q_opt1_${i}" placeholder="Option B" required>
              <input class="input" name="q_opt2_${i}" placeholder="Option C" required>
              <input class="input" name="q_opt3_${i}" placeholder="Option D" required>
            </div>
            <select class="input" name="q_correct_${i}" style="margin-top:0.35rem">
              <option value="0">Correct: Option A</option>
              <option value="1">Correct: Option B</option>
              <option value="2">Correct: Option C</option>
              <option value="3">Correct: Option D</option>
            </select>
          `;
          document.getElementById("builder-questions").appendChild(div);
        });
        document.getElementById("cancel-btn").addEventListener("click", () => document.getElementById("form-area").innerHTML = "");
        document.getElementById("create-game-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const title = fd.get("title");
          if (!title) { showToast("Title is required"); return; }
          const questions = [];
          document.querySelectorAll(".builder-question").forEach((_, idx) => {
            const prompt = fd.get(`q_prompt_${idx}`);
            if (!prompt) return;
            const options = [
              { text: fd.get(`q_opt0_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 0 },
              { text: fd.get(`q_opt1_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 1 },
              { text: fd.get(`q_opt2_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 2 },
              { text: fd.get(`q_opt3_${idx}`), is_correct: parseInt(fd.get(`q_correct_${idx}`)) === 3 },
            ];
            questions.push({ prompt, options });
          });
          if (questions.length === 0) { showToast("Add at least one question"); return; }
          try {
            await request("/games", { method: "POST", body: JSON.stringify({ lesson_id: fd.get("lesson_id") || null, title, questions }) });
            showToast("Game created!");
            loadAdminGames();
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading games</p></div>'); }
  }

  async function viewAdminGame(gameId, gameTitle) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>');
    try {
      const game = await request(`/games/${gameId}`);
      if (!game) return;
      let htmlContent = "";
      if (game.slug) {
        try {
          const resp = await fetch(`${API_BASE}/games/${gameId}/content`, { headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token") || ""}` } });
          if (resp.ok) htmlContent = await resp.text();
        } catch(e) {}
      }
      showAdminView(`
        <div class="content">
          <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2>${escapeHtml(game.title || gameTitle)}</h2>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span class="badge" style="background:var(--color-${game.status === "published" ? "success" : "warning"});color:#fff;padding:0.2rem 0.6rem;border-radius:var(--radius);font-size:0.8rem">${escapeHtml(game.status)}</span>
              ${game.status !== "published" ? `<button class="btn btn-primary" id="publish-btn">Publish</button>` : ""}
              <button class="btn" id="edit-btn">Edit</button>
            </div>
          </div>
          ${htmlContent ?
            `<div class="card" style="padding:0;overflow:hidden"><iframe id="game-frame" style="width:100%;border:none;display:block;min-height:500px"></iframe></div>` :
            '<div class="empty-state"><p>No game content</p></div>'
          }
        </div>
      `);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminGames);
      document.getElementById("publish-btn")?.addEventListener("click", async () => {
        try {
          await request(`/games/${gameId}/publish`, { method: "POST" });
          showToast("Game published!");
          viewAdminGame(gameId, gameTitle);
        } catch(err) { showToast("Error: " + err.message); }
      });
      document.getElementById("edit-btn")?.addEventListener("click", () => {
        showAdminView(`
          <div class="content">
            <button class="btn" id="back-btn" style="margin-bottom:1rem">&larr; Back</button>
            <h2>Edit Game</h2>
            <div class="card" style="margin-top:1rem">
              <form id="edit-game-form" style="display:flex;flex-direction:column;gap:0.5rem">
                <input class="input" name="title" value="${escapeHtml(game.title || "")}" required>
                <textarea class="input" name="content" rows="14" style="font-family:monospace">${escapeHtml(htmlContent)}</textarea>
                <div style="display:flex;gap:0.5rem">
                  <button class="btn btn-primary" type="submit">Save Changes</button>
                  <button class="btn" type="button" id="cancel-btn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `);
        document.getElementById("back-btn")?.addEventListener("click", () => viewAdminGame(gameId, gameTitle));
        document.getElementById("cancel-btn")?.addEventListener("click", () => viewAdminGame(gameId, gameTitle));
        document.getElementById("edit-game-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request(`/games/${gameId}`, { method: "PUT", body: JSON.stringify({ title: fd.get("title"), html_content: fd.get("content") }) });
            showToast("Game updated!");
            viewAdminGame(gameId, gameTitle);
          } catch(err) { showToast("Error: " + err.message); }
        });
      });
      if (htmlContent) {
        const iframe = document.getElementById("game-frame");
        iframe.srcdoc = injectNodeBase(htmlContent);
        iframe.onload = () => {
          try { iframe.style.height = Math.max(iframe.contentDocument.documentElement.scrollHeight, 400) + "px"; } catch(e) {}
        };
      }
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading game</p></div>'); }
  }

  async function loadAdminUsers() {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>');
    try {
      const [students, teachers] = await Promise.all([request("/students"), request("/teachers")]);
      const sList = Array.isArray(students?.items) ? students.items : [];
      const tList = Array.isArray(teachers?.items) ? teachers.items : [];
      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Users</h2>
            <button class="btn btn-primary" id="register-user-btn">+ Register User</button>
          </div>
          <div id="user-form-area"></div>

          <div class="section-header" style="margin-top:1.5rem">
            <h3>Students (${sList.length})</h3>
          </div>
          <div class="card-grid">
            ${sList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No students registered</p></div>' :
              sList.map(s => `
                <div class="card user-card" data-id="${escapeHtml(s.id || s.user_id)}" data-type="student" data-name="${escapeHtml(s.full_name || '')}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${escapeHtml((s.full_name || "S").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h4 style="margin:0;font-size:0.9rem">${escapeHtml(s.full_name || "Unnamed")}</h4>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.email || "")} ${s.form_level ? "· " + escapeHtml(s.form_level) : ""}</p>
                    </div>
                  </div>
                </div>
              `).join("")}
          </div>

          <div class="section-header" style="margin-top:1.5rem">
            <h3>Teachers (${tList.length})</h3>
          </div>
          <div class="card-grid">
            ${tList.length === 0 ? '<div class="empty-state" style="padding:2rem"><p>No teachers registered</p></div>' :
              tList.map(t => `
                <div class="card user-card" data-id="${escapeHtml(t.id || t.user_id)}" data-type="teacher" data-name="${escapeHtml(t.full_name || '')}" style="cursor:pointer">
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">${escapeHtml((t.full_name || "T").charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0">
                      <h4 style="margin:0;font-size:0.9rem">${escapeHtml(t.full_name || "Unnamed")}</h4>
                      <p style="margin:0.15rem 0 0;color:var(--color-text-muted);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.email || "")} ${t.subjects ? "· " + escapeHtml(t.subjects) : ""}</p>
                    </div>
                  </div>
                </div>
              `).join("")}
          </div>
        </div>
      `);
      document.querySelectorAll("#admin-content .user-card").forEach(card => {
        card.addEventListener("click", () => viewAdminUser(card.dataset.id, card.dataset.type, card.dataset.name));
      });
      document.getElementById("register-user-btn")?.addEventListener("click", () => {
        document.getElementById("user-form-area").innerHTML = `
          <div class="card" style="margin-top:1rem;padding:1.5rem">
            <h3 style="margin-bottom:0.75rem">Register New User</h3>
            <form id="register-user-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Full Name</label>
                <input class="input" name="full_name" placeholder="John Doe" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Email</label>
                <input class="input" type="email" name="email" placeholder="john@example.com" required>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Password</label>
                <input class="input" type="password" name="password" placeholder="Min 6 characters" required minlength="6">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Phone</label>
                <input class="input" name="phone" placeholder="+255...">
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Role</label>
                <select class="input" name="role" required>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--color-text-muted);display:block;margin-bottom:0.25rem">Form Level (Students)</label>
                <select class="input" name="form_level">
                  <option value="">N/A</option>
                  <option value="Form I">Form I</option>
                  <option value="Form II">Form II</option>
                  <option value="Form III">Form III</option>
                  <option value="Form IV">Form IV</option>
                  <option value="Form V">Form V</option>
                  <option value="Form VI">Form VI</option>
                </select>
              </div>
              <div style="grid-column:1/-1;display:flex;gap:0.5rem">
                <button class="btn btn-success" type="submit">Register</button>
                <button class="btn" type="button" id="cancel-register">Cancel</button>
              </div>
            </form>
            <div id="register-user-result" style="margin-top:0.75rem;font-size:0.85rem"></div>
          </div>
        `;
        document.getElementById("cancel-register").addEventListener("click", () => document.getElementById("user-form-area").innerHTML = "");
        document.getElementById("register-user-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await request("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                full_name: fd.get("full_name"),
                email: fd.get("email"),
                password: fd.get("password"),
                phone: fd.get("phone") || null,
                role: fd.get("role"),
                form_level: fd.get("form_level") || null,
              }),
            });
            document.getElementById("register-user-result").innerHTML = '<span style="color:var(--color-success)">User registered!</span>';
            setTimeout(() => loadAdminUsers(), 1000);
          } catch(err) {
            document.getElementById("register-user-result").innerHTML = `<span style="color:var(--color-danger)">${escapeHtml(err.message)}</span>`;
          }
        });
      });
    } catch(e) { showAdminView('<div class="empty-state"><p>Error loading users</p></div>'); }
  }

  async function viewAdminUser(userId, userType, userName) {
    showAdminView('<div class="loading-state"><div class="spinner"></div><p>Loading user...</p></div>');
    try {
      let userData = null;
      let progressData = [];
      if (userType === "student") {
        [userData, progressData] = await Promise.all([
          request(`/students/${userId}`).catch(() => null),
          request(`/progress/${userId}`).catch(() => []),
        ]);
      } else {
        userData = await request(`/teachers/${userId}`).catch(() => null);
      }

      const progressList = Array.isArray(progressData) ? progressData : [];
      const totalCompleted = progressList.filter(p => p.completion_percentage >= 100).length;
      const scores = progressList.filter(p => p.score_percentage != null && p.score_percentage > 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score_percentage, 0) / scores.length) : 0;

      showAdminView(`
        <div class="content" style="max-width:960px">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem">
            <button class="btn" id="back-btn">← Back</button>
            <h2>${escapeHtml(userName)}</h2>
            <span style="font-size:0.75rem;padding:0.2rem 0.6rem;background:${userType === "student" ? "#eff6ff" : "#f0fdf4"};color:${userType === "student" ? "#2563eb" : "#16a34a"};border-radius:var(--radius);font-weight:600">${userType === "student" ? "Student" : "Teacher"}</span>
          </div>

          <div class="card" style="margin-bottom:1rem">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem">
              <div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Name</div>
                <div style="font-size:0.9rem">${escapeHtml(userData?.full_name || "N/A")}</div>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Email</div>
                <div style="font-size:0.9rem">${escapeHtml(userData?.email || "N/A")}</div>
              </div>
              ${userData?.phone ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Phone</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.phone)}</div>
              </div>` : ""}
              ${userData?.form_level ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Form Level</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.form_level)}</div>
              </div>` : ""}
              ${userData?.subjects ? `<div>
                <div style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Subjects</div>
                <div style="font-size:0.9rem">${escapeHtml(userData.subjects)}</div>
              </div>` : ""}
            </div>
          </div>

          ${userType === "student" && progressList.length > 0 ? `
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-icon" style="background:#eff6ff;color:#2563eb">📚</div>
                <div class="stat-value">${progressList.length}</div>
                <div class="stat-label">Lessons Attempted</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#f0fdf4;color:#16a34a">✅</div>
                <div class="stat-value">${totalCompleted}</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon" style="background:#fef3c7;color:#d97706">📈</div>
                <div class="stat-value">${avgScore != null ? avgScore + "%" : "0%"}</div>
                <div class="stat-label">Avg Score</div>
              </div>
            </div>

            <div class="section-header">
              <h3>Progress by Subject</h3>
            </div>
            ${(() => {
              const bySubject = {};
              progressList.forEach(p => {
                const subj = p.subject_name || "General";
                if (!bySubject[subj]) bySubject[subj] = { total: 0, completed: 0 };
                bySubject[subj].total++;
                if (p.completion_percentage >= 100) bySubject[subj].completed++;
              });
              return Object.entries(bySubject).map(([name, data]) => {
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return `
                  <div class="card" style="margin-bottom:0.75rem">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                      <strong>${escapeHtml(name)}</strong>
                      <span style="font-size:0.85rem;color:var(--color-text-muted)">${data.completed}/${data.total} · ${pct}%</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join("");
            })()}
          ` : userType === "student" ? `
            <div class="empty-state" style="padding:2rem"><p>No progress data yet</p></div>
          ` : ""}

          ${userType === "teacher" ? `
            <div class="section-header" style="margin-top:1rem">
              <h3>Teacher Actions</h3>
            </div>
            <div class="card" style="padding:1rem">
              <p style="color:var(--color-text-muted);font-size:0.85rem">Teacher progress and class analytics are available in the teacher portal.</p>
            </div>
          ` : ""}
        </div>
      `);

      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    } catch (err) {
      showAdminView(`<div class="empty-state"><p>Error loading user details</p><button class="btn" id="back-btn">← Back</button></div>`);
      document.getElementById("back-btn")?.addEventListener("click", loadAdminUsers);
    }
  }

