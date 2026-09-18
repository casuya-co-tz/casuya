// modules/speech.js — shared speech engine.
//
// TTS: plays the Casuya Sherpa-ONNX voice (platform proxy /v1/audio/tts) when the
// user is logged in; falls back to the browser's speechSynthesis on public pages
// or when the API is unreachable. STT: mic recording -> WAV -> /v1/audio/stt ->
// transcribed text dropped into a target input/textarea/contenteditable.
//
// Binds two declarative controls anywhere in DOM (including content rendered
// later): .casuya-listen (speak data-speak / element text) and .casuya-record
// (voice type into data-target or the nearest input).

(function () {
  var API_AUTH_HEADER_KEY = null; // unused placeholder

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function authToken() {
    try { return localStorage.getItem("casuya_token"); } catch (e) { return null; }
  }

  function isAuthed() { return !!authToken(); }

  function toast(msg) {
    if (typeof showToast === "function") { showToast(msg); return; }
    try { alert(msg); } catch (e) {}
  }

  /* ── Language detection (English / Swahili) ─────────────────────────── */
  var SW_WORDS = ("habari hujambo mambo karibu asante sawa sema nini vipi kwa na ni si ya za "
    + "wa wala hata sasa hapana ndiyo kila siku wiki mwaka mtoto watoto mwanafunzi wanafunzi "
    + "mwalimu walimu somo masomo shule kitabu vitabu kalamu dawati kazi chakula kula soma "
    + "andika ongeza punguza hesabu idadi jina kitu maji nyumbani kwenda kuja taka niambie "
    + "nimeelewa sielewi tafadhali kahawa chai pesa bei soko sukari mchana jioni usiku asubuhi "
    + "leo kesho jana hapa huko kweli kuna aa eh sawasawa fanya mazoezi swala bado zamani mbele nyuma").split(/\s+/);
  var EN_WORDS = ("the and is are was were have has had do does did will would could should what when "
    + "where who why how which this that these those with from for not but about into each other some "
    + "than then there their they them your you our we him her his she he it its one two three answer "
    + "question lesson student teacher school read write listen speak english science mathematics").split(/\s+/);
  var SW_SET = {};
  var EN_SET = {};
  for (var i = 0; i < SW_WORDS.length; i++) SW_SET[SW_WORDS[i]] = true;
  for (var ei = 0; ei < EN_WORDS.length; ei++) EN_SET[EN_WORDS[ei]] = true;

  function preferredSpeechLang() {
    try {
      var saved = JSON.parse(localStorage.getItem("casuya_a11y"));
      if (saved && (saved.lang === "sw" || saved.lang === "en")) return saved.lang;
    } catch (e) {}
    try {
      var uiLang = localStorage.getItem("casuya_lang");
      if (uiLang === "sw" || uiLang === "en") return uiLang;
    } catch (e) {}
    return null;
  }

  function tokenizeWords(text) {
    var s = String(text || "").toLowerCase();
    try {
      return s.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(function (w) { return w.length > 0; });
    } catch (e) {
      return s.replace(/[^a-z\u00C0-\u024F\s]/gi, " ").split(/\s+/).filter(function (w) { return w.length > 0; });
    }
  }

  function detectLang(text, explicitLang) {
    if (explicitLang && explicitLang !== "auto" && (explicitLang === "sw" || explicitLang === "en")) {
      return explicitLang;
    }
    var pref = preferredSpeechLang();
    if (pref) return pref;
    var toks = tokenizeWords(text);
    var hits = 0;
    var enHits = 0;
    for (var j = 0; j < toks.length; j++) {
      if (SW_SET[toks[j]]) hits++;
      if (EN_SET[toks[j]]) enHits++;
    }
    if (hits >= 1 && hits >= enHits) return "sw";
    if (enHits >= 2 && enHits > hits) return "en";
    return "sw";
  }

  function resolveSttLang(button, target) {
    var explicit = button && button.getAttribute("data-lang");
    if (explicit && explicit !== "auto" && (explicit === "sw" || explicit === "en")) return explicit;
    var fromTarget = target && target.getAttribute && target.getAttribute("data-lang");
    if (fromTarget && fromTarget !== "auto" && (fromTarget === "sw" || fromTarget === "en")) return fromTarget;
    var ctx = target && target.closest && target.closest("[data-lesson-lang]");
    if (ctx) {
      var lessonLang = ctx.getAttribute("data-lesson-lang");
      if (lessonLang === "sw" || lessonLang === "en") return lessonLang;
    }
    var block = target && target.closest && target.closest(".question-block, .quiz-item, form, .lesson-section, [data-question]");
    if (block) {
      var listen = block.querySelector(".casuya-listen[data-speak], .casuya-listen[data-lang]");
      if (listen) {
        var listenLang = listen.getAttribute("data-lang");
        if (listenLang === "sw" || listenLang === "en") return listenLang;
        var speak = listen.getAttribute("data-speak");
        if (speak) return detectLang(speak);
      }
    }
    if (target && typeof target.placeholder === "string" && target.placeholder.trim()) {
      return detectLang(target.placeholder);
    }
    return detectLang("");
  }

  function isTtsActive() {
    if (_current) return true;
    try { return !!(_audio && !_audio.paused && !_audio.ended); } catch (e) { return false; }
  }

  function requiresHumanSpeech(btn) {
    return btn && btn.getAttribute("data-human-speech-only") === "true";
  }

  function humanSpeechBlocked() {
    if (isTtsActive()) return true;
    return _lastTtsEndedAt > 0 && (Date.now() - _lastTtsEndedAt) < HUMAN_SPEECH_COOLDOWN_MS;
  }

  function setAudioVolume(audio, vol) {
    if (!audio) return;
    try { audio.volume = Math.max(0, Math.min(1, vol)); } catch (e) {}
  }

  function fadeVolume(audio, from, to, ms, done) {
    if (!audio || ms <= 0) {
      setAudioVolume(audio, to);
      if (done) done();
      return;
    }
    var steps = 6;
    var i = 0;
    var timer = setInterval(function () {
      i++;
      setAudioVolume(audio, from + (to - from) * (i / steps));
      if (i >= steps) {
        clearInterval(timer);
        if (done) done();
      }
    }, Math.max(8, ms / steps));
  }

  /* ── TTS playback state ──────────────────────────────────────────────── */
  var TTS_MAX_CHARS = 1000;
  var STT_TARGET_RATE = 16000;
  var STT_MAX_MS = 30000;
  var STT_MAX_BYTES = 1048576;
  var _audio = null;
  var _current = null;
  var _ttsCache = new Map();
  var _speakSeq = 0;
  var _prefetchInflight = 0;
  var _prefetchMax = 2;
  var TTS_CROSSFADE_MS = 80;
  var HUMAN_SPEECH_COOLDOWN_MS = 2500;
  var _lastTtsEndedAt = 0;

  function speechStore() {
    return window.__casuyaSpeechStorage || null;
  }

  function splitIntoChunks(text, maxLen) {
    var t = String(text || "").trim();
    if (!t) return [];
    if (t.length <= maxLen) return [t];
    var chunks = [];
    var remaining = t;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      var cut = remaining.slice(0, maxLen);
      var idx = Math.max(
        cut.lastIndexOf(". "),
        cut.lastIndexOf("! "),
        cut.lastIndexOf("? "),
        cut.lastIndexOf("\n"),
        cut.lastIndexOf(" ")
      );
      var splitAt = maxLen;
      if (idx > maxLen * 0.5) {
        splitAt = remaining[idx] === "\n" ? idx + 1 : idx + 2;
      }
      if (splitAt > maxLen) splitAt = maxLen;
      var piece = remaining.slice(0, splitAt).trim();
      if (piece.length > maxLen) piece = piece.slice(0, maxLen);
      if (piece) chunks.push(piece);
      remaining = remaining.slice(splitAt).trim();
    }
    return chunks;
  }

  function findVoice(lang) {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices();
    var wantSw = lang === "sw";
    var preferred = wantSw
      ? ["sw-TZ", "sw-KE", "sw-UG", "sw", "en-TZ", "en-KE", "en-GB", "en-US"]
      : ["en-TZ", "en-KE", "en-UG", "en-GH", "en-ZA", "en-GB", "en-US"];
    for (var i = 0; i < preferred.length; i++) {
      var match = voices.filter(function (v) { return v.lang === preferred[i]; });
      if (match.length) return match[0];
    }
    if (wantSw) {
      for (var k = 0; k < voices.length; k++) {
        if (voices[k].lang.indexOf("sw") === 0) return voices[k];
      }
    }
    for (var j = 0; j < voices.length; j++) {
      if (voices[j].lang.indexOf("en") === 0) return voices[j];
    }
    return null;
  }

  function browserSpeak(text, options) {
    options = options || {};
    var noop = { stop: function () {}, pause: function () { return false; }, resume: function () { return false; } };
    if (!window.speechSynthesis) {
      if (options.onError) options.onError(new Error("Speech not supported in this browser"));
      return noop;
    }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var lang = options.lang && options.lang !== "auto" ? options.lang : detectLang(text, options.lang);
    var v = findVoice(lang);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = lang === "sw" ? "sw-TZ" : "en-TZ"; }
    u.rate = options.rate || 1;
    u.pitch = 1;
    u.volume = 1;
    u.onstart = function () { if (options.onStart) options.onStart(); };
    u.onend = function () { if (options.onEnd) options.onEnd(); };
    u.onerror = function () { if (options.onError) options.onError(new Error("Browser speech error")); };
    window.speechSynthesis.speak(u);
    return {
      mode: "browser",
      stop: function () { window.speechSynthesis.cancel(); if (options.onStop) options.onStop(); },
      pause: function () { if (window.speechSynthesis.speaking) { window.speechSynthesis.pause(); return true; } return false; },
      resume: function () { if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); return true; } return false; }
    };
  }

  function apiController(options) {
    return {
      mode: "api",
      stop: function () { casuyaStopAll(); if (options.onStop) options.onStop(); },
      pause: function () { if (_audio && !_audio.paused) { _audio.pause(); return true; } return false; },
      resume: function () { if (_audio && _audio.paused) { _audio.play().catch(function () {}); return true; } return false; }
    };
  }

  function playBlob(blob, playback) {
    playback = playback || {};
    if (_audio) { _audio.pause(); _audio.src = ""; _audio = null; }
    var url = URL.createObjectURL(blob);
    _audio = new Audio(url);
    if (playback.fadeIn) setAudioVolume(_audio, 0);
    _audio.onplay = function () {
      if (playback.fadeIn) fadeVolume(_audio, 0, 1, TTS_CROSSFADE_MS);
      if (playback.onPlay) playback.onPlay();
    };
    _audio.onended = function () {
      var finish = function () {
        URL.revokeObjectURL(url);
        _lastTtsEndedAt = Date.now();
        if (playback.onDone) playback.onDone();
      };
      if (playback.fadeOut && _audio) {
        fadeVolume(_audio, _audio.volume, 0, TTS_CROSSFADE_MS, finish);
        return;
      }
      finish();
    };
    _audio.onerror = function () {
      URL.revokeObjectURL(url);
      if (playback.onError) playback.onError(new Error("Audio playback failed"));
    };
    _audio.play().catch(function (err) {
      URL.revokeObjectURL(url);
      if (playback.onError) playback.onError(err);
    });
  }

  function rememberTtsBlob(lang, speed, chunk, blob) {
    var cacheKey = lang + "|" + speed + "|" + chunk;
    if (_ttsCache.size >= 24) _ttsCache.delete(_ttsCache.keys().next().value);
    _ttsCache.set(cacheKey, blob);
    var store = speechStore();
    if (store && store.putCachedWav) {
      store.putCachedWav(lang, speed, chunk, blob).catch(function () {});
    }
  }

  function fetchTtsBlob(chunk, lang, speed, mySeq, attempt) {
    attempt = attempt || 0;
    chunk = String(chunk || "").trim();
    if (chunk.length > TTS_MAX_CHARS) chunk = chunk.slice(0, TTS_MAX_CHARS);
    var cacheKey = lang + "|" + speed + "|" + chunk;
    if (_ttsCache.has(cacheKey)) {
      return Promise.resolve(_ttsCache.get(cacheKey));
    }
    var store = speechStore();
    var cached = store && store.getCachedWav
      ? store.getCachedWav(lang, speed, chunk).then(function (blob) {
        if (blob) {
          rememberTtsBlob(lang, speed, chunk, blob);
          return blob;
        }
        return null;
      })
      : Promise.resolve(null);

    return cached.then(function (idbBlob) {
      if (idbBlob) return idbBlob;
      if (mySeq !== undefined && mySeq !== _speakSeq) throw new Error("cancelled");
      return fetch(API_BASE + "/v1/audio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + authToken() },
        body: JSON.stringify({ text: chunk, lang: lang, speed: speed })
      }).then(function (resp) {
        if (resp.status === 429 && attempt < 2) {
          var waitMs = 1500 * (attempt + 1);
          return new Promise(function (resolve) {
            setTimeout(resolve, waitMs);
          }).then(function () {
            if (mySeq !== undefined && mySeq !== _speakSeq) throw new Error("cancelled");
            return fetchTtsBlob(chunk, lang, speed, mySeq, attempt + 1);
          });
        }
        if (!resp.ok) throw new Error("TTS unavailable (" + resp.status + ")");
        return resp.blob();
      }).then(function (blob) {
        if (blob && typeof blob.size === "number" && blob.size < 64) {
          throw new Error("TTS unavailable (empty audio)");
        }
        if (mySeq !== undefined && mySeq !== _speakSeq) throw new Error("cancelled");
        rememberTtsBlob(lang, speed, chunk, blob);
        return blob;
      });
    });
  }

  function casuyaPrefetchTts(text, options) {
    options = options || {};
    if (!isAuthed() || !text) return;
    var txt = String(text).trim();
    if (!txt) return;
    var lang = detectLang(txt, options.lang);
    var speed = options.rate || 1;
    splitIntoChunks(txt, TTS_MAX_CHARS).forEach(function (chunk) {
      if (_prefetchInflight >= _prefetchMax) return;
      _prefetchInflight++;
      fetchTtsBlob(chunk, lang, speed).then(function () {}, function () {}).then(function () {
        _prefetchInflight = Math.max(0, _prefetchInflight - 1);
      });
    });
  }

  function speakViaApi(chunks, lang, speed, fullText, options, mySeq) {
    var idx = 0;
    var started = false;
    var loading = false;

    function playNext() {
      if (mySeq !== _speakSeq) return;
      if (idx >= chunks.length) {
        if (options.onEnd) options.onEnd();
        return;
      }
      if (!loading) {
        loading = true;
        if (options.onLoading) options.onLoading();
      }
      fetchTtsBlob(chunks[idx], lang, speed, mySeq).then(function (blob) {
        if (mySeq !== _speakSeq) return;
        playBlob(blob, {
          fadeIn: idx > 0,
          fadeOut: idx < chunks.length - 1,
          onPlay: function () {
            if (!started) {
              started = true;
              if (options.onStart) options.onStart();
            }
          },
          onDone: function () {
            idx++;
            playNext();
          },
          onError: function (err) {
            if (options.onError) options.onError(err);
          }
        });
      }).catch(function (err) {
        if (mySeq !== _speakSeq || err.message === "cancelled") return;
        if (options.onError) options.onError(err);
        toast("Could not load audio for this section. Try Listen again.");
      });
    }

    playNext();
    return apiController(options);
  }

  function casuyaSpeakText(text, options) {
    options = options || {};
    var txt = typeof text === "string" ? text.trim() : "";
    if (!txt) {
      if (options.onEnd) options.onEnd();
      return { mode: "empty", stop: function () {}, pause: function () {}, resume: function () {} };
    }
    casuyaStopAll();
    var mySeq = _speakSeq;
    var lang = detectLang(txt, options.lang);
    var speed = options.rate || 1;

    if (isAuthed()) {
      var chunks = splitIntoChunks(txt, TTS_MAX_CHARS);
      _current = speakViaApi(chunks, lang, speed, txt, options, mySeq);
      return _current;
    }

    _current = browserSpeak(txt, options);
    return _current;
  }

  function casuyaStopAll() {
    _speakSeq++;
    if (_audio) { _audio.pause(); _audio.currentTime = 0; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    _current = null;
  }

  /* ── STT recording (mic -> WAV -> /v1/audio/stt) ─────────────────────── */
  var _rec = null;

  function encodeWav(chunks, sampleRate) {
    var total = 0;
    for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
    var buffer = new ArrayBuffer(44 + total * 2);
    var view = new DataView(buffer);
    function writeStr(offset, str) {
      for (var k = 0; k < str.length; k++) view.setUint8(offset + k, str.charCodeAt(k));
    }
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + total * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, total * 2, true);
    var offset = 44;
    for (var c = 0; c < chunks.length; c++) {
      var data = chunks[c];
      for (var s = 0; s < data.length; s++) {
        var sample = Math.max(-1, Math.min(1, data[s]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return buffer;
  }

  function setRecState(button, state) {
    if (!button) return;
    button.classList.toggle("recording", state === "recording");
    button.classList.toggle("processing", state === "processing");
    var label = button.getAttribute("data-label") || "Speak instead of typing";
    button.title = state === "recording" ? "Tap to stop and transcribe" : (state === "processing" ? "Transcribing..." : label);
    button.textContent = state === "recording" ? "🔴 Stop" : (state === "processing" ? "⏳" : "🎤");
  }

  function resolveRecordTarget(button) {
    var sel = button.getAttribute("data-target");
    if (sel) {
      var found = document.querySelector(sel);
      if (found) return found;
    }
    var parent = button.parentElement;
    if (parent) {
      var kids = parent.querySelectorAll("textarea, input[type='text'], input:not([type='radio']):not([type='checkbox']):not([type='submit']):not([type='button']), [contenteditable='true']");
      for (var i = 0; i < kids.length; i++) { if (kids[i] !== button) return kids[i]; }
    }
    var card = button.closest(".card, .exam-q, form");
    if (card) {
      var c = card.querySelector("textarea, input[type='text'], [contenteditable='true']");
      if (c) return c;
    }
    return null;
  }

  function maybeRefreshToken() {
    var token = authToken();
    if (token && typeof tokenNeedsRefresh === "function" && tokenNeedsRefresh(token) && typeof refreshAuthToken === "function") {
      return refreshAuthToken().catch(function () { return token; });
    }
    return Promise.resolve(token);
  }

  function applyTranscript(target, text, append) {
    if (!target || text == null) return;
    var out = String(text);
    if (append) {
      if (typeof target.value === "string" && target.value.trim()) {
        out = target.value.trim() + " " + out;
      } else if (target.isContentEditable && String(target.textContent || "").trim()) {
        out = String(target.textContent).trim() + " " + out;
      }
    }
    if (typeof target.value === "string") target.value = out;
    else if (target.isContentEditable) target.textContent = out;
    try { target.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
  }

  function targetSelectorFor(el) {
    if (!el || !el.id) return "";
    return "#" + el.id;
  }

  function resolveTargetSelector(sel) {
    if (!sel) return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  function postSttBlob(blob, lang) {
    return maybeRefreshToken().then(function (token) {
      var fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      if (lang && lang !== "auto" && (lang === "sw" || lang === "en")) fd.append("language", lang);
      return fetch(API_BASE + "/v1/audio/stt", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
        body: fd
      });
    }).then(function (resp) {
      if (!resp.ok) throw new Error("Voice transcription failed (" + resp.status + ")");
      return resp.json();
    }).then(function (data) {
      return (data && data.text) || "";
    });
  }

  function queueSttForLater(blob, target, append, lang) {
    var store = speechStore();
    if (!store || !store.enqueueStt) return Promise.resolve(false);
    return store.enqueueStt(blob, targetSelectorFor(target), append, lang).then(function () { return true; }).catch(function () { return false; });
  }

  function transcribe(blob, button, target, append, lang) {
    if (blob && blob.size > STT_MAX_BYTES) {
      setRecState(button, "idle");
      toast("Recording too large. Try a shorter clip.");
      return Promise.resolve("");
    }
    setRecState(button, "processing");
    return postSttBlob(blob, lang).then(function (text) {
      applyTranscript(target, text, append);
      setRecState(button, "idle");
      if (text) toast("Transcribed ✓");
      else toast("No speech detected. Try again.");
      return text;
    }).catch(function (err) {
      var offline = !navigator.onLine || (err && err.message && err.message.indexOf("Failed to fetch") >= 0);
      if (offline) {
        return queueSttForLater(blob, target, append, lang).then(function (queued) {
          setRecState(button, "idle");
          if (queued) toast("Saved offline — will transcribe when online.");
          else toast(err && err.message ? err.message : "Voice transcription failed");
          return "";
        });
      }
      setRecState(button, "idle");
      toast(err && err.message ? err.message : "Voice transcription failed");
      return "";
    });
  }

  function drainPendingStt() {
    if (!isAuthed()) return;
    var store = speechStore();
    if (!store || !store.drainSttOutbox) return;
    store.drainSttOutbox(function (blob, lang) { return postSttBlob(blob, lang); }).then(function (results) {
      if (!results || !results.length) return;
      results.forEach(function (item) {
        var target = resolveTargetSelector(item.targetSelector);
        applyTranscript(target, item.text || "", item.append);
      });
      toast("Offline voice notes transcribed ✓");
    }).catch(function () {});
  }

  function mergeFloatChunks(chunks) {
    var total = 0;
    for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
    var merged = new Float32Array(total);
    var offset = 0;
    for (var j = 0; j < chunks.length; j++) {
      merged.set(chunks[j], offset);
      offset += chunks[j].length;
    }
    return merged;
  }

  function resampleTo16kHz(floatChunks, sourceRate) {
    var merged = mergeFloatChunks(floatChunks);
    if (!merged.length) return Promise.resolve(merged);
    if (sourceRate === STT_TARGET_RATE) return Promise.resolve(merged);
    var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx) return Promise.resolve(merged);
    var frames = Math.ceil(merged.length * STT_TARGET_RATE / sourceRate);
    var offline = new OfflineCtx(1, frames, STT_TARGET_RATE);
    var buffer = offline.createBuffer(1, merged.length, sourceRate);
    buffer.copyToChannel(merged, 0);
    var src = offline.createBufferSource();
    src.buffer = buffer;
    src.connect(offline.destination);
    src.start(0);
    return offline.startRendering().then(function (rendered) {
      return rendered.getChannelData(0);
    }).catch(function () { return merged; });
  }

  function pickRecorderMime() {
    if (!window.MediaRecorder) return "";
    var types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  function mixToMono(decoded) {
    var len = decoded.length;
    var mono = new Float32Array(len);
    var channels = decoded.numberOfChannels;
    for (var c = 0; c < channels; c++) {
      var data = decoded.getChannelData(c);
      for (var i = 0; i < len; i++) mono[i] += data[i];
    }
    if (channels > 1) {
      for (var j = 0; j < len; j++) mono[j] /= channels;
    }
    return mono;
  }

  function decodeBlobTo16kWav(blob) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return Promise.reject(new Error("AudioContext unavailable"));
    var ctx = new Ctx();
    return blob.arrayBuffer().then(function (ab) {
      return ctx.decodeAudioData(ab);
    }).then(function (decoded) {
      var mono = decoded.numberOfChannels > 1 ? mixToMono(decoded) : decoded.getChannelData(0);
      return resampleTo16kHz([mono], decoded.sampleRate);
    }).then(function (samples) {
      try { ctx.close(); } catch (e) {}
      var buffer = encodeWav([samples], STT_TARGET_RATE);
      return new Blob([buffer], { type: "audio/wav" });
    }).catch(function (err) {
      try { ctx.close(); } catch (e) {}
      throw err;
    });
  }

  function cleanupRecording(rec) {
    if (rec.timer) { clearTimeout(rec.timer); rec.timer = null; }
    try { if (rec.processor) rec.processor.disconnect(); } catch (e) {}
    try { if (rec.ctx) rec.ctx.close(); } catch (e) {}
    try { if (rec.stream) rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
  }

  function finishWavTranscription(wavBlob, button, target, append, lang) {
    if (!wavBlob || !wavBlob.size) {
      setRecState(button, "idle");
      toast("No audio captured.");
      return;
    }
    transcribe(wavBlob, button, target, append, lang);
  }

  function stopRecordingTranscribe(btn, target) {
    if (!_rec) return;
    var rec = _rec;
    _rec = null;
    var button = btn || rec.button;
    var tgt = target || rec.target;
    var append = !!rec.append;
    var lang = rec.lang || "sw";

    if (rec.mode === "mediarecorder") {
      if (rec.timer) { clearTimeout(rec.timer); rec.timer = null; }
      var recorder = rec.recorder;
      recorder.onstop = function () {
        try { rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        var parts = rec.parts.filter(function (p) { return p && p.size; });
        if (!parts.length) { setRecState(button, "idle"); toast("No audio captured."); return; }
        var encoded = new Blob(parts, { type: recorder.mimeType || "audio/webm" });
        decodeBlobTo16kWav(encoded).then(function (wavBlob) {
          finishWavTranscription(wavBlob, button, tgt, append, lang);
        }).catch(function () {
          setRecState(button, "idle");
          toast("Could not process audio.");
        });
      };
      try { recorder.stop(); } catch (e) {
        setRecState(button, "idle");
        toast("Could not stop recording.");
      }
      return;
    }

    cleanupRecording(rec);
    var chunks = rec.chunks.filter(function (c) { return c.length > 0; });
    if (!chunks.length) { setRecState(button, "idle"); toast("No audio captured."); return; }
    resampleTo16kHz(chunks, rec.sampleRate).then(function (samples) {
      var buffer = encodeWav([samples], STT_TARGET_RATE);
      finishWavTranscription(new Blob([buffer], { type: "audio/wav" }), button, tgt, append, lang);
    }).catch(function () {
      setRecState(button, "idle");
      toast("Could not process audio.");
    });
  }

  function startLegacyRecording(stream, btn, target, append, lang) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx();
    var src = ctx.createMediaStreamSource(stream);
    var processor = ctx.createScriptProcessor(4096, 1, 1);
    var chunks = [];
    processor.onaudioprocess = function (e) {
      var ch = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(ch));
    };
    src.connect(processor);
    processor.connect(ctx.destination);
    _rec = {
      mode: "legacy",
      stream: stream,
      ctx: ctx,
      processor: processor,
      chunks: chunks,
      sampleRate: ctx.sampleRate,
      timer: null,
      button: btn,
      target: target,
      append: append,
      lang: lang
    };
    setRecState(btn, "recording");
    _rec.timer = setTimeout(function () { stopRecordingTranscribe(null, null); }, STT_MAX_MS);
  }

  function tryBrowserDictation(btn, target, append, lang) {
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return false;
    var rec = new Rec();
    rec.lang = lang === "en" ? "en-TZ" : "sw-TZ";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setRecState(btn, "processing");
    rec.onresult = function (e) {
      var text = (e.results && e.results[0] && e.results[0][0]) ? e.results[0][0].transcript : "";
      applyTranscript(target, text, append);
      setRecState(btn, "idle");
      if (text) toast("Transcribed ✓");
    };
    rec.onerror = function () { setRecState(btn, "idle"); toast("Voice input failed."); };
    rec.onend = function () { setRecState(btn, "idle"); };
    try { rec.start(); } catch (e) { setRecState(btn, "idle"); return false; }
    return true;
  }

  function startRecording(btn, target) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("Voice input is not supported in this browser.");
      return;
    }
    if (_rec) { toast("A recording is already in progress. Tap Stop to finish it first."); return; }

    var append = btn && btn.getAttribute("data-append") === "true";
    var lang = resolveSttLang(btn, target);
    if (requiresHumanSpeech(btn) && humanSpeechBlocked()) {
      toast("Wait a moment after Listen finishes, then speak your own answer.");
      return;
    }
    if (isTtsActive()) {
      toast("Wait until Listen finishes before recording your voice.");
      return;
    }
    if (!isAuthed()) {
      if (tryBrowserDictation(btn, target, append, lang)) return;
      toast("Please log in to use voice typing.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mime = pickRecorderMime();
      if (window.MediaRecorder && mime) {
        var parts = [];
        var recorder = new MediaRecorder(stream, { mimeType: mime });
        recorder.ondataavailable = function (e) {
          if (e.data && e.data.size) parts.push(e.data);
        };
        recorder.start(250);
        _rec = {
          mode: "mediarecorder",
          stream: stream,
          recorder: recorder,
          parts: parts,
          timer: null,
          button: btn,
          target: target,
          append: append,
          lang: lang
        };
        setRecState(btn, "recording");
        _rec.timer = setTimeout(function () { stopRecordingTranscribe(null, null); }, STT_MAX_MS);
        return;
      }
      startLegacyRecording(stream, btn, target, append, lang);
    }).catch(function (err) {
      toast(err && err.name === "NotAllowedError" ? "Microphone access was denied." : "Could not start microphone.");
    });
  }

  function casuyaRecordAnswer(options) {
    options = options || {};
    var button = options.button || null;
    var target = options.target || (button ? resolveRecordTarget(button) : null);

    if (_rec) {
      var rec = _rec;
      // Always stop the in-progress recording into ITS OWN button/target, so the
      // audio lands in the input that started it — even if the user happened to
      // click a different record button.
      var sameButton = button && rec.button && button === rec.button;
      stopRecordingTranscribe(rec.button, rec.target);
      if (!sameButton) toast("Previous recording stopped. Tap 🎤 again to start a new one.");
      return;
    }
    startRecording(button, target);
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function attachListen(el, opts) {
    opts = opts || {};
    if (!el || el.querySelector(".casuya-listen-attached")) return null;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "casuya-listen-attached casuya-listen";
    b.setAttribute("data-bound", "attached");
    b.title = opts.title || "Listen";
    b.setAttribute("aria-label", opts.title || "Listen");
    b.textContent = "🔊 Listen";
    b.addEventListener("click", function () {
      var txt = opts.textProvider ? opts.textProvider() : (typeof el === "string" ? el : el.innerText);
      casuyaSpeakText(txt || "", {
        lang: opts.lang || "auto",
        onLoading: function () { b.classList.add("loading"); },
        onStart: function () { b.classList.remove("loading"); b.classList.add("speaking"); },
        onEnd: function () { b.classList.remove("loading"); b.classList.remove("speaking"); },
        onError: function () { b.classList.remove("loading"); b.classList.remove("speaking"); }
      });
    });
    if (opts.position === "after") {
      if (el.nextSibling) el.parentNode.insertBefore(b, el.nextSibling);
      else el.parentNode.appendChild(b);
    } else {
      el.appendChild(b);
    }
    return b;
  }

  function iframeText(iframe) {
    if (!iframe) return "";
    if (iframe.tagName !== "IFRAME" && iframe.querySelector) {
      iframe = iframe.querySelector("iframe") || iframe;
    }
    try {
      var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      var txt = doc && doc.body && doc.body.innerText ? doc.body.innerText : "";
      txt = String(txt).replace(/\s+/g, " ").trim();
      return txt.length > 6000 ? txt.slice(0, 6000) : txt;
    } catch (e) { return ""; }
  }

  function once(btn) { // convenience: read text of an element into data-speak
    if (!btn) return btn;
    var t = btn.getAttribute("data-speak");
    if (t == null) btn.setAttribute("data-speak", (btn.textContent || "").replace(/🔊/g, "").replace(/Listen\b/gi, "").trim());
    return btn;
  }

  /* ── CSS for the declarative buttons ─────────────────────────────────── */
  (function injectCss() {
    try {
      var style = document.createElement("style");
      style.textContent = ".casuya-listen,.casuya-record{display:inline-flex;align-items:center;justify-content:center;gap:0.25rem;border:1px solid var(--color-border,#d1d5db);background:rgba(255,255,255,0.6);color:var(--color-text,#111827);border-radius:9999px;padding:0.3rem 0.65rem;cursor:pointer;font-size:0.85rem;line-height:1;white-space:nowrap;transition:transform .12s ease,box-shadow .12s ease}.casuya-listen:hover,.casuya-record:hover{transform:scale(1.06);box-shadow:0 1px 4px rgba(0,0,0,0.15)}.casuya-listen.loading{opacity:.75;cursor:wait}.casuya-listen.speaking{background:var(--color-warning,#f59e0b);color:#fff}.casuya-record.recording{background:#dc2626!important;color:#fff!important;animation:casuyaRecPulse 1.1s ease-in-out infinite;border-color:#dc2626}.casuya-record.processing{background:var(--color-success,#10b981)!important;color:#fff!important;cursor:wait}@keyframes casuyaRecPulse{0%,100%{opacity:1}50%{opacity:.45}}";
      document.head.appendChild(style);
    } catch (e) {}
  })();

  /* ── Declarative bindings (event delegation, works for late content) ── */
  document.addEventListener("click", function (e) {
    var targetNode = e.target;
    if (!targetNode || !targetNode.closest) return;

    var recBtn = targetNode.closest(".casuya-record");
    if (recBtn) {
      e.preventDefault();
      casuyaRecordAnswer({ button: recBtn });
      return;
    }

    var listenBtn = targetNode.closest(".casuya-listen[data-bound]");
    if (listenBtn) return; // attached listeners handle themselves

    var btn = targetNode.closest(".casuya-listen");
    if (btn) {
      btn = once(btn);
      var speak = btn.getAttribute("data-speak");
      if (speak) {
        casuyaSpeakText(speak, {
          lang: btn.getAttribute("data-lang") || "auto",
          onLoading: function () { btn.classList.add("loading"); },
          onStart: function () { btn.classList.remove("loading"); btn.classList.add("speaking"); },
          onEnd: function () { btn.classList.remove("loading"); btn.classList.remove("speaking"); },
          onError: function () { btn.classList.remove("loading"); btn.classList.remove("speaking"); }
        });
      }
    }
  });

  window.addEventListener("online", drainPendingStt);

  /* ── Public API ──────────────────────────────────────────────────────── */
  window.casuyaSpeakText = casuyaSpeakText;
  window.casuyaStopAll = casuyaStopAll;
  window.casuyaRecordAnswer = casuyaRecordAnswer;
  window.casuyaPrefetchTts = casuyaPrefetchTts;
  function resolveLessonLang(title, bodyText, quizPrompt) {
    var sample = String(title || "") + " " + String(bodyText || "").slice(0, 4000);
    if (!sample.trim() && quizPrompt) sample = String(quizPrompt || "");
    return detectLang(sample.trim(), "auto");
  }

  window.casuyaDetectLang = detectLang;
  window.casuyaResolveLessonLang = resolveLessonLang;
  window.casuyaAttachListen = attachListen;
  window.casuyaIframeText = iframeText;
  window.casuyaIsAuthed = isAuthed;
  window.__casuyaSpeech = {
    speakText: casuyaSpeakText,
    stop: casuyaStopAll,
    recordAnswer: casuyaRecordAnswer,
    prefetchTts: casuyaPrefetchTts,
    detectLang: detectLang,
    resolveLessonLang: resolveLessonLang,
    findVoice: findVoice,
    attachListen: attachListen,
    iframeText: iframeText,
    isAuthed: isAuthed,
    esc: esc
  };
})();