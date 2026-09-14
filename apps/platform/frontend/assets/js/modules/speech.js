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
  var SW_SET = {};
  for (var i = 0; i < SW_WORDS.length; i++) SW_SET[SW_WORDS[i]] = true;

  function detectLang(text) {
    var s = String(text || "").toLowerCase().replace(/[^a-z\s]/g, " ");
    var toks = s.split(/\s+/);
    var hits = 0;
    for (var j = 0; j < toks.length; j++) { if (SW_SET[toks[j]]) hits++; }
    return hits >= 2 ? "sw" : "en";
  }

  /* ── TTS playback state ──────────────────────────────────────────────── */
  var _audio = null;
  var _current = null;
  var _ttsCache = new Map();
  var _speakSeq = 0;

  function capText(text, max) {
    var t = String(text || "").trim();
    if (t.length <= max) return t;
    var cut = t.slice(0, max);
    var idx = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("\n"));
    return idx > max * 0.6 ? cut.slice(0, idx + 1) : cut;
  }

  function findVoice() {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices();
    var preferred = ["en-TZ", "en-KE", "en-UG", "en-GH", "en-ZA", "en-GB", "en-US"];
    for (var i = 0; i < preferred.length; i++) {
      var match = voices.filter(function (v) { return v.lang === preferred[i]; });
      if (match.length) return match[0];
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
    var v = findVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-TZ"; }
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

  function playBlob(blob, options) {
    options = options || {};
    if (_audio) { _audio.pause(); _audio.src = ""; _audio = null; }
    var url = URL.createObjectURL(blob);
    _audio = new Audio(url);
    _audio.onplay = function () { if (options.onStart) options.onStart(); };
    _audio.onended = function () { URL.revokeObjectURL(url); if (options.onEnd) options.onEnd(); };
    _audio.onerror = function () { URL.revokeObjectURL(url); if (options.onError) options.onError(new Error("Audio playback failed")); };
    _audio.play().catch(function (err) { URL.revokeObjectURL(url); if (options.onError) options.onError(err); });
    _current = apiController(options);
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
    var lang = (options.lang && options.lang !== "auto") ? options.lang : detectLang(txt);

    if (isAuthed()) {
      var capped = capText(txt, 3200);
      var cacheKey = lang + "|" + capped;
      if (_ttsCache.has(cacheKey)) {
        playBlob(_ttsCache.get(cacheKey), options);
        return _current;
      }

      fetch(API_BASE + "/v1/audio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + authToken() },
        body: JSON.stringify({ text: capped, lang: lang })
      }).then(function (resp) {
        if (!resp.ok) throw new Error("TTS unavailable (" + resp.status + ")");
        return resp.blob();
      }).then(function (blob) {
        if (mySeq !== _speakSeq) return; // superseded by a newer speak/stop
        if (_ttsCache.size >= 24) _ttsCache.delete(_ttsCache.keys().next().value);
        _ttsCache.set(cacheKey, blob);
        playBlob(blob, options);
      }).catch(function (err) {
        if (mySeq !== _speakSeq) return; // superseded by a newer speak/stop
        if (options.onError) options.onError(err);
        _current = browserSpeak(text, options);
      });
      return apiController(options);
    }

    _current = browserSpeak(text, options);
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

  function transcribe(blob, button, target) {
    setRecState(button, "processing");
    return maybeRefreshToken().then(function (token) {
      var fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      return fetch(API_BASE + "/v1/audio/stt", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
        body: fd
      });
    }).then(function (resp) {
      if (!resp.ok) throw new Error("Voice transcription failed (" + resp.status + ")");
      return resp.json();
    }).then(function (data) {
      var text = (data && data.text) || "";
      if (target) {
        if (typeof target.value === "string") target.value = text;
        else if (target.isContentEditable) target.textContent = text;
        try { target.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      }
      setRecState(button, "idle");
      if (text) toast("Transcribed ✓");
      else toast("No speech detected. Try again.");
      return text;
    }).catch(function (err) {
      setRecState(button, "idle");
      toast(err && err.message ? err.message : "Voice transcription failed");
      return "";
    });
  }

  function stopRecordingTranscribe(btn, target) {
    if (!_rec) return;
    var rec = _rec;
    _rec = null;
    if (rec.timer) { clearTimeout(rec.timer); rec.timer = null; }
    try { rec.processor.disconnect(); } catch (e) {}
    try { rec.ctx.close(); } catch (e) {}
    try { rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    var button = btn || rec.button;
    var tgt = target || rec.target;
    var chunks = rec.chunks.filter(function (c) { return c.length > 0; });
    if (!chunks.length) { setRecState(button, "idle"); toast("No audio captured."); return; }
    var buffer = encodeWav(chunks, rec.sampleRate);
    var blob = new Blob([buffer], { type: "audio/wav" });
    transcribe(blob, button, tgt);
  }

  function startRecording(btn, target) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("Voice input is not supported in this browser.");
      return;
    }
    if (_rec) { toast("A recording is already in progress. Tap Stop to finish it first."); return; }
    if (!isAuthed()) { toast("Please log in to use voice typing."); return; }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
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
      _rec = { stream: stream, ctx: ctx, processor: processor, chunks: chunks, sampleRate: ctx.sampleRate, timer: null, button: btn, target: target };
      setRecState(btn, "recording");
      _rec.timer = setTimeout(function () { stopRecordingTranscribe(null, null); }, 60000);
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
      casuyaSpeakText(txt || "", { lang: opts.lang || "auto", onStart: function () { b.classList.add("speaking"); }, onEnd: function () { b.classList.remove("speaking"); } });
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
      style.textContent = ".casuya-listen,.casuya-record{display:inline-flex;align-items:center;justify-content:center;gap:0.25rem;border:1px solid var(--color-border,#d1d5db);background:rgba(255,255,255,0.6);color:var(--color-text,#111827);border-radius:9999px;padding:0.3rem 0.65rem;cursor:pointer;font-size:0.85rem;line-height:1;white-space:nowrap;transition:transform .12s ease,box-shadow .12s ease}.casuya-listen:hover,.casuya-record:hover{transform:scale(1.06);box-shadow:0 1px 4px rgba(0,0,0,0.15)}.casuya-listen.speaking{background:var(--color-warning,#f59e0b);color:#fff}.casuya-record.recording{background:#dc2626!important;color:#fff!important;animation:casuyaRecPulse 1.1s ease-in-out infinite;border-color:#dc2626}.casuya-record.processing{background:var(--color-success,#10b981)!important;color:#fff!important;cursor:wait}@keyframes casuyaRecPulse{0%,100%{opacity:1}50%{opacity:.45}}";
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
        casuyaSpeakText(speak, { lang: btn.getAttribute("data-lang") || "auto", onStart: function () { btn.classList.add("speaking"); }, onEnd: function () { btn.classList.remove("speaking"); } });
      }
    }
  });

  /* ── Public API ──────────────────────────────────────────────────────── */
  window.casuyaSpeakText = casuyaSpeakText;
  window.casuyaStopAll = casuyaStopAll;
  window.casuyaRecordAnswer = casuyaRecordAnswer;
  window.casuyaDetectLang = detectLang;
  window.casuyaAttachListen = attachListen;
  window.casuyaIframeText = iframeText;
  window.casuyaIsAuthed = isAuthed;
  window.__casuyaSpeech = {
    speakText: casuyaSpeakText,
    stop: casuyaStopAll,
    recordAnswer: casuyaRecordAnswer,
    detectLang: detectLang,
    attachListen: attachListen,
    iframeText: iframeText,
    isAuthed: isAuthed,
    esc: esc
  };
})();