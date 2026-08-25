// modules/lesson.js — extracted from main.js (classic script, shared global scope)
const lessonContentCache = new Map();

async function viewLessonContent(containerId, lessonId, backFn) {
  const container = document.querySelector(containerId);
  if (!container) return;
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>`;

  let html;
  if (lessonContentCache.has(lessonId)) {
    html = lessonContentCache.get(lessonId);
  }

  try {
    // Fetch lesson metadata for title
    let lessonMeta = {};
    try { lessonMeta = await request(`/lessons/${lessonId}`); } catch(e) {}
    const lessonTitle = lessonMeta.title || "Lesson";

    // Update recently viewed title
    try {
      const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      const idx = recent.findIndex(r => r.id === lessonId);
      if (idx >= 0) { recent[idx].title = lessonTitle; localStorage.setItem("casuya_recently_viewed", JSON.stringify(recent)); }
    } catch(e) {}

    if (!html) {
      const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      });
      if (resp.status === 404) {
        const recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
        const filtered = recent.filter(r => r.id !== lessonId);
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        container.innerHTML = '<div class="empty-state"><p>This lesson is no longer available.</p></div>';
        return;
      }
      if (!resp.ok) throw new Error("Failed to load lesson");
      html = await resp.text();
      lessonContentCache.set(lessonId, html);
      if (lessonContentCache.size > 50) {
        const key = lessonContentCache.keys().next().value;
        lessonContentCache.delete(key);
      }
    }

    const token = localStorage.getItem("casuya_token");
    const payload = decodeToken(token);
    const isStudent = payload?.role === "student";
    const canBookmark = isStudent || payload?.role === "teacher";
    const lessonStart = Date.now();
    let studentId = null;
    let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    let quizScoreSent = false;
    let lastSentCompletion = -1;
    let lastSentScore = -1;
    let progressTimer = null;

    if (isStudent) {
      try {
        const students = await request("/students");
        if (Array.isArray(students)) {
          const my = students.find(s => s.user_id === payload.sub || s.id === payload.sub);
          if (my) studentId = my.id || my.user_id;
        }
      } catch(e) {}
    }

    function showToast(msg) {
      let t = container.querySelector(".lesson-toast");
      if (!t) { t = document.createElement("div"); t.className = "lesson-toast"; t.style.cssText = "position:sticky;bottom:0;padding:0.5rem 1rem;background:var(--color-success);color:#fff;text-align:center;font-size:0.85rem;transition:opacity 0.3s;z-index:10"; container.appendChild(t); }
      t.textContent = msg; t.style.opacity = "1";
      clearTimeout(t._hide); t._hide = setTimeout(() => { t.style.opacity = "0"; }, 2500);
    }

    function sendProgress(completionPct, scorePct) {
      if (!isStudent || !studentId) return;
      if (completionPct <= lastSentCompletion && (scorePct == null || scorePct <= lastSentScore)) return;
      lastSentCompletion = Math.max(lastSentCompletion, completionPct);
      if (scorePct != null) lastSentScore = Math.max(lastSentScore, scorePct);
      if (progressTimer) clearTimeout(progressTimer);
      progressTimer = setTimeout(() => {
        const elapsed = Date.now() - lessonStart;
        request("/progress/sync", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            lesson_id: lessonId,
            session_id: sessionId,
            elapsed_ms: elapsed,
            completion_percentage: lastSentCompletion,
            score_percentage: lastSentScore >= 0 ? lastSentScore : null,
          }),
        }).then(() => showToast("Progress saved")).catch(() => {});
      }, 2000);
    }

    // Inject bridge script
    const bridgeScript = `
<script>
(function(){
  var scoreReported = false;
  window.casuya = window.casuya || {};
  window.casuya.reportScore = function(score, total) {
    parent.postMessage({type:'casuya-quiz', score:score, total:total}, '*');
    scoreReported = true;
  };
  window.casuya.reportProgress = function(pct) {
    parent.postMessage({type:'casuya-progress', percent:pct}, '*');
  };
  function detectScore() {
    if (scoreReported) return;
    var candidates = document.querySelectorAll('.score-big, .quiz-score, .final-score, .result-score, [class*=score]');
    for (var i = 0; i < candidates.length; i++) {
      var text = (candidates[i].textContent || '').trim();
      var m = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        var s = parseInt(m[1]), t = parseInt(m[2]);
        if (t > 0 && s <= t) {
          parent.postMessage({type:'casuya-quiz', score:s, total:t}, '*');
          scoreReported = true;
          return;
        }
      }
    }
  }
  function trackVideos(root) {
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      (function(v) {
        if (v.dataset.casuyaTracked) return;
        v.dataset.casuyaTracked = '1';
        var maxPct = 0;
        v.addEventListener('timeupdate', function() {
          if (v.duration) { var pct = Math.round((v.currentTime / v.duration) * 100); if (pct > maxPct) maxPct = pct; }
        });
        v.addEventListener('ended', function() { parent.postMessage({type:'casuya-video', percent:100}, '*'); });
        setInterval(function() { if (maxPct > 0) parent.postMessage({type:'casuya-progress', percent:Math.min(maxPct + 10, 100)}, '*'); }, 5000);
      })(videos[i]);
    }
  }
  function initBridge() {
    if (!document.body) { setTimeout(initBridge, 100); return; }
    trackVideos(document.body);
    detectScore();
    var obs = new MutationObserver(function() { detectScore(); trackVideos(document.body); });
    obs.observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBridge);
  else initBridge();
})();
<\/script>`;
    const bodyIdx = html.lastIndexOf("</body>");
    if (bodyIdx !== -1) {
      html = html.slice(0, bodyIdx) + bridgeScript + html.slice(bodyIdx);
    } else {
      html = html.replace("</html>", bridgeScript + "</html>");
    }

    // Fetch bookmark, quiz, games, notes in parallel
    let bookmarked = false;
    let quizData = null;
    let gamesData = [];
    let noteData = { content: "" };
    if (canBookmark) {
      try {
        [bookmarked, quizData, gamesData, noteData] = await Promise.all([
          request(`/bookmarks/${lessonId}/status`).then(r => r.bookmarked).catch(() => false),
          isStudent ? request(`/quizzes/by-lesson/${lessonId}`).catch(() => null) : null,
          isStudent ? request(`/games/by-lesson/${lessonId}`).catch(() => []) : [],
          isStudent ? request(`/notes/${lessonId}`).catch(() => ({ content: "" })) : { content: "" },
        ]);
      } catch(e) {}
    }

    const renderQuiz = () => {
      if (!quizData || !quizData.questions || quizData.questions.length === 0) return "";
      return `
        <div class="card" style="margin-top:1rem;padding:1rem">
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
    };

    const renderGames = () => {
      if (!Array.isArray(gamesData) || gamesData.length === 0) return "";
      return `
        <div class="card" style="margin-top:1rem;padding:1rem">
          <h3 style="margin:0 0 0.5rem">Games & Activities</h3>
          ${gamesData.map(g => `
            <div class="game-item" data-game-id="${escapeHtml(g.id)}" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);cursor:pointer">
              <span style="color:var(--color-primary)">${escapeHtml(g.title || "Game")}</span>
              <span style="color:var(--color-text-muted);font-size:0.8rem;margin-left:0.5rem">${escapeHtml(g.status || "draft")}</span>
            </div>
          `).join("")}
          <div id="game-content-area" style="margin-top:1rem"></div>
        </div>
      `;
    };

    container.innerHTML = `
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
            ${renderQuiz()}
            ${renderGames()}
            <div class="card" style="margin-top:0.75rem;padding:1rem">
              <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
              <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
              <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
            </div>
          </div>
        ` : ""}
      </div>
    `;

    const iframe = container.querySelector(".lesson-iframe");
    iframe.srcdoc = html.replace("<head>", `<head><base href="${API_BASE}/">`);
    let heightSet = false;
    const setHeight = () => {
      if (heightSet) return;
      try {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          iframe.style.height = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 300) + "px";
          heightSet = true;
        }
      } catch(e) {}
    };
    iframe.addEventListener("load", setHeight);
    const poll = setInterval(() => { setHeight(); if (heightSet) clearInterval(poll); }, 300);
    setTimeout(() => { clearInterval(poll); if (!heightSet) iframe.style.height = "800px"; }, 10000);

    const onMessage = (e) => {
      if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
        quizScoreSent = true;
        const pct = Math.round((e.data.score / e.data.total) * 100);
        sendProgress(100, pct);
      } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
        sendProgress(e.data.percent, null);
      }
    };
    window.addEventListener("message", onMessage);

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
            if (bookmarked) {
              await request(`/bookmarks/${lessonId}`, { method: "DELETE" });
              bookmarked = false; bmBtn.textContent = "☆"; bmBtn.style.background = "";
              showToast("Bookmark removed");
            } else {
              await request(`/bookmarks/${lessonId}`, { method: "POST" });
              bookmarked = true; bmBtn.textContent = "★"; bmBtn.style.background = "var(--color-warning)"; bmBtn.style.color = "#fff";
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
          quizScoreSent = true;
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
          area.innerHTML = `<iframe style="width:100%;min-height:400px;border:none;border-radius:var(--radius)" srcdoc="${escapeHtml(html)}"></iframe>`;
        } catch(err) {
          area.innerHTML = `<p style="color:var(--color-danger)">Error loading game: ${escapeHtml(err.message)}</p>`;
        }
      });
    });

    const backBtn = container.querySelector(".lesson-back-btn");
    backBtn.addEventListener("click", () => {
      if (isStudent && !quizScoreSent) sendProgress(80, null);
      window.removeEventListener("message", onMessage);
      backFn();
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}
