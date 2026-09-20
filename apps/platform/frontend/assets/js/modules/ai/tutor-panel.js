// modules/ai/tutor-panel.js — shared AI tutor streaming, markdown render, source chips.

function renderTutorThinking(label) {
  var text = label || "Thinking...";
  return (
    '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>'
    + escapeHtml(text) + "</div>"
  );
}

function renderTutorStreamingSkeleton() {
  return (
    '<div class="tutor-streaming-skeleton" aria-hidden="true">'
    + '<div class="tutor-skeleton-line tutor-skeleton-line-lg"></div>'
    + '<div class="tutor-skeleton-line"></div>'
    + '<div class="tutor-skeleton-line tutor-skeleton-line-sm"></div>'
    + '<div class="tutor-skeleton-block"></div>'
    + "</div>"
  );
}

function renderTutorFollowUpChips() {
  var chips = [
    { label: "Eleza kwa urahisi", prompt: "Eleza kwa Kiswahili rahisi zaidi." },
    { label: "NECTA huuliza vipi?", prompt: "NECTA huuliza vipi kuhusu hili?" },
    { label: "Toa mfano", prompt: "Toa mfano wa Tanzania." },
    { label: "Explain simpler", prompt: "Explain this in simpler English." },
  ];
  return (
    '<div class="tutor-followup-chips">'
    + chips.map(function (c) {
      return (
        '<button type="button" class="tutor-followup-chip" data-followup="'
        + escapeHtml(c.prompt) + '">' + escapeHtml(c.label) + "</button>"
      );
    }).join("")
    + "</div>"
  );
}

function attachTutorFollowUp(container, askFn) {
  if (!container || typeof askFn !== "function") return;
  var wrap = document.createElement("div");
  wrap.className = "tutor-followup-wrap";
  wrap.innerHTML = renderTutorFollowUpChips();
  wrap.addEventListener("click", function (e) {
    var chip = e.target && e.target.closest && e.target.closest("[data-followup]");
    if (!chip) return;
    askFn(chip.getAttribute("data-followup") || "");
  });
  container.appendChild(wrap);
}

function renderTutorHelpfulRating() {
  return (
    '<div class="tutor-helpful" data-tutor-helpful>'
    + '<span class="tutor-helpful-label">Was this helpful?</span>'
    + '<button type="button" class="tutor-helpful-btn" data-helpful="yes" aria-label="Helpful">👍</button>'
    + '<button type="button" class="tutor-helpful-btn" data-helpful="no" aria-label="Not helpful">👎</button>'
    + '<span class="tutor-helpful-thanks" hidden>Asante — feedback saved.</span>'
    + "</div>"
  );
}

function attachTutorHelpful(container, meta) {
  if (!container) return;
  var wrap = document.createElement("div");
  wrap.innerHTML = renderTutorHelpfulRating();
  var root = wrap.firstElementChild;
  if (!root) return;
  root.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-helpful]");
    if (!btn || root.dataset.answered) return;
    root.dataset.answered = "1";
    try {
      var key = "casuya_ai_feedback";
      var log = JSON.parse(sessionStorage.getItem(key) || "[]");
      log.push({
        helpful: btn.getAttribute("data-helpful") === "yes",
        source: (meta && meta.source) || "unknown",
        at: Date.now(),
      });
      sessionStorage.setItem(key, JSON.stringify(log.slice(-50)));
    } catch (err) {}
    root.querySelectorAll(".tutor-helpful-btn").forEach(function (b) { b.disabled = true; });
    var thanks = root.querySelector(".tutor-helpful-thanks");
    if (thanks) thanks.hidden = false;
  });
  container.appendChild(root);
}

function buildTutorMessagesArray(priorMessages) {
  return (priorMessages || []).slice(-8).map(function (m) {
    return {
      role: m.role === "user" ? "user" : "tutor",
      text: String(m.text || "").trim(),
    };
  }).filter(function (m) { return m.text; });
}

function tutorHitLabel(hit) {
  if (!hit) return "Reference";
  if (hit.title) return String(hit.title);
  if (hit.code) return String(hit.code);
  if (hit.kind) return String(hit.kind);
  return "Reference";
}

function renderTutorSourceChips(kbHits) {
  if (!kbHits || !kbHits.length) return "";
  var chips = kbHits.slice(0, 4).map(function (hit) {
    var title = tutorHitLabel(hit);
    var kind = String(hit.kind || hit.doc_type || "");
    var icon = /exam|necta|marking/i.test(kind + title) ? "📄" : "📘";
    return (
      '<span class="tutor-source-chip" title="' + escapeHtml(title) + '">'
      + icon + " " + escapeHtml(title.slice(0, 56)) + "</span>"
    );
  }).join("");
  return '<div class="tutor-source-chips">' + chips + "</div>";
}

function scoreNectaFormat(text) {
  text = String(text || "");
  var hasContext = /🌍|Context|Muktadha/i.test(text);
  var hasNecta = /NECTA|Exam(?:ination)? Tip|Kidokezo cha NECTA|uchaguzi/i.test(text);
  var hasStructure = /^#{1,3}\s|^\*\*|^>\s/m.test(text);
  var score = (hasContext ? 1 : 0) + (hasNecta ? 1 : 0) + (hasStructure ? 1 : 0);
  if (score >= 2) return "complete";
  if (score >= 1) return "partial";
  return "none";
}

function renderFormatQualityChip(text) {
  var level = scoreNectaFormat(text);
  if (level === "complete") {
    return (
      '<span class="tutor-format-chip tutor-format-complete" title="Answer follows NECTA tutor format">'
      + "✓ Exam-ready format</span>"
    );
  }
  if (level === "partial") {
    return (
      '<span class="tutor-format-chip tutor-format-partial" title="Partial NECTA structure">'
      + "~ Partial format</span>"
    );
  }
  return "";
}

function renderTutorFooter(result, responseText) {
  result = result || {};
  var formatChip = responseText ? renderFormatQualityChip(responseText) : "";
  return renderTutorSourceChips(result.kbHits)
    + formatChip
    + renderAiSourceBadge(result.source);
}

function buildTutorThreadQuestion(priorMessages, latestQuestion) {
  latestQuestion = String(latestQuestion || "").trim();
  var turns = [];
  (priorMessages || []).forEach(function (m) {
    if (m.role === "user" && m.text) {
      turns.push({ q: m.text, a: "" });
    } else if (m.role === "tutor" && m.text && turns.length) {
      turns[turns.length - 1].a = String(m.text).slice(0, 600);
    }
  });
  turns = turns.slice(-4);
  if (!turns.length) return latestQuestion;
  var block = turns.map(function (t, idx) {
    return (
      "PREVIOUS Q" + (idx + 1) + ": " + t.q
      + (t.a ? "\nPREVIOUS A" + (idx + 1) + ": " + t.a : "")
    );
  }).join("\n\n");
  return (
    block
    + "\n\nFOLLOW-UP QUESTION:\n"
    + latestQuestion
    + "\n\n[Continue the tutoring conversation. Reference prior answers when helpful.]"
  );
}

function attachTutorListen(slotOrContainer, opts) {
  opts = opts || {};
  if (!slotOrContainer) return;
  function attach() {
    if (typeof casuyaAttachListen !== "function") return;
    var slot = typeof slotOrContainer === "string"
      ? document.querySelector(slotOrContainer)
      : slotOrContainer;
    if (!slot) return;
    casuyaAttachListen(slot, {
      title: opts.title || "Listen",
      textProvider: opts.textProvider || function () { return ""; },
    });
  }
  if (typeof ensureSpeechBundle === "function") {
    ensureSpeechBundle().then(attach).catch(function () {});
  } else {
    attach();
  }
}

function runAiGenerateTask(opts) {
  opts = opts || {};
  var container = opts.container;
  if (!container) return Promise.reject(new Error("no container"));
  container.innerHTML = renderTutorThinking(opts.loadingLabel || "Working...");
  return request(opts.path, {
    method: "POST",
    body: JSON.stringify(opts.body || {}),
  }).then(function (result) {
    var html = typeof opts.render === "function" ? opts.render(result) : "";
    var footer = "";
    if (!opts.skipAutoFooter && typeof renderAiResultFooter === "function") {
      footer = renderAiResultFooter(result);
    }
    container.innerHTML = html + (footer ? '<div class="tutor-response-footer">' + footer + "</div>" : "");
    scheduleTutorMath(container);
    if (opts.listenTitle) {
      var listenSlot = document.createElement("span");
      listenSlot.className = "casuya-ai-listen-slot";
      container.appendChild(listenSlot);
      attachTutorListen(listenSlot, {
        title: opts.listenTitle,
        textProvider: function () { return container.innerText; },
      });
    }
    if (typeof opts.onComplete === "function") opts.onComplete(result);
    return result;
  }).catch(function (err) {
    container.innerHTML = '<p style="color:var(--color-danger)">Error: '
      + escapeHtml(err.message || "Failed") + "</p>";
    if (typeof opts.onError === "function") opts.onError(err);
    throw err;
  });
}

function stripHtmlForContext(html, maxLen) {
  maxLen = maxLen || 2000;
  if (!html) return "";
  var text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen) + "…";
  return text;
}

function inferSubjectSlug(text) {
  var lower = String(text || "").toLowerCase();
  if (/chem|acid|molecule|element|compound|reaction|atom/.test(lower)) return "chemistry";
  if (/phys|force|energy|velocity|electric|wave|motion|newton/.test(lower)) return "physics";
  if (/math|equation|algebra|geometry|number|fraction|graph|calculus/.test(lower)) return "mathematics";
  return "";
}

function inferFormLevel(text) {
  var m = String(text || "").match(/form\s*([ivx]+|\d+)/i);
  if (!m) return null;
  var token = m[1].toUpperCase();
  var roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  if (roman[token]) return roman[token];
  var n = parseInt(token, 10);
  return n >= 1 && n <= 6 ? n : null;
}

function studentFormLevelNumber() {
  try {
    var raw = localStorage.getItem("casuya_form_filter") || "";
    if (!raw || raw === "all") {
      var dash = window.__casuyaStudentPayload;
      if (dash && dash.form_level) raw = dash.form_level;
    }
    return inferFormLevel(raw) || 2;
  } catch (e) {
    return 2;
  }
}

function tutorThreadStorageKey(ctx) {
  ctx = ctx || {};
  var lesson = ctx.lesson || {};
  var id = lesson.id || lesson.slug || ctx.lessonId || "lesson";
  return "casuya_ai_thread_" + String(id);
}

function loadTutorThread(key) {
  try {
    var raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTutorThread(key, messages) {
  var trimmed = (messages || []).slice(-8);
  try {
    sessionStorage.setItem(key, JSON.stringify(trimmed));
  } catch (e) {}
  var lessonId = String(key || "").replace("casuya_ai_thread_", "");
  if (lessonId && typeof request === "function") {
    request("/ai/tutor/thread/" + encodeURIComponent(lessonId), {
      method: "PUT",
      body: JSON.stringify({ messages: trimmed }),
    }).catch(function () {});
  }
}

function loadTutorThreadFromServer(lessonId, key, onLoaded) {
  if (!lessonId || typeof request !== "function") {
    if (typeof onLoaded === "function") onLoaded(loadTutorThread(key));
    return;
  }
  request("/ai/tutor/thread/" + encodeURIComponent(lessonId)).then(function (data) {
    var server = (data && data.messages) || [];
    var local = loadTutorThread(key);
    var merged = server.length >= local.length ? server : local;
    try {
      sessionStorage.setItem(key, JSON.stringify(merged.slice(-8)));
    } catch (e) {}
    if (typeof onLoaded === "function") onLoaded(merged);
  }).catch(function () {
    if (typeof onLoaded === "function") onLoaded(loadTutorThread(key));
  });
}

function buildQuizLessonContent(questions) {
  return (questions || []).map(function (q, idx) {
    var text = q.text || q.prompt || "";
    var opts = (q.options || []).map(function (o) {
      return (o.letter || "") + ") " + (o.text || "");
    }).join("; ");
    return "Q" + (idx + 1) + ": " + text + (opts ? " Options: " + opts : "");
  }).join("\n");
}

function finishTutorSurface(container, result, responseText, callbacks) {
  callbacks = callbacks || {};
  if (typeof callbacks.onComplete === "function") {
    callbacks.onComplete(result || {}, responseText || "");
  }
  if (callbacks.listenTitle || callbacks.listenSlot) {
    var slot = callbacks.listenSlot;
    if (!slot || !slot.parentNode) {
      slot = document.createElement("span");
      slot.className = "casuya-ai-listen-slot";
      if (container) container.appendChild(slot);
    }
    attachTutorListen(slot, {
      title: callbacks.listenTitle || "Listen",
      textProvider: function () { return container ? container.innerText : ""; },
    });
  }
}

function buildLessonTutorPayload(opts) {
  opts = opts || {};
  var question = String(opts.question || "").trim();
  var lesson = opts.lesson || {};
  var html = opts.lessonContent || "";
  var iframeText = opts.iframeText || "";
  var plain = stripHtmlForContext(html || iframeText, 2000);
  var title = lesson.title || "Lesson";
  var parts = ["Lesson: " + title];
  if (opts.subtopic) parts.push("Subtopic: " + opts.subtopic);
  if (opts.topic) parts.push("Topic: " + opts.topic);
  if (plain) parts.push("Content excerpt: " + plain);
  var lang = opts.language || localStorage.getItem("casuya_tutor_lang") || "both";
  if (lang === "sw") {
    question = "[Respond in Kiswahili using TIE syllabus terminology.]\n\n" + question;
  } else if (lang === "en") {
    question = "[Respond in English using TIE syllabus terminology.]\n\n" + question;
  }
  var subject = opts.subject_slug
    || inferSubjectSlug(title + " " + plain)
    || undefined;
  var form = opts.form_level
    || inferFormLevel(title + " " + (opts.subtopic || ""))
    || studentFormLevelNumber();
  if (opts.lessonId) parts.unshift("Lesson ID: " + opts.lessonId);
  var ctx = parts.join("\n");
  if (ctx.length > 4000) ctx = ctx.slice(0, 4000) + "…";
  return {
    question: question,
    lesson_context: ctx,
    lesson_id: opts.lessonId || lesson.id || undefined,
    subject_slug: subject,
    form_level: form,
    messages: opts.messages || undefined,
    language: lang,
    mode: opts.mode || undefined,
  };
}

function bindTutorMarkdownInteractions(container) {
  if (!container) return;
  container.querySelectorAll(".tutor-marking-toggle").forEach(function (btn) {
    if (btn._tutorBound) return;
    btn._tutorBound = true;
    btn.addEventListener("click", function () {
      var panel = btn.nextElementSibling;
      if (!panel) return;
      panel.hidden = !panel.hidden;
      btn.textContent = panel.hidden ? "Show Marking Scheme" : "Hide Marking Scheme";
    });
  });
}

function scheduleTutorMath(el) {
  if (!el || typeof window.renderMath !== "function") return;
  if (el._tutorMathTimer) clearTimeout(el._tutorMathTimer);
  el._tutorMathTimer = setTimeout(function () {
    window.renderMath(el);
  }, 180);
}

function runTutorQuery(payload, callbacks) {
  callbacks = callbacks || {};
  var container = callbacks.container;
  if (!container) return null;

  var accumulated = "";

  function renderPartial() {
    container.innerHTML = '<div class="tutor-response">' + renderTutorMarkdown(accumulated) + "</div>";
    bindTutorMarkdownInteractions(container);
    scheduleTutorMath(container);
  }

  function showResult(result, responseText) {
    container.innerHTML =
      '<div class="tutor-response">' + renderTutorMarkdown(responseText || "") + "</div>"
      + '<div class="tutor-response-footer">' + renderTutorFooter(result || {}, responseText || "") + "</div>";
    bindTutorMarkdownInteractions(container);
    scheduleTutorMath(container);
    finishTutorSurface(container, result, responseText, callbacks);
  }

  if (typeof window.ensureKaTeX === "function") {
    window.ensureKaTeX().catch(function () {});
  }

  container.innerHTML = renderTutorStreamingSkeleton()
    + renderTutorThinking(callbacks.loadingLabel || "Thinking...");

  function maybeCacheResult(meta, text) {
    if (typeof putTutorQaCache !== "function" || typeof tutorQaCacheKey !== "function") return;
    var src = meta && meta.source;
    if (src !== "casuya-ai" && src !== "cached") return;
    if (!text || !String(text).trim()) return;
    putTutorQaCache(tutorQaCacheKey(payload), {
      response: text,
      kbHits: (meta && meta.kbHits) || [],
      formatComplete: meta && meta.formatComplete,
      formatLevel: meta && meta.formatLevel,
      source: src,
    });
  }

  function startNetwork() {
    if (typeof streamTutorResponse !== "function") {
      return request("/ai/tutoring/explain", {
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (result) {
        var response = (result && result.response) ? result.response : "";
        if (!response) throw new Error("empty");
        maybeCacheResult(result, response);
        showResult(result, response);
      }).catch(function () {
        if (typeof enqueueTutorQuestion === "function" && typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueTutorQuestion(payload, callbacks).then(function (queued) {
            container.innerHTML = queued
              ? '<div class="tutor-fallback">Saved offline — will sync when you are back online.</div>'
              : '<div class="tutor-fallback">' + escapeHtml(callbacks.errorMessage || "The AI tutor is temporarily unavailable.") + "</div>";
          });
        } else {
          container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
            callbacks.errorMessage || "The AI tutor is temporarily unavailable."
          ) + "</div>";
        }
        if (typeof callbacks.onError === "function") callbacks.onError();
      });
    }

    return streamTutorResponse(
      payload,
      function (chunk) {
        accumulated += chunk;
        renderPartial();
      },
      function (meta) {
        var footer = document.createElement("div");
        footer.className = "tutor-response-footer";
        footer.innerHTML = renderTutorFooter(meta || {}, accumulated);
        container.appendChild(footer);
        scheduleTutorMath(container);
        maybeCacheResult(meta, accumulated);
        finishTutorSurface(container, meta, accumulated, callbacks);
      },
      function () {
        request("/ai/tutoring/explain", {
          method: "POST",
          body: JSON.stringify(payload),
        }).then(function (result) {
          var response = (result && result.response) ? result.response : "";
          if (!response) throw new Error("empty");
          maybeCacheResult(result, response);
          showResult(result, response);
        }).catch(function () {
          if (typeof enqueueTutorQuestion === "function" && typeof navigator !== "undefined" && !navigator.onLine) {
            enqueueTutorQuestion(payload, callbacks).then(function (queued) {
              container.innerHTML = queued
                ? '<div class="tutor-fallback">Saved offline — will sync when you are back online.</div>'
                : '<div class="tutor-fallback">' + escapeHtml(callbacks.errorMessage || "The AI tutor could not be reached.") + "</div>";
            });
          } else {
            container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
              callbacks.errorMessage || "The AI tutor could not be reached."
            ) + "</div>";
          }
          if (typeof callbacks.onError === "function") callbacks.onError();
        });
      }
    );
  }

  if (typeof getTutorQaCache === "function" && typeof tutorQaCacheKey === "function") {
    getTutorQaCache(tutorQaCacheKey(payload)).then(function (row) {
      if (row && row.response) {
        showResult({
          source: "local-cache",
          kbHits: row.kbHits || [],
          formatComplete: row.formatComplete,
          formatLevel: row.formatLevel || "none",
        }, row.response);
        return;
      }
      startNetwork();
    }).catch(function () { startNetwork(); });
    return null;
  }

  if (typeof streamTutorResponse !== "function") {
    request("/ai/tutoring/explain", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(function (result) {
      var response = (result && result.response) ? result.response : "";
      if (!response) throw new Error("empty");
      showResult(result, response);
    }).catch(function () {
      container.innerHTML = '<div class="tutor-fallback">' + escapeHtml(
        callbacks.errorMessage || "The AI tutor is temporarily unavailable."
      ) + "</div>";
      if (typeof callbacks.onError === "function") callbacks.onError();
    });
    return null;
  }

  return startNetwork();
}

function buildLessonQuizTutorQuestion(wrongQuestions) {
  var parts = [];
  (wrongQuestions || []).forEach(function (wq, idx) {
    parts.push(
      "QUESTION " + (idx + 1) + ": " + (wq.prompt || "")
      + "\n- Student answered: " + (wq.chosen_text || "(unanswered)")
      + "\n- Correct answer: " + (wq.correct_text || "")
    );
  });
  return (
    "A student answered the following lesson quiz questions incorrectly. "
    + "Explain in simple step-by-step language how to reach the correct answer for each one. "
    + "Do not just repeat the correct option — show the method and encourage the student.\n\n"
    + parts.join("\n\n")
  );
}

function mountLessonQuizTutor(mountAfterEl, wrongQuestions, ctx) {
  if (!mountAfterEl || !wrongQuestions || !wrongQuestions.length) return;
  var existing = mountAfterEl.parentNode && mountAfterEl.parentNode.querySelector(".quiz-tutor");
  if (existing) existing.remove();
  var tutorId = "lesson-quiz-tutor-" + Date.now();
  var countLabel = wrongQuestions.length + " question" + (wrongQuestions.length > 1 ? "s" : "");
  var tutorHtml = (
    '<div class="quiz-tutor" id="' + tutorId + '">'
    + '<div class="quiz-tutor-header"><span class="quiz-tutor-icon">🎓</span>'
    + '<div><div class="quiz-tutor-title">Let\u2019s Learn: Step-by-Step</div>'
    + '<div class="quiz-tutor-sub">The AI tutor will explain the ' + countLabel + ' you got wrong.</div></div></div>'
    + '<div class="quiz-tutor-body"></div></div>'
  );
  if (mountAfterEl.insertAdjacentHTML) {
    mountAfterEl.insertAdjacentHTML("afterend", tutorHtml);
  } else if (mountAfterEl.parentNode) {
    var tmp = document.createElement("div");
    tmp.innerHTML = tutorHtml;
    while (tmp.firstChild) mountAfterEl.parentNode.insertBefore(tmp.firstChild, mountAfterEl.nextSibling);
  }
  var body = document.getElementById(tutorId)?.querySelector(".quiz-tutor-body");
  if (!body) return;
  var lesson = (ctx && ctx.lesson) || { title: (ctx && ctx.lessonTitle) || "Lesson quiz" };
  if (ctx && ctx.lessonId && !lesson.id) lesson.id = ctx.lessonId;
  var payload = buildLessonTutorPayload({
    question: buildLessonQuizTutorQuestion(wrongQuestions),
    lesson: lesson,
    lessonId: (ctx && ctx.lessonId) || lesson.id,
    lessonContent: ctx && ctx.lessonContent,
    iframeText: ctx && ctx.iframeText,
    subject_slug: (ctx && ctx.subject_slug) || lesson.subject_slug,
    form_level: (ctx && ctx.form_level) || lesson.form_level,
  });
  runTutorQuery(payload, {
    container: body,
    loadingLabel: "Explaining the correct method\u2026",
    errorMessage: "The AI tutor is temporarily unavailable. Review the lesson or ask your teacher.",
    listenTitle: "Listen to explanation",
  });
}

function renderAiResultFooter(result, responseText) {
  return renderTutorFooter(result || {}, responseText);
}

window.renderTutorThinking = renderTutorThinking;
window.renderTutorSourceChips = renderTutorSourceChips;
window.renderTutorFooter = renderTutorFooter;
window.renderFormatQualityChip = renderFormatQualityChip;
window.renderAiResultFooter = renderAiResultFooter;
window.buildLessonTutorPayload = buildLessonTutorPayload;
window.buildQuizLessonContent = buildQuizLessonContent;
window.buildTutorThreadQuestion = buildTutorThreadQuestion;
window.buildTutorMessagesArray = buildTutorMessagesArray;
window.attachTutorFollowUp = attachTutorFollowUp;
window.attachTutorHelpful = attachTutorHelpful;
window.renderTutorStreamingSkeleton = renderTutorStreamingSkeleton;
window.tutorThreadStorageKey = tutorThreadStorageKey;
window.loadTutorThread = loadTutorThread;
window.loadTutorThreadFromServer = loadTutorThreadFromServer;
window.saveTutorThread = saveTutorThread;
window.buildLessonQuizTutorQuestion = buildLessonQuizTutorQuestion;
window.mountLessonQuizTutor = mountLessonQuizTutor;
window.runTutorQuery = runTutorQuery;
window.runAiGenerateTask = runAiGenerateTask;
window.attachTutorListen = attachTutorListen;
