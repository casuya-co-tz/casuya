// modules/student/lessons/iframe.js — student lesson iframe + progress messaging.

async function mountStudentLessonIframe(lessonId, lessonContent) {
  const iframe = document.querySelector("#student-content .lesson-iframe");
  iframe.srcdoc = injectNodeBase(lessonContent);
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

  const studentTokenPayload = decodeToken(localStorage.getItem("casuya_token"));
  let studentId = null;
  let sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  try {
    const me = await request("/students/me");
    if (me && me.id) studentId = me.id;
  } catch(e) {}
  const onMessage = (e) => {
    if (e.data?.type === "casuya-quiz" && e.data.score != null && e.data.total > 0) {
      const pct = Math.round((e.data.score / e.data.total) * 100);
      request("/progress/sync", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 100, score_percentage: pct }),
      }).catch(() => {});
    } else if (e.data?.type === "casuya-progress" && e.data.percent != null) {
      request("/progress/sync", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: e.data.percent }),
      }).catch(() => {});
    }
  };
  window.addEventListener("message", onMessage);

  if (studentId) {
    request("/progress/sync", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, session_id: sessionId, elapsed_ms: 0, completion_percentage: 10, score_percentage: null }),
    }).catch(() => {});
  }

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    clearInterval(poll);
    clearTimeout(poll);
  };

  return { iframe, studentId, sessionId, cleanup };
}