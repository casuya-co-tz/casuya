// modules/teacher/ai-assistant.js — AI tutoring tools

function teacherAiPrefs() {
  return {
    subject: localStorage.getItem("casuya_teacher_ai_subject") || "chemistry",
    form: localStorage.getItem("casuya_teacher_ai_form") || "2",
  };
}

function saveTeacherAiPrefs(subject, form) {
  if (subject) localStorage.setItem("casuya_teacher_ai_subject", subject);
  if (form) localStorage.setItem("casuya_teacher_ai_form", form);
}

async function loadAIAssistant(dashboard) {
  const prefs = teacherAiPrefs();
  dashboard.showView(`
    <div class="content">
      <h2>AI Assistant</h2>
      <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Use AI to help with teaching tasks.</p>
      <div style="display:grid;gap:1rem;margin-top:1.5rem">
        <div class="card" style="padding:1.5rem">
          <h3 style="margin-bottom:0.75rem">Tutoring Explanation</h3>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Get an AI explanation for a student question.</p>
          <form id="ai-tutor-form" style="display:flex;flex-direction:column;gap:0.5rem">
            <div style="display:flex;gap:0.5rem">
              <select class="input" name="subject_slug" style="flex:1">
                <option value="mathematics"${prefs.subject === "mathematics" ? " selected" : ""}>Mathematics</option>
                <option value="chemistry"${prefs.subject === "chemistry" ? " selected" : ""}>Chemistry</option>
                <option value="physics"${prefs.subject === "physics" ? " selected" : ""}>Physics</option>
              </select>
              <select class="input" name="form_level" style="flex:0.5">
                <option value="1"${prefs.form === "1" ? " selected" : ""}>Form I</option>
                <option value="2"${prefs.form === "2" ? " selected" : ""}>Form II</option>
                <option value="3"${prefs.form === "3" ? " selected" : ""}>Form III</option>
                <option value="4"${prefs.form === "4" ? " selected" : ""}>Form IV</option>
              </select>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:flex-start">
              <textarea class="input" name="question" rows="3" placeholder="Enter the student's question..." required style="flex:1"></textarea>
              <button type="button" class="casuya-record" title="Speak the question" aria-label="Speak the question">🎤 Voice</button>
            </div>
            <input class="input" name="context" placeholder="Optional lesson context...">
            <button class="btn btn-primary" type="submit">Get Explanation</button>
          </form>
          <div id="ai-tutor-result" style="margin-top:1rem;display:none">
            <div class="card" style="background:var(--color-bg);padding:1.25rem;border-radius:12px;border:1px solid var(--color-border)">
              <div id="ai-tutor-text" class="tutor-response"></div>
              <span id="ai-tutor-listen-slot"></span>
            </div>
          </div>
        </div>
        <div class="card" style="padding:1.5rem">
          <h3 style="margin-bottom:0.75rem">Generate Quiz Questions</h3>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Auto-generate quiz questions from lesson content.</p>
          <form id="ai-questions-form" style="display:flex;flex-direction:column;gap:0.5rem">
            <div style="display:flex;gap:0.5rem">
              <select class="input" name="subject_slug" style="flex:1">
                <option value="mathematics"${prefs.subject === "mathematics" ? " selected" : ""}>Mathematics</option>
                <option value="chemistry"${prefs.subject === "chemistry" ? " selected" : ""}>Chemistry</option>
                <option value="physics"${prefs.subject === "physics" ? " selected" : ""}>Physics</option>
              </select>
              <select class="input" name="form_level" style="flex:0.5">
                <option value="1"${prefs.form === "1" ? " selected" : ""}>Form I</option>
                <option value="2"${prefs.form === "2" ? " selected" : ""}>Form II</option>
                <option value="3"${prefs.form === "3" ? " selected" : ""}>Form III</option>
                <option value="4"${prefs.form === "4" ? " selected" : ""}>Form IV</option>
              </select>
            </div>
            <textarea class="input" name="lesson_html" rows="5" placeholder="Paste lesson content..." required></textarea>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <label style="font-size:0.85rem;color:var(--color-text-muted)">Number of questions:</label>
              <input class="input" type="number" name="count" value="5" min="1" max="20" style="width:80px">
            </div>
            <button class="btn btn-primary" type="submit">Generate Questions</button>
          </form>
          <div id="ai-questions-result" style="margin-top:1rem;display:none">
              <div id="ai-questions-text"></div>
          </div>
        </div>
        <div class="card" style="padding:1.5rem">
          <h3 style="margin-bottom:0.75rem">Translate Text</h3>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Translate text to another language.</p>
          <form id="ai-translate-form" style="display:flex;flex-direction:column;gap:0.5rem">
            <textarea class="input" name="text" rows="3" placeholder="Text to translate..." required></textarea>
            <select class="input" name="target_language">
              <option value="Swahili">Swahili</option>
              <option value="English">English</option>
              <option value="French">French</option>
              <option value="Arabic">Arabic</option>
              <option value="Spanish">Spanish</option>
            </select>
            <button class="btn btn-primary" type="submit">Translate</button>
          </form>
          <div id="ai-translate-result" style="margin-top:1rem;display:none">
            <div class="card" style="background:var(--color-bg);padding:1.25rem;border-radius:12px;border:1px solid var(--color-border)">
              <div id="ai-translate-text" class="tutor-response"></div>
              <span id="ai-translate-listen-slot"></span>
              <div id="ai-translate-footer" class="tutor-response-footer"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
  document.querySelectorAll("#ai-tutor-form select, #ai-questions-form select").forEach(function (sel) {
    sel.addEventListener("change", function () {
      saveTeacherAiPrefs(
        document.querySelector("#ai-tutor-form [name=subject_slug]")?.value
          || document.querySelector("#ai-questions-form [name=subject_slug]")?.value,
        document.querySelector("#ai-tutor-form [name=form_level]")?.value
          || document.querySelector("#ai-questions-form [name=form_level]")?.value,
      );
    });
  });
  document.getElementById("ai-tutor-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const resultDiv = document.getElementById("ai-tutor-result");
    const textDiv = document.getElementById("ai-tutor-text");
    resultDiv.style.display = "block";
    const payload = buildLessonTutorPayload({
      question: String(fd.get("question") || ""),
      subject_slug: fd.get("subject_slug"),
      form_level: parseInt(fd.get("form_level")) || 2,
      lessonContent: fd.get("context") || "",
    });
    runTutorQuery(payload, {
      container: textDiv,
      loadingLabel: "Thinking...",
      errorMessage: "The AI tutor could not be reached. Please try again.",
      listenSlot: document.getElementById("ai-tutor-listen-slot"),
      listenTitle: "Listen to this explanation",
    });
  });
  document.getElementById("ai-questions-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const resultDiv = document.getElementById("ai-questions-result");
    const textDiv = document.getElementById("ai-questions-text");
    resultDiv.style.display = "block";
    runAiGenerateTask({
      container: textDiv,
      loadingLabel: "Generating...",
      path: "/ai/questions/generate",
      body: {
        lesson_html: fd.get("lesson_html"),
        count: parseInt(fd.get("count")) || 5,
        subject_slug: fd.get("subject_slug"),
        form_level: parseInt(fd.get("form_level")) || 2,
      },
      render: function (result) {
        const questions = result?.questions || result;
        if (!Array.isArray(questions) || !questions.length) {
          return '<p style="color:var(--color-text-muted)">No questions generated. Try different content.</p>';
        }
        return renderQuizQuestions(questions, {
          subject: fd.get("subject_slug"),
          formLevel: fd.get("form_level"),
          topic: questions[0]?.topic || "",
        });
      },
    }).catch(function () {});
  });
  try {
    const profile = await request("/teachers/me");
    const subjects = String(profile?.subjects || "").toLowerCase();
    let subject = prefs.subject;
    if (subjects.includes("math")) subject = "mathematics";
    else if (subjects.includes("chem")) subject = "chemistry";
    else if (subjects.includes("phys")) subject = "physics";
    saveTeacherAiPrefs(subject, prefs.form);
    document.querySelectorAll('#ai-tutor-form [name=subject_slug], #ai-questions-form [name=subject_slug]').forEach(function (sel) {
      sel.value = subject;
    });
  } catch (e) {}

  document.getElementById("ai-translate-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const resultDiv = document.getElementById("ai-translate-result");
    const textDiv = document.getElementById("ai-translate-text");
    const footerDiv = document.getElementById("ai-translate-footer");
    resultDiv.style.display = "block";
    if (footerDiv) footerDiv.innerHTML = "";
    runAiGenerateTask({
      container: textDiv,
      loadingLabel: "Translating...",
      skipAutoFooter: true,
      path: "/ai/content/translate",
      body: { text: fd.get("text"), target_language: fd.get("target_language") },
      render: function (result) {
        const raw = result?.translated || result?.translatedText || result?.text || JSON.stringify(result);
        if (footerDiv) {
          footerDiv.innerHTML = typeof renderAiResultFooter === "function"
            ? renderAiResultFooter(result, raw)
            : renderAiSourceBadge(result?.source);
        }
        return renderTutorMarkdown(raw);
      },
      listenTitle: "Listen to translation",
    }).catch(function () {
      if (footerDiv) footerDiv.innerHTML = "";
    });
  });
}
