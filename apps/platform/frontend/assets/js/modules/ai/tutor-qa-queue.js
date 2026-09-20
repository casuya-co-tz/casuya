// modules/ai/tutor-qa-queue.js — offline tutor question queue (Phase 4).

var TUTOR_QUEUE_STORE = "queue";
var _tutorQueueSyncing = false;

function openTutorQueueDb() {
  return typeof openTutorQaIdb === "function" ? openTutorQaIdb() : Promise.resolve(null);
}

function enqueueTutorQuestion(payload, callbacks) {
  callbacks = callbacks || {};
  return openTutorQueueDb().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction([TUTOR_QUEUE_STORE, "answers"], "readwrite");
        var store = tx.objectStore(TUTOR_QUEUE_STORE);
        if (!db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) {
          resolve(false);
          return;
        }
        var row = {
          id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          payload: payload,
          callbacksMeta: {
            loadingLabel: callbacks.loadingLabel || "",
          },
          ts: Date.now(),
          attempts: 0,
        };
        store.put(row);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (e) {
        resolve(false);
      }
    });
  });
}

function listTutorQueue() {
  return openTutorQueueDb().then(function (db) {
    if (!db || !db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) return [];
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QUEUE_STORE, "readonly");
        var req = tx.objectStore(TUTOR_QUEUE_STORE).getAll();
        req.onsuccess = function () {
          var rows = req.result || [];
          rows.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
          resolve(rows);
        };
        req.onerror = function () { resolve([]); };
      } catch (e) {
        resolve([]);
      }
    });
  });
}

function removeTutorQueueItem(id) {
  return openTutorQueueDb().then(function (db) {
    if (!db || !db.objectStoreNames.contains(TUTOR_QUEUE_STORE)) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(TUTOR_QUEUE_STORE, "readwrite");
        tx.objectStore(TUTOR_QUEUE_STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  });
}

function syncTutorQueue() {
  if (_tutorQueueSyncing || typeof navigator !== "undefined" && !navigator.onLine) {
    return Promise.resolve(0);
  }
  if (typeof runTutorQuery !== "function") return Promise.resolve(0);
  _tutorQueueSyncing = true;
  return listTutorQueue().then(function (rows) {
    if (!rows.length) {
      _tutorQueueSyncing = false;
      return 0;
    }
    var chain = Promise.resolve(0);
    rows.forEach(function (row) {
      chain = chain.then(function (count) {
        return new Promise(function (resolve) {
          var container = document.createElement("div");
          container.hidden = true;
          document.body.appendChild(container);
          runTutorQuery(row.payload, {
            container: container,
            loadingLabel: (row.callbacksMeta && row.callbacksMeta.loadingLabel) || "Syncing…",
            onComplete: function () {
              removeTutorQueueItem(row.id).finally(function () {
                container.remove();
                resolve(count + 1);
              });
            },
            onError: function () {
              container.remove();
              resolve(count);
            },
          });
        });
      });
    });
    return chain.finally(function () {
      _tutorQueueSyncing = false;
    });
  }).catch(function () {
    _tutorQueueSyncing = false;
    return 0;
  });
}

if (typeof window !== "undefined") {
  window.enqueueTutorQuestion = enqueueTutorQuestion;
  window.syncTutorQueue = syncTutorQueue;
  window.addEventListener("online", function () {
    syncTutorQueue();
  });
}
