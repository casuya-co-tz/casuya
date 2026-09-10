// modules/student/lessons/cache.js — next-lesson prefetch + recently viewed tracking.

function prefetchNextLesson(d, lessonId) {
  const idx = d._subtopicLessonList.findIndex((l) => l.id === lessonId);
  if (idx < 0 || idx + 1 >= d._subtopicLessonList.length) return;
  const next = d._subtopicLessonList[idx + 1];
  fetch(`${API_BASE}/lessons/${next.id}/content`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
  }).catch(() => {});
}

function recordRecentLesson(d, lessonId, lesson) {
  const recent = d.getRecentlyViewed();
  const exists = recent.findIndex(r => r.id === lessonId);
  if (exists >= 0) recent.splice(exists, 1);
  recent.unshift({ id: lessonId, title: lesson.title, viewedAt: Date.now() });
  if (recent.length > 20) recent.length = 20;
  d._recentlyViewedCache = recent;
  d._recentlyViewedCacheTs = Date.now();
  localStorage.setItem("casuya_recently_viewed", JSON.stringify(recent));
  request("/progress/activity", {
    method: "POST",
    body: JSON.stringify({ student_id: d.payload.id || d.payload.sub, lesson_id: lessonId, lesson_title: lesson.title }),
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
  prefetchNextLesson(d, lessonId);
}

function dropRecentLesson(d, lessonId) {
  const recent = d.getRecentlyViewed();
  const filtered = recent.filter(r => r.id !== lessonId);
  d._recentlyViewedCache = filtered;
  d._recentlyViewedCacheTs = Date.now();
  localStorage.setItem("casuya_recently_viewed", JSON.stringify(filtered));
}