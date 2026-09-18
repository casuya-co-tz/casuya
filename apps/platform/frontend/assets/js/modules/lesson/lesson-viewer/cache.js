// modules/lesson/lesson-viewer/cache.js — in-memory lesson content cache (LRU-ish).

const lessonContentCache = new Map();

function getCachedLessonContent(lessonId) {
  return lessonContentCache.get(lessonId) || null;
}

function lessonContentQuery(forceFull) {
  if (forceFull) return "";
  try {
    var t = navigator.connection && navigator.connection.effectiveType;
    if (t === "slow-2g" || t === "2g") return "?essential=1";
  } catch (e) {}
  return "";
}

function cacheLessonContent(lessonId, html) {
  lessonContentCache.set(lessonId, html);
  if (lessonContentCache.size > 50) {
    const key = lessonContentCache.keys().next().value;
    lessonContentCache.delete(key);
  }
  if (html && typeof putIdbLessonContent === "function") {
    putIdbLessonContent(lessonId, html);
  }
}

function dropCachedLessonContent(lessonId) {
  lessonContentCache.delete(lessonId);
}

function loadGameHtml(gameId) {
  if (!gameId) return Promise.resolve("");
  var key = "g:" + gameId;
  var mem = getCachedLessonContent(key);
  if (mem) return Promise.resolve(mem);
  var fromIdb = typeof getIdbLessonContent === "function"
    ? getIdbLessonContent(key)
    : Promise.resolve(null);
  return fromIdb.then(function (html) {
    if (html) {
      lessonContentCache.set(key, html);
      return html;
    }
    return fetch(`${API_BASE}/games/${gameId}/content`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
    }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (fetched) {
      if (fetched) cacheLessonContent(key, fetched);
      return fetched;
    }).catch(function () { return ""; });
  });
}

function loadLessonHtml(lessonId, forceFull) {
  const mem = getCachedLessonContent(lessonId);
  if (mem && !forceFull) return Promise.resolve(mem);
  const fromIdb = (!forceFull && typeof getIdbLessonContent === "function")
    ? getIdbLessonContent(lessonId)
    : Promise.resolve(null);
  return fromIdb.then(function (html) {
    if (html) {
      lessonContentCache.set(lessonId, html);
      return html;
    }
    return fetch(`${API_BASE}/lessons/${lessonId}/content${typeof lessonContentQuery === "function" ? lessonContentQuery(forceFull) : ""}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("casuya_token")}` },
    }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (fetched) {
      if (fetched) cacheLessonContent(lessonId, fetched);
      return fetched;
    }).catch(function () { return ""; });
  });
}