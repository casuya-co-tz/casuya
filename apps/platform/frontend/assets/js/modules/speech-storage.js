// modules/speech-storage.js — IndexedDB persistence for TTS WAV cache + STT offline outbox.
// Mirrors packages/bridge/src/media/{audio,stt-outbox}.js for the vanilla JS frontend.

(function () {
  var DB_NAME = "casuya-speech";
  var DB_VERSION = 1;
  var STORE = "speech-data";
  var TTS_PREFIX = "tts:";
  var STT_PREFIX = "stt:";
  var STT_INDEX = "stt-index";

  var _dbPromise = null;

  function openDb() {
    if (_dbPromise) return _dbPromise;
    if (typeof indexedDB === "undefined") {
      _dbPromise = Promise.resolve(null);
      return _dbPromise;
    }
    _dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return _dbPromise;
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function () { resolve(req.result == null ? null : req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return null; });
  }

  function idbPut(key, value) {
    return openDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        var req = tx.objectStore(STORE).put(value, key);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return false; });
  }

  function idbDelete(key) {
    return openDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        var req = tx.objectStore(STORE).delete(key);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return false; });
  }

  function idbKeys() {
    return openDb().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return []; });
  }

  function ttsCacheKey(lang, speed, text) {
    return TTS_PREFIX + lang + "|" + speed + "|" + text;
  }

  function getCachedWav(lang, speed, text) {
    return idbGet(ttsCacheKey(lang, speed, text)).then(function (record) {
      return record && record.blob ? record.blob : null;
    });
  }

  function putCachedWav(lang, speed, text, blob) {
    return idbPut(ttsCacheKey(lang, speed, text), {
      blob: blob,
      cachedAt: Date.now(),
      byteSize: blob && blob.size ? blob.size : 0
    });
  }

  function evictTtsCache(maxBytes, maxAgeMs) {
    maxBytes = maxBytes || (50 * 1024 * 1024);
    maxAgeMs = maxAgeMs || (7 * 24 * 60 * 60 * 1000);
    var now = Date.now();
    return idbKeys().then(function (keys) {
      var ttsKeys = keys.filter(function (k) { return String(k).indexOf(TTS_PREFIX) === 0; });
      var tasks = ttsKeys.map(function (key) {
        return idbGet(key).then(function (record) {
          return { key: key, record: record };
        });
      });
      return Promise.all(tasks).then(function (entries) {
        var kept = [];
        entries.forEach(function (entry) {
          if (!entry.record) return;
          if (now - entry.record.cachedAt > maxAgeMs) {
            idbDelete(entry.key);
            return;
          }
          kept.push(entry);
        });
        kept.sort(function (a, b) { return a.record.cachedAt - b.record.cachedAt; });
        var total = kept.reduce(function (sum, e) { return sum + (e.record.byteSize || 0); }, 0);
        while (total > maxBytes && kept.length) {
          var oldest = kept.shift();
          total -= oldest.record.byteSize || 0;
          idbDelete(oldest.key);
        }
      });
    });
  }

  function readSttIndex() {
    return idbGet(STT_INDEX).then(function (ids) {
      return Array.isArray(ids) ? ids : [];
    });
  }

  function writeSttIndex(ids) {
    return idbPut(STT_INDEX, ids);
  }

  function enqueueStt(wavBlob, targetSelector, append, language) {
    var id = "stt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    return idbPut(STT_PREFIX + id, {
      blob: wavBlob,
      targetSelector: targetSelector || "",
      append: !!append,
      language: language === "en" ? "en" : language === "sw" ? "sw" : "",
      createdAt: Date.now()
    }).then(function () {
      return readSttIndex().then(function (ids) {
        ids.push(id);
        return writeSttIndex(ids).then(function () { return id; });
      });
    });
  }

  function listSttPending() {
    return readSttIndex().then(function (ids) {
      return Promise.all(ids.map(function (id) {
        return idbGet(STT_PREFIX + id).then(function (record) {
          if (!record) return null;
          return {
            id: id,
            blob: record.blob,
            targetSelector: record.targetSelector,
            append: !!record.append,
            language: record.language || "",
            createdAt: record.createdAt
          };
        });
      })).then(function (rows) {
        return rows.filter(Boolean).sort(function (a, b) { return a.createdAt - b.createdAt; });
      });
    });
  }

  function removeStt(id) {
    return idbDelete(STT_PREFIX + id).then(function () {
      return readSttIndex().then(function (ids) {
        return writeSttIndex(ids.filter(function (entry) { return entry !== id; }));
      });
    });
  }

  function drainSttOutbox(transcribeFn) {
    return listSttPending().then(function (pending) {
      var chain = Promise.resolve([]);
      pending.forEach(function (item) {
        chain = chain.then(function (results) {
          return transcribeFn(item.blob, item.language).then(function (text) {
            results.push({
              id: item.id,
              text: text,
              targetSelector: item.targetSelector,
              append: item.append
            });
            return removeStt(item.id).then(function () { return results; });
          }).catch(function () { return results; });
        });
      });
      return chain;
    });
  }

  window.__casuyaSpeechStorage = {
    ttsCacheKey: ttsCacheKey,
    getCachedWav: getCachedWav,
    putCachedWav: putCachedWav,
    evictTtsCache: evictTtsCache,
    enqueueStt: enqueueStt,
    drainSttOutbox: drainSttOutbox,
    listSttPending: listSttPending
  };

  try { evictTtsCache(); } catch (e) {}
})();
