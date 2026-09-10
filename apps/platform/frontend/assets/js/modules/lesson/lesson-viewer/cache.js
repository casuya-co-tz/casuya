// modules/lesson/lesson-viewer/cache.js — in-memory lesson content cache (LRU-ish).

const lessonContentCache = new Map();

function getCachedLessonContent(lessonId) {
  return lessonContentCache.get(lessonId) || null;
}

function cacheLessonContent(lessonId, html) {
  lessonContentCache.set(lessonId, html);
  if (lessonContentCache.size > 50) {
    const key = lessonContentCache.keys().next().value;
    lessonContentCache.delete(key);
  }
}