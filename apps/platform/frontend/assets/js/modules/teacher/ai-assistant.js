// modules/teacher/ai-assistant.js — AI tutoring tools

async function loadAIAssistant(dashboard) {
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
                <option value="mathematics">Mathematics</option>
                <option value="biology" selected>Biology</option>
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
                <option value="2" selected>Form II</option>
                <option value="3">Form III</option>
                <option value="4">Form IV</option>
              </select>
            </div>
            <textarea class="input" name="question" rows="3" placeholder="Enter the student's question..." required></textarea>
            <input class="input" name="context" placeholder="Optional lesson context...">
            <button class="btn btn-primary" type="submit">Get Explanation</button>
          </form>
          <div id="ai-tutor-result" style="margin-top:1rem;display:none">
            <div class="card" style="background:var(--color-bg);padding:1.25rem;border-radius:12px;border:1px solid var(--color-border)">
              <div id="ai-tutor-text" class="tutor-response"></div>
            </div>
          </div>
        </div>
        <div class="card" style="padding:1.5rem">
          <h3 style="margin-bottom:0.75rem">Generate Quiz Questions</h3>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-bottom:0.75rem">Auto-generate quiz questions from lesson content.</p>
          <form id="ai-questions-form" style="display:flex;flex-direction:column;gap:0.5rem">
            <div style="display:flex;gap:0.5rem">
              <select class="input" name="subject_slug" style="flex:1">
                <option value="mathematics">Mathematics</option>
                <option value="biology">Biology</option>
                <option value="chemistry" selected>Chemistry</option>
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
                <option value="2" selected>Form II</option>
                <option value="3">Form III</option>
                <option value="4">Form IV</option>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
  document.getElementById("ai-tutor-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const resultDiv = document.getElementById("ai-tutor-result");
    const textDiv = document.getElementById("ai-tutor-text");
    resultDiv.style.display = "block";
    textDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Thinking...</div>';
    try {
      const result = await request("/ai/tutoring/explain", {
        method: "POST",
        body: JSON.stringify({
          question: fd.get("question"),
          subject_slug: fd.get("subject_slug"),
          form_level: parseInt(fd.get("form_level")) || 2,
          lesson_context: fd.get("context") || undefined,
        }),
      });
      const raw = result?.explanation || result?.answer || result?.response || JSON.stringify(result);
      textDiv.innerHTML = renderTutorMarkdown(raw);
    } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
  });
  document.getElementById("ai-questions-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const resultDiv = document.getElementById("ai-questions-result");
    const textDiv = document.getElementById("ai-questions-text");
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
  document.getElementById("ai-translate-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const resultDiv = document.getElementById("ai-translate-result");
    const textDiv = document.getElementById("ai-translate-text");
    resultDiv.style.display = "block";
    textDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Translating...</div>';
    try {
      const result = await request("/ai/content/translate", {
        method: "POST",
        body: JSON.stringify({ text: fd.get("text"), target_language: fd.get("target_language") }),
      });
      const raw = result?.translated || result?.translatedText || result?.text || JSON.stringify(result);
      textDiv.innerHTML = renderTutorMarkdown(raw);
    } catch(err) { textDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
  });
}
