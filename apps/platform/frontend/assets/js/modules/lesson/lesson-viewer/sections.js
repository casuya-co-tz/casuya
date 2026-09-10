// modules/lesson/lesson-viewer/sections.js — lesson viewer page template.

function renderLessonSections({ lessonTitle, canBookmark, bookmarked, isStudent, quizData, gamesData, noteData, lessonId }) {
  return `
    <div class="content" style="max-width:100%;padding:0">
      <div style="padding:0.75rem 1rem;display:flex;align-items:center;gap:0.5rem;background:var(--color-surface);border-bottom:1px solid var(--color-border);flex-wrap:wrap">
        <button class="btn btn-primary lesson-back-btn" style="margin-bottom:0">&larr; Back</button>
        <span style="flex:1;font-weight:600;font-size:0.95rem">${escapeHtml(lessonTitle)}</span>
        ${canBookmark ? `
          <button class="btn btn-sm lesson-bookmark-btn" style="${bookmarked ? 'background:var(--color-warning);color:#fff' : ''};margin-bottom:0">${bookmarked ? "★" : "☆"}</button>
        ` : ""}
        ${isStudent ? `
          <button class="btn btn-success btn-sm lesson-complete-btn" style="margin-bottom:0">Mark Complete</button>
        ` : ""}
      </div>
      <div style="width:100%">
        <iframe class="lesson-iframe" style="width:100%;border:none;display:block"></iframe>
      </div>
      ${isStudent ? `
        <div style="padding:0 1rem">
          <details style="margin-top:0.75rem">
            <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
            <div style="margin-top:0.5rem">
              <textarea id="lesson-notes" rows="4" style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:var(--radius);font-size:0.85rem">${escapeHtml(noteData?.content || "")}</textarea>
              <button class="btn btn-sm btn-primary" id="notes-save-btn" style="margin-top:0.35rem">Save Notes</button>
              <span id="notes-status" style="font-size:0.8rem;color:var(--color-text-muted);margin-left:0.5rem"></span>
            </div>
          </details>
          ${renderLessonQuiz(quizData, lessonId)}
          ${renderLessonGames(gamesData)}
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
            <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}