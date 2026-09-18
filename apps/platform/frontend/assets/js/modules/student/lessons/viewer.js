// modules/student/lessons/viewer.js — lesson viewer with iframe content, quiz,
// games, notes, blackboard, bookmarking, and progress tracking.

"use strict";

var _studentBbEmbedLoading = null;
function ensureStudentBlackboardEmbed() {
  if (window.CasuyaBlackboardEmbed) {
    window.CasuyaBlackboardEmbed.autoMount();
    return;
  }
  if (!_studentBbEmbedLoading) {
    _studentBbEmbedLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      var src = (typeof casuyaAssetUrl === "function")
        ? casuyaAssetUrl("/assets/js/blackboard-embed.js")
        : "/assets/js/blackboard-embed.js";
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }
  _studentBbEmbedLoading.then(function (ok) {
    if (ok && window.CasuyaBlackboardEmbed) window.CasuyaBlackboardEmbed.autoMount();
  });
}

function registerLessonsView(d) {
  async function viewStudentLesson(lessonId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>');
    try {
      let lesson, isBookmarked, noteData, quizData, gamesData, lessonContent;
      try {
        const cachedHtml = typeof getCachedLessonContent === "function" ? getCachedLessonContent(lessonId) : null;
        const contentFetch = cachedHtml
          ? Promise.resolve(cachedHtml)
          : (typeof loadLessonHtml === "function"
            ? loadLessonHtml(lessonId)
            : fetch(`${API_BASE}/lessons/${lessonId}/content`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
              }).then(r => r.ok ? r.text() : "").then((html) => {
                if (html && typeof cacheLessonContent === "function") cacheLessonContent(lessonId, html);
                return html;
              }).catch(() => ""));

        const pkg = await request(`/lessons/${lessonId}/package`);
        lesson = pkg.lesson;
        isBookmarked = pkg.bookmark_status?.bookmarked || false;
        noteData = pkg.note || { content: "" };
        quizData = pkg.quiz;
        gamesData = pkg.games || [];

        lessonContent = (await contentFetch) || "<p>No content</p>";
      } catch(e) {
        dropRecentLesson(d, lessonId);
        d.showView('<div class="empty-state"><p>This lesson is no longer available.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>');
        document.getElementById("back-to-overview")?.addEventListener("click", () => d.callView("dashboard"));
        return;
      }

      recordRecentLesson(d, lessonId, lesson);

      let lessonLang = "sw";

      d.showView(`
        <div data-lesson-lang="${escapeHtml(lessonLang)}">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <button class="btn" id="back-btn">← Back</button>
          <h2 style="flex:1">${escapeHtml(lesson.title)}</h2>
          <button id="bookmark-btn" class="btn-icon" style="font-size:1.5rem" title="Bookmark">${isBookmarked ? "★" : "☆"}</button>
          <button id="lesson-listen-btn" type="button" class="casuya-listen" data-lang="${escapeHtml(lessonLang)}" data-bound="student-lesson" title="Listen to this lesson" aria-label="Listen to this lesson">🔊 Listen</button>
          <button id="complete-btn" class="btn btn-primary" style="font-size:0.85rem">Mark Complete</button>
        </div>
        <div style="width:100%">
          <div id="lesson-runtime-mount" class="lesson-iframe" style="width:100%;min-height:300px"></div>
        </div>
        <div style="margin-top:0.75rem">
          <details>
            <summary style="cursor:pointer;font-weight:600;font-size:0.9rem;color:var(--color-text-muted)">📝 My Notes</summary>
            <div class="card" style="margin-top:0.5rem">
              <textarea id="lesson-note" class="input" rows="4" placeholder="Write your notes here...">${escapeHtml(noteData?.content || "")}</textarea>
              <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">
                <button class="btn btn-primary" id="save-note">Save Note</button>
                <button type="button" class="casuya-record" data-target="#lesson-note" data-append="true" title="Speak instead of typing" aria-label="Speak instead of typing">🎤 Voice</button>
              </div>
            </div>
          </details>
          ${renderStudentQuiz(quizData, lessonId, lessonLang)}
          ${renderStudentGames(gamesData)}
          <div class="card" style="margin-top:0.75rem;padding:1rem">
            <h3 style="margin:0 0 0.5rem">✏️ Practice Blackboard</h3>
            <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 0.5rem">Work out the steps below. Your progress is saved automatically.</p>
            <div data-blackboard data-lesson-id="${escapeHtml(lessonId)}" style="width:100%;height:420px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden"></div>
          </div>
        </div>
        </div>
      `);

      ensureStudentBlackboardEmbed();

      const mount = document.querySelector("#student-content .lesson-iframe");
      let iframeCtx = null;
      if (mount) {
        iframeCtx = await mountStudentLessonIframe(lessonId, lessonContent);
      }
      const iframe = iframeCtx && typeof iframeCtx.getIframe === "function"
        ? iframeCtx.getIframe()
        : (iframeCtx && iframeCtx.iframe);

      const iframeBody = iframe && typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : "";
      lessonLang = typeof casuyaResolveLessonLang === "function"
        ? casuyaResolveLessonLang(lesson.title, iframeBody, quizData?.questions?.[0]?.prompt)
        : (typeof casuyaDetectLang === "function"
          ? casuyaDetectLang(String(lesson.title || "") + " " + iframeBody)
          : "sw");
      const lessonRoot = document.querySelector("[data-lesson-lang]");
      if (lessonRoot) lessonRoot.setAttribute("data-lesson-lang", lessonLang);
      const lessonListenBtn = document.getElementById("lesson-listen-btn");
      if (lessonListenBtn) lessonListenBtn.setAttribute("data-lang", lessonLang);
      document.querySelectorAll(".question-block[data-lesson-lang], .quiz-item .casuya-listen[data-lang]").forEach(function (el) {
        el.setAttribute("data-lang", lessonLang);
        if (el.classList.contains("question-block")) el.setAttribute("data-lesson-lang", lessonLang);
      });

      const prefetchLessonTts = function () {
        if (typeof casuyaPrefetchTts !== "function") return;
        casuyaPrefetchTts((lesson.title + ". " + iframeBody).trim(), { lang: lessonLang });
        if (quizData && Array.isArray(quizData.questions)) {
          quizData.questions.forEach(function (q) {
            if (q && q.prompt) casuyaPrefetchTts(String(q.prompt), { lang: lessonLang });
          });
        }
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(prefetchLessonTts, { timeout: 6000 });
      } else {
        setTimeout(prefetchLessonTts, 2500);
      }

      if (lessonListenBtn && typeof casuyaSpeakText === "function") {
        lessonListenBtn.addEventListener("click", function () {
          const body = typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : iframeBody;
          casuyaSpeakText((lesson.title + ". " + body).trim(), { lang: lessonLang });
        });
      }

      bindStudentLessonInteractions(d, { lessonId, lesson, isBookmarked, noteData, quizData, gamesData, iframeCtx });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading lesson.</p><button class="btn btn-primary" id="back-to-overview">← Back to Overview</button></div>'); document.getElementById("back-to-overview")?.addEventListener("click", () => d.callView("dashboard")); }
  }

  d.registerView("lesson", viewStudentLesson);
}