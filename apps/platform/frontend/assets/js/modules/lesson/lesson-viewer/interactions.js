// modules/lesson/lesson-viewer/interactions.js — wires up all lesson-viewer buttons & listeners.

function bindLessonInteractions({ container, iframe, lessonId, isStudent, canBookmark, quizData, state, showToast, sendProgress, onMessage, backFn }) {
  if (isStudent) {
    const completeBtn = container.querySelector(".lesson-complete-btn");
    if (completeBtn) {
      completeBtn.addEventListener("click", () => {
        sendProgress(100, null);
        completeBtn.textContent = "✓ Complete!";
        completeBtn.disabled = true;
        completeBtn.style.opacity = "0.6";
      });
    }

    // Bookmark toggle
    const bmBtn = container.querySelector(".lesson-bookmark-btn");
    if (bmBtn) {
      bmBtn.addEventListener("click", async () => {
        try {
          if (state.bookmarked) {
            await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
            state.bookmarked = false; bmBtn.textContent = "☆"; bmBtn.style.background = "";
            showToast("Bookmark removed");
          } else {
            await request(`/bookmarks/${lessonId}`, { method: "POST" });
            state.bookmarked = true; bmBtn.textContent = "★"; bmBtn.style.background = "var(--color-warning)"; bmBtn.style.color = "#fff";
            showToast("Bookmarked!");
          }
        } catch(e) { showToast("Failed to update bookmark"); }
      });
    }

    // Notes save
    document.getElementById("notes-save-btn")?.addEventListener("click", async () => {
      const content = document.getElementById("lesson-notes")?.value || "";
      const status = document.getElementById("notes-status");
      try {
        await request(`/notes/${lessonId}`, { method: "PUT", body: JSON.stringify({ content }) });
        status.textContent = "Saved ✓";
        setTimeout(() => status.textContent = "", 2000);
      } catch(e) { status.textContent = "Failed to save"; }
    });

    // Quiz submission — now wired to Show your work blackboards
    document.getElementById("quiz-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("quiz-submit-btn");
      btn.disabled = true; btn.textContent = "Submitting...";
      const answers = {};
      if (quizData && quizData.questions) {
        quizData.questions.forEach(q => {
          const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
          if (sel) answers[q.id] = sel.value;
        });
      }
      // Collect Show your work snapshots per question
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
        el.style.display = "block";
        const pct = result.combined_percentage != null ? result.combined_percentage : result.percentage;
        const hasWork = result.work_score != null;
        el.innerHTML = `
          <p style="font-weight:600">Score: ${result.score} / ${result.total} (${Math.round(result.percentage)}%)</p>
          ${hasWork ? `<p style="font-size:0.85rem;color:var(--color-text-muted)">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · Combined (70% answer + 30% work): <strong>${Math.round(pct)}%</strong></p>` : ``}
          ${pct >= 50 ? '<p style="color:var(--color-success)">✅ Passed!</p>' : '<p style="color:red">❌ Try again</p>'}
          ${hasWork && result.work_score < result.work_total ? '<p style="font-size:0.8rem;color:var(--color-text-muted)">Tip: open "Show your work" on each question to earn work credit.</p>' : ''}
        `;
        sendProgress(100, pct);
        state.quizScoreSent = true;
      } catch(err) {
        document.getElementById("quiz-result").style.display = "block";
        document.getElementById("quiz-result").innerHTML = `<p style="color:red">Error: ${escapeHtml(err.message)}</p>`;
      }
      btn.disabled = false; btn.textContent = "Submit Quiz";
    });
  }

  // Mount blackboard (if embed script is present)
  if (window.CasuyaBlackboardEmbed) {
    window.CasuyaBlackboardEmbed.autoMount();
  }

  document.querySelectorAll(".game-item").forEach(item => {
    item.addEventListener("click", async () => {
      const gameId = item.dataset.gameId;
      const area = document.getElementById("game-content-area");
      if (!area) return;
      area.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading game...</p></div>';
      try {
        const resp = await fetch(`/games/${gameId}/content`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
        });
        if (!resp.ok) throw new Error("Failed to load game content");
        const html = await resp.text();
        area.innerHTML = `<iframe style="width:100%;min-height:400px;border:none;border-radius:var(--radius)" srcdoc="${escapeHtml(injectNodeBase(html))}"></iframe>`;
      } catch(err) {
        area.innerHTML = `<p style="color:var(--color-danger)">Error loading game: ${escapeHtml(err.message)}</p>`;
      }
    });
  });

  const backBtn = container.querySelector(".lesson-back-btn");
  backBtn.addEventListener("click", () => {
    if (isStudent && !state.quizScoreSent) sendProgress(80, null);
    window.removeEventListener("message", onMessage);
    if (state.progressTimer) clearTimeout(state.progressTimer);
    teardownCurrentIframe();
    backFn();
  });
}