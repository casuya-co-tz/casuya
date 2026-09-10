// modules/student/lessons/interactions.js — wires student lesson view buttons & listeners.

function bindStudentLessonInteractions(d, ctx) {
  const { lessonId, isBookmarked, quizData } = ctx;

  const backBtn = document.getElementById("back-btn");
  if (ctx.iframeCtx) {
    backBtn.addEventListener("click", () => { ctx.iframeCtx.cleanup(); d.goBack(); });
  } else {
    backBtn.addEventListener("click", () => d.goBack());
  }

  const completeBtn = document.getElementById("complete-btn");
  if (completeBtn && ctx.iframeCtx?.studentId) {
    completeBtn.addEventListener("click", () => {
      request("/progress/sync", {
        method: "POST",
        body: JSON.stringify({ student_id: ctx.iframeCtx.studentId, lesson_id: lessonId, session_id: ctx.iframeCtx.sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: null }),
      }).then(() => {
        completeBtn.textContent = "Completed!";
        completeBtn.disabled = true;
        completeBtn.style.opacity = "0.6";
        showToast("Progress saved");
      }).catch(() => showToast("Failed to save progress"));
    });
  } else if (completeBtn) {
    completeBtn.style.display = "none";
  }

  document.getElementById("bookmark-btn").addEventListener("click", async () => {
    const btn = document.getElementById("bookmark-btn");
    if (isBookmarked) {
      await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
      btn.textContent = "☆";
    } else {
      await request(`/bookmarks/${lessonId}`, { method: "POST" });
      btn.textContent = "★";
    }
  });

  let noteTimer;
  document.getElementById("save-note").addEventListener("click", async () => {
    clearTimeout(noteTimer);
    const content = document.getElementById("lesson-note").value;
    await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
    showToast("Note saved");
  });

  document.getElementById("lesson-note").addEventListener("input", () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(async () => {
      const content = document.getElementById("lesson-note").value;
      await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
    }, 2000);
  });

  document.getElementById("quiz-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!quizData || !quizData.questions) return;
    const answers = {};
    quizData.questions.forEach(q => {
      const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
      if (sel) answers[q.id] = sel.value;
    });
    let work = null;
    try {
      if (window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.collectWorkMap) {
        work = window.CasuyaBlackboardEmbed.collectWorkMap("[data-quiz-question]");
      } else {
        work = {};
        document.querySelectorAll("[data-quiz-question]").forEach(el => {
          const qid = el.dataset.quizQuestion;
          const bb = el._casuyaBlackboard;
          if (bb && bb.getWorkSnapshot) work[qid] = bb.getWorkSnapshot();
          else if (bb && bb.getElements) { const els = bb.getElements(); work[qid] = { elements: els, hasWork: els.length>0, recognizedLatex: els.length>0?"__drawing__":"" }; }
        });
      }
      if (work && Object.keys(work).length === 0) work = null;
    } catch {}
    try {
      const body = work ? { answers, work } : { answers };
      const result = await request(`/quizzes/${quizData.id}/submit`, {
        method: "POST", body: JSON.stringify(body),
      });
      const el = document.getElementById("quiz-result");
      const combined = result.combined_percentage != null ? result.combined_percentage : result.percentage;
      const passed = combined >= 50;
      const hasWork = result.work_score != null;
      el.innerHTML = `
        <p style="color:${passed ? "var(--color-success)" : "var(--color-danger)"};font-weight:600">Score: ${result.score}/${result.total} (${Math.round(result.percentage)}%)</p>
        ${hasWork ? `<p style="font-size:0.85rem;color:var(--color-text-muted)">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · Combined (70/30): <strong>${Math.round(combined)}%</strong></p>` : ``}
        ${passed ? '<p style="color:var(--color-success)">Passed!</p>' : '<p style="color:var(--color-danger)">Try again</p>'}
        ${!passed ? '<button class="btn btn-sm btn-primary" id="retry-quiz-btn" style="margin-top:0.5rem">Retry Quiz</button>' : ''}
        ${hasWork && result.work_score < result.work_total ? '<p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.35rem">Tip: open "Show your work" to earn work credit.</p>' : ''}
      `;
      el.style.display = "block";
      if (!passed) {
        document.getElementById("retry-quiz-btn").addEventListener("click", () => {
          document.querySelectorAll('#quiz-form input[type="radio"]').forEach(r => r.checked = false);
          el.style.display = "none";
        });
      }
    } catch(err) {
      const el = document.getElementById("quiz-result");
      el.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`;
      el.style.display = "block";
    }
  });

  document.querySelectorAll(".game-item").forEach(item => {
    item.addEventListener("click", async () => {
      const area = document.getElementById("game-content-area");
      const gid = item.dataset.gameId;
      try {
        const resp = await fetch(`${API_BASE}/games/${gid}/content`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
        });
        if (resp.ok) {
          const html = await resp.text();
          area.innerHTML = `
            <iframe style="width:100%;border:none;min-height:300px" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>
            <div style="margin-top:0.75rem">
              <details>
                <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">✏️ Scratch Pad</summary>
                <div data-blackboard data-lesson-id="game-${gid}" style="width:100%;height:300px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
              </details>
            </div>
          `;
          if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
        }
      } catch(e) {}
    });
  });
}