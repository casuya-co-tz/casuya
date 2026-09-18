// modules/lesson/lesson-viewer/viewer.js — lesson viewer orchestrator.
// Extracted from modules/lesson-viewer.js; viewers for quiz/games, the bridge
// script and blackboard helpers live in modules/lesson/lesson-content.js.

async function viewLessonContent(containerId, lessonId, backFn) {
  const container = document.querySelector(containerId);
  if (!container) return;

  teardownCurrentIframe();

  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading lesson...</p></div>`;

  try {

    const token = localStorage.getItem("casuya_token");
    const payload = decodeToken(token);
    const isStudent = payload?.role === "student";
    const canBookmark = isStudent || payload?.role === "teacher";

    let htmlPromise = typeof loadLessonHtml === "function" ? loadLessonHtml(lessonId) : null;

    // Fetch lesson metadata + bookmark/quiz/games in ONE call (P2-3 aggregated endpoint)
    let lessonMeta = {};
    let pkgData = null;
    try {
      if (canBookmark) {
        pkgData = await request(`/lessons/${lessonId}/package`);
        lessonMeta = pkgData.lesson || {};
      } else {
        lessonMeta = await request(`/lessons/${lessonId}`);
      }
    } catch(e) {}
    const lessonTitle = lessonMeta.title || "Lesson";

    // Update recently viewed title
    let _recent = [];
    try {
      _recent = JSON.parse(localStorage.getItem("casuya_recently_viewed") || "[]");
      const idx = _recent.findIndex(r => r.id === lessonId);
      if (idx >= 0) { _recent[idx].title = lessonTitle; localStorage.setItem("casuya_recently_viewed", JSON.stringify(_recent)); }
    } catch(e) {}

    let html = htmlPromise ? await htmlPromise : "";
    if (!html) {
      const resp = await fetch(`${API_BASE}/lessons/${lessonId}/content${typeof lessonContentQuery === "function" ? lessonContentQuery() : ""}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("casuya_token")}` },
      });
      if (resp.status === 404) {
        const filtered = _recent.filter(r => r.id !== lessonId);
        localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
        container.innerHTML = '<div class="empty-state"><p>This lesson is no longer available.</p></div>';
        return;
      }
      if (!resp.ok) throw new Error("Failed to load lesson");
      html = await resp.text();
      if (typeof cacheLessonContent === "function") cacheLessonContent(lessonId, html);
    }
    if (!html) {
      const filtered = _recent.filter(r => r.id !== lessonId);
      localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
      container.innerHTML = '<div class="empty-state"><p>This lesson is no longer available.</p></div>';
      return;
    }

    const lessonStart = Date.now();
    let studentId = null;
    const sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    const state = { quizScoreSent: false, bookmarked: false, progressTimer: null };

    if (isStudent) {
      try {
        const me = await request("/students/me");
        if (me && me.id) studentId = me.id;
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
      if (completionPct <= state.lastSentCompletion && (scorePct == null || scorePct <= state.lastSentScore)) return;
      state.lastSentCompletion = Math.max(state.lastSentCompletion || 0, completionPct);
      if (scorePct != null) state.lastSentScore = Math.max(state.lastSentScore || -1, scorePct);
      if (state.progressTimer) clearTimeout(state.progressTimer);
      state.progressTimer = setTimeout(() => {
        const elapsed = Date.now() - lessonStart;
        request("/progress/sync", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            lesson_id: lessonId,
            session_id: sessionId,
            elapsed_ms: elapsed,
            completion_percentage: state.lastSentCompletion,
            score_percentage: state.lastSentScore >= 0 ? state.lastSentScore : null,
          }),
        }).then(() => showToast("Progress saved")).catch(() => {});
      }, 2000);
    }

    html = injectBridgeScript(html);

    // Use pkgData from the earlier aggregated call (P2-3) — no second request needed.
    let quizData = null;
    let gamesData = [];
    let noteData = { content: "" };
    if (pkgData) {
      state.bookmarked = pkgData.bookmark_status?.bookmarked || false;
      quizData = isStudent ? pkgData.quiz : null;
      gamesData = isStudent ? (pkgData.games || []) : [];
      noteData = isStudent ? (pkgData.note || { content: "" }) : { content: "" };
    }

    const initialLessonLang = typeof casuyaResolveLessonLang === "function"
      ? casuyaResolveLessonLang(lessonTitle, "", quizData?.questions?.[0]?.prompt)
      : (typeof casuyaDetectLang === "function"
        ? casuyaDetectLang(String(lessonTitle || "") + " " + String(quizData?.questions?.[0]?.prompt || ""))
        : "sw");

    container.innerHTML = renderLessonSections({
      lessonTitle, canBookmark, bookmarked: state.bookmarked, isStudent, quizData, gamesData, noteData, lessonId,
      lessonLang: initialLessonLang,
    });

    const iframe = mountLessonIframe(container, html);

    // Listen button: reads the lesson title + spoken content using the Casuya
    // TTS voice (browser voice fallback on failure / logged-out use).
    if (typeof casuyaAttachListen === "function") {
      const listenSlot = container.querySelector("#lesson-listen-slot");
      if (listenSlot) {
        const bodySample = typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : "";
        const lessonLang = typeof casuyaResolveLessonLang === "function"
          ? casuyaResolveLessonLang(lessonTitle, bodySample, quizData?.questions?.[0]?.prompt)
          : initialLessonLang;
        container.querySelectorAll(".question-block[data-lesson-lang], .quiz-item .casuya-listen[data-lang]").forEach(function (el) {
          el.setAttribute("data-lang", lessonLang);
          if (el.classList.contains("question-block")) el.setAttribute("data-lesson-lang", lessonLang);
        });
        casuyaAttachListen(listenSlot, {
          title: "Listen to this lesson",
          lang: lessonLang,
          textProvider: function () {
            const body = typeof casuyaIframeText === "function" ? casuyaIframeText(iframe) : "";
            return (lessonTitle + ". " + body).trim();
          }
        });
      }
    }

    const onMessage = (e) => {
      if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
        state.quizScoreSent = true;
        const pct = Math.round((e.data.score / e.data.total) * 100);
        sendProgress(100, pct);
      } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
        sendProgress(e.data.percent, null);
      }
    };
    window.addEventListener("message", onMessage);

    bindLessonInteractions({ container, iframe, lessonId, isStudent, canBookmark, quizData, state, showToast, sendProgress, onMessage, backFn });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}