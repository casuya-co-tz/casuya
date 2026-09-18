// modules/lesson/lesson-idb.js — durable lesson HTML cache for cross-origin APIs.
// Service workers cannot intercept Vercel → Railway fetches; IndexedDB can.
// Explicit Downloads pin rows so LRU eviction cannot drop them.

var _casuyaLessonIdb = null;
var LESSON_IDB_NAME = "casuya-lessons";
var LESSON_IDB_STORE = "html";
var LESSON_IDB_MAX = 30;
var LESSON_IDB_MAX_BYTES = 1500000;

function openLessonIdb() {
  if (_casuyaLessonIdb) return _casuyaLessonIdb;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  _casuyaLessonIdb = new Promise(function (resolve) {
    try {
      var req = indexedDB.open(LESSON_IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(LESSON_IDB_STORE)) {
          db.createObjectStore(LESSON_IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    } catch (e) {
      resolve(null);
    }
  });
  return _casuyaLessonIdb;
}

function getIdbLessonContent(lessonId) {
  if (!lessonId) return Promise.resolve(null);
  return openLessonIdb().then(function (db) {
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readonly");
        var req = tx.objectStore(LESSON_IDB_STORE).get(lessonId);
        req.onsuccess = function () {
          var row = req.result;
          resolve(row && row.html ? row.html : null);
        };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function putIdbLessonContent(lessonId, html, pinned) {
  if (!lessonId || !html || html.length > LESSON_IDB_MAX_BYTES) return Promise.resolve();
  return openLessonIdb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readwrite");
        var store = tx.objectStore(LESSON_IDB_STORE);
        var getReq = store.get(lessonId);
        getReq.onsuccess = function () {
          var prev = getReq.result;
          var isPinned = !!(pinned || (prev && prev.pinned));
          store.put({ id: lessonId, html: html, ts: Date.now(), pinned: isPinned });
          store.getAll().onsuccess = function (ev) {
            var rows = ev.target.result || [];
            if (rows.length <= LESSON_IDB_MAX) return;
            var unpinned = rows.filter(function (r) { return !r.pinned; })
              .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
            var extra = rows.length - LESSON_IDB_MAX;
            for (var i = 0; i < extra && i < unpinned.length; i++) {
              store.delete(unpinned[i].id);
            }
          };
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

function deleteIdbLessonContent(lessonId) {
  if (!lessonId) return Promise.resolve();
  return openLessonIdb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readwrite");
        tx.objectStore(LESSON_IDB_STORE).delete(lessonId);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

function listIdbLessonIds(pinnedOnly) {
  return openLessonIdb().then(function (db) {
    if (!db) return [];
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(LESSON_IDB_STORE, "readonly");
        var req = tx.objectStore(LESSON_IDB_STORE).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          if (pinnedOnly) rows = rows.filter(function (r) { return r && r.pinned; });
          resolve(rows.map(function (r) { return r.id; }).filter(Boolean));
        };
        req.onerror = function () { resolve([]); };
      } catch (e) {
        resolve([]);
      }
    });
  });
}
