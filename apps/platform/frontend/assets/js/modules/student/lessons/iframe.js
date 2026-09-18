// modules/student/lessons/iframe.js — student lesson iframe + progress messaging.

async function mountStudentLessonIframe(lessonId, lessonContent) {
  const iframe = document.querySelector("#student-content .lesson-iframe");
  const html = typeof injectBridgeScript === "function"
    ? injectBridgeScript(lessonContent)
    : lessonContent;
  iframe.srcdoc = injectNodeBase(html);
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
    }
  };
  window.addEventListener("message", onMessage);

  syncProgress({ completion_percentage: 10, score_percentage: null });

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    clearInterval(poll);
    if (progressTimer) clearTimeout(progressTimer);
  };

  return { iframe, studentId, sessionId, cleanup };
}