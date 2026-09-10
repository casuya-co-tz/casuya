// modules/student/lessons/builders.js — quiz & games section builders for the student lesson view.

function renderStudentQuiz(quizData, lessonId) {
  if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
  return `
    <div class="card" style="margin-top:0.75rem;padding:1rem">
      <h3 style="margin:0 0 0.75rem">${escapeHtml(quizData.title || "Quiz")}</h3>
      <form id="quiz-form">
        ${quizData.questions.map((q, qi) => `
          <div style="margin-bottom:1rem">
            <p style="font-weight:600;margin:0 0 0.5rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
            ${q.options.map(o => `
              <label style="display:block;padding:0.3rem 0.5rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.25rem">
                <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required> ${escapeHtml(o.text)}
              </label>
            `).join("")}
            <details style="margin-top:0.5rem">
              <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
              <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}-${escapeHtml(q.id)}" data-quiz-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
            </details>
          </div>
        `).join("")}
        <button type="submit" class="btn btn-primary" id="quiz-submit-btn">Submit Quiz</button>
      </form>
      <div id="quiz-result" style="display:none;margin-top:0.75rem"></div>
    </div>
  `;
}

function renderStudentGames(gamesData) {
  if (!Array.isArray(gamesData) || gamesData.length === 0) return "";
  return `
    <div class="card" style="margin-top:0.75rem;padding:1rem">
      <h3 style="margin:0 0 0.5rem">Games & Activities</h3>
      ${gamesData.map(g => `
        <div class="game-item" data-game-id="${escapeHtml(g.id)}" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);cursor:pointer">
          <span style="color:var(--color-primary)">${escapeHtml(g.title || "Game")}</span>
        </div>
      `).join("")}
      <div id="game-content-area" style="margin-top:1rem"></div>
    </div>
  `;
}