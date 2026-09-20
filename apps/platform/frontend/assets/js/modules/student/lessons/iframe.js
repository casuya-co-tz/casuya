// modules/student/lessons/iframe.js — student lesson iframe + progress messaging.

async function mountStudentLessonIframe(lessonId, lessonContent) {
  const container = document.querySelector("#student-content .lesson-iframe");
  if (!container) return { iframe: null, studentId: null, sessionId: null, cleanup: function () {} };

  let handle = { cleanup: function () {}, getIframe: function () { return container.querySelector("iframe"); } };
  if (typeof mountLessonRuntime === "function") {
    handle = await mountLessonRuntime(container, lessonContent, { id: lessonId, title: "Lesson" });
  } else {
    const html = typeof injectBridgeScript === "function"
      ? injectBridgeScript(lessonContent)
      : lessonContent;
    if (container.tagName === "IFRAME") {
      container.srcdoc = injectNodeBase(html);
      handle.getIframe = function () { return container; };
    } else if (typeof mountGameSrcdoc === "function") {
      handle = mountGameSrcdoc(container, typeof injectNodeBase === "function" ? injectNodeBase(html) : html);
    }
  }

  let studentId = null;
  let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  try {
    const me = await request("/students/me");
    if (me && me.id) studentId = me.id;
  } catch(e) {}

  let progressTimer = null;
  const syncProgress = (body) => {
    if (!studentId) return;
    request("/progress/sync", {
      method: "POST",
      body: JSON.stringify(Object.assign({
        student_id: studentId,
        lesson_id: lessonId,
        session_id: sessionId,
        elapsed_ms: 0,
      }, body)),
    }).catch(() => {});
  };

  const onMessage = (e) => {
    if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
      const pct = Math.round((e.data.score / e.data.total) * 100);
      syncProgress({ completion_percentage: 100, score_percentage: pct });
    } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
      if (progressTimer) clearTimeout(progressTimer);
      const percent = e.data.percent;
      progressTimer = setTimeout(() => syncProgress({ completion_percentage: percent }), 2000);
    } else if (e.data?.type === "casuya-selection" && e.data.selected) {
      if (typeof openLessonAiChatExplain === "function") {
        openLessonAiChatExplain(e.data.selected, e.data.context || "");
      }
    }
  };
  window.addEventListener("message", onMessage);

  syncProgress({ completion_percentage: 10, score_percentage: null });

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    if (progressTimer) clearTimeout(progressTimer);
    if (handle && typeof handle.cleanup === "function") handle.cleanup();
  };

  return {
    iframe: handle.getIframe ? handle.getIframe() : null,
    getIframe: handle.getIframe,
    studentId,
    sessionId,
    cleanup,
  };
}
