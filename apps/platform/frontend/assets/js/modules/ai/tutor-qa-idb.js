// modules/ai/tutor-qa-idb.js — client-side tutor Q&A cache (Phase 3C, last 20).

var _tutorQaIdb = null;
var TUTOR_QA_IDB_NAME = "casuya-tutor-qa";
var TUTOR_QA_STORE = "answers";
var TUTOR_QUEUE_STORE = "queue";
var TUTOR_QA_MAX = 20;
var TUTOR_QA_IDB_VERSION = 2;

function tutorQaCacheKey(payload) {
  var parts = [
    String((payload && payload.question) || "").trim().toLowerCase(),
    String((payload && payload.lesson_id) || ""),
    String((payload && payload.subject_slug) || ""),
    String((payload && payload.form_level) || ""),
  ];
  return parts.join("|");
}

function openTutorQaIdb() {
  if (_tutorQaIdb) return _tutorQaIdb;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  _tutorQaIdb = new Promise(function (resolve) {
    try {
      var req = indexedDB.open(TUTOR_QA_IDB_NAME, TUTOR_QA_IDB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(TUTOR_QA_STORE)) {
          db.createObjectStore(TUTOR_QA_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) {
          db.createObjectStore(TUTOR_QUEUE_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    } catch (e) {
      resolve(null);
    }
  });
  return _tutorQaIdb;
}

function getTutorQaCache(key) {
  if (!key) return Promise.resolve(null);
  return openTutorQaIdb().then(function (db) {
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QA_STORE, "readonly");
        var req = tx.objectStore(TUTOR_QA_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function putTutorQaCache(key, row) {
  if (!key || !row || !row.response) return Promise.resolve();
  return openTutorQaIdb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QA_STORE, "readwrite");
        var store = tx.objectStore(TUTOR_QA_STORE);
        store.put({
          id: key,
          response: row.response,
          kbHits: row.kbHits || [],
          formatComplete: !!row.formatComplete,
          formatLevel: row.formatLevel || "none",
          source: row.source || "casuya-ai",
          ts: Date.now(),
        });
        store.getAll().onsuccess = function (ev) {
          var rows = ev.target.result || [];
          if (rows.length <= TUTOR_QA_MAX) return;
          rows.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
          var extra = rows.length - TUTOR_QA_MAX;
          for (var i = 0; i < extra; i++) {
            store.delete(rows[i].id);
          }
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

window.tutorQaCacheKey = tutorQaCacheKey;
window.getTutorQaCache = getTutorQaCache;
window.putTutorQaCache = putTutorQaCache;
