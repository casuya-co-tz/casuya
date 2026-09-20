// modules/student/ai-chat.js — in-lesson AI tutor bottom sheet (lazy-loaded).

(function () {
  "use strict";

  var SHEET_ID = "casuya-ai-chat-sheet";
  var FAB_ID = "casuya-ai-chat-fab";
  var _ctx = null;
  var _messages = [];

  function langPref() {
    return localStorage.getItem("casuya_tutor_lang") || "both";
  }

  function setLangPref(value) {
    localStorage.setItem("casuya_tutor_lang", value);
    var sel = document.getElementById("casuya-ai-lang");
    if (sel) sel.value = value;
  }

  function headingPrompts(html) {
    var prompts = [];
    String(html || "").replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, function (_, t) {
      var text = String(t).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length >= 4 && text.length <= 80) prompts.push("Eleza: " + text);
      return "";
    });
    return prompts.slice(0, 3);
  }

  function suggestedPrompts(ctx) {
    var title = (ctx && ctx.lesson && ctx.lesson.title) ? ctx.lesson.title : "this topic";
    var fromHeadings = headingPrompts((ctx && ctx.lessonContent) || "");
    var base = [
      "Eleza " + title + " kwa Kiswahili rahisi.",
      "NECTA huuliza vipi kuhusu hili?",
      "Toa mfano wa Tanzania.",
      "What is the main idea in one sentence?",
    ];
    return fromHeadings.concat(base).slice(0, 6);
  }

  function renderMessages() {
    var list = document.getElementById("casuya-ai-chat-messages");
    if (!list) return;
    if (!_messages.length) {
      list.innerHTML = '<p class="casuya-ai-chat-empty">Uliza swali kuhusu somo hili. AI itajibu kwa muundo wa NECTA.</p>';
      return;
    }
    list.innerHTML = _messages.map(function (m) {
      if (m.role === "user") {
        return (
          '<div class="casuya-ai-chat-bubble casuya-ai-chat-bubble-user">'
          + '<div class="casuya-ai-chat-bubble-label">Wewe</div>'
          + "<p>" + escapeHtml(m.text) + "</p></div>"
        );
      }
      return (
        '<div class="casuya-ai-chat-bubble casuya-ai-chat-bubble-tutor">'
        + '<div class="casuya-ai-chat-bubble-label">AI Mwalimu</div>'
        + (m.html || renderTutorThinking("Inaandika…"))
        + "</div>"
      );
    }).join("");
    list.scrollTop = list.scrollHeight;
  }

  function sheetHtml() {
    return (
      '<div id="' + SHEET_ID + '" class="casuya-ai-chat-sheet" hidden>'
      + '<div class="casuya-ai-chat-backdrop" data-ai-chat-close></div>'
      + '<div class="casuya-ai-chat-panel" role="dialog" aria-modal="true" aria-labelledby="casuya-ai-chat-title">'
      + '<div class="casuya-ai-chat-header">'
      + '<div><strong id="casuya-ai-chat-title">Uliza AI</strong>'
      + '<div class="casuya-ai-chat-sub">Msaada wa somo — muundo wa NECTA</div></div>'
      + '<div class="casuya-ai-chat-header-actions">'
      + '<select id="casuya-ai-lang" class="input casuya-ai-lang-select" aria-label="Answer language">'
      + '<option value="both">SW + EN</option>'
      + '<option value="sw">Kiswahili</option>'
      + '<option value="en">English</option>'
      + '</select>'
      + '<button type="button" class="btn-icon casuya-ai-chat-close" data-ai-chat-close aria-label="Close">✕</button>'
      + '</div></div>'
      + '<div id="casuya-ai-chat-messages" class="casuya-ai-chat-messages"></div>'
      + '<div id="casuya-ai-chat-suggestions" class="casuya-ai-chat-suggestions"></div>'
      + '<form id="casuya-ai-chat-form" class="casuya-ai-chat-form">'
      + '<div class="casuya-ai-chat-input-row">'
      + '<textarea id="casuya-ai-chat-input" class="input" rows="2" placeholder="Andika swali lako…" required></textarea>'
      + '<button type="button" class="casuya-record casuya-ai-chat-mic" data-target="#casuya-ai-chat-input" title="Speak your question" aria-label="Speak your question">🎤</button>'
      + '</div>'
      + '<button type="submit" class="btn btn-primary casuya-ai-chat-submit">Tuma swali</button>'
      + '</form>'
      + '</div></div>'
    );
  }

  function renderSuggestions() {
    var wrap = document.getElementById("casuya-ai-chat-suggestions");
    if (!wrap || !_ctx) return;
    wrap.innerHTML = suggestedPrompts(_ctx).map(function (p) {
      return '<button type="button" class="casuya-ai-chip" data-ai-suggest="' + escapeHtml(p) + '">' + escapeHtml(p) + "</button>";
    }).join("");
  }

  function openSheet() {
    var sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add("casuya-ai-chat-open");
    renderSuggestions();
    var langSel = document.getElementById("casuya-ai-lang");
    if (langSel) langSel.value = langPref();
    var input = document.getElementById("casuya-ai-chat-input");
    if (input) input.focus();
  }

  function closeSheet() {
    var sheet = document.getElementById(SHEET_ID);
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("casuya-ai-chat-open");
  }

  function askQuestion(question) {
    question = String(question || "").trim();
    if (!question || !_ctx) return;

    _messages.push({ role: "user", text: question });
    var tutorIdx = _messages.length;
    _messages.push({ role: "tutor", html: renderTutorThinking("Inafikiria…") });
    renderMessages();
    persistThread();

    var threadedQuestion = typeof buildTutorThreadQuestion === "function"
      ? buildTutorThreadQuestion(_messages.slice(0, -2), question)
      : question;
    var payload = buildLessonTutorPayload({
      question: threadedQuestion,
      lesson: _ctx.lesson,
      lessonId: _ctx.lessonId,
      lessonContent: _ctx.lessonContent,
      iframeText: _ctx.iframeText,
      subject_slug: _ctx.subject_slug,
      form_level: _ctx.form_level,
      language: langPref(),
      messages: typeof buildTutorMessagesArray === "function"
        ? buildTutorMessagesArray(_messages.slice(0, -2))
        : undefined,
    });

    var list = document.getElementById("casuya-ai-chat-messages");
    var bubbles = list ? list.querySelectorAll(".casuya-ai-chat-bubble-tutor") : [];
    var bubble = bubbles[bubbles.length - 1];
    if (!bubble) return;

    var body = document.createElement("div");
    body.className = "casuya-ai-chat-answer";
    bubble.innerHTML = '<div class="casuya-ai-chat-bubble-label">AI Mwalimu</div>';
    bubble.appendChild(body);

    runTutorQuery(payload, {
      container: body,
      loadingLabel: "Inafikiria…",
      errorMessage: "AI haipatikani kwa sasa. Jaribu tena au uliza mwalimu wako.",
      onComplete: function (meta, text) {
        _messages[tutorIdx] = {
          role: "tutor",
          html: body.innerHTML,
          text: text,
          meta: meta,
        };
        persistThread();
        if (typeof attachTutorFollowUp === "function") attachTutorFollowUp(body, askQuestion);
        if (typeof attachTutorHelpful === "function") attachTutorHelpful(body, meta);
      },
      listenTitle: "Sikiliza jibu",
    });
  }

  function openLessonAiChatExplain(selected, surrounding) {
    selected = String(selected || "").trim();
    if (!selected) return;
    openSheet();
    var q = 'Explain this selected passage from the lesson:\n"' + selected + '"';
    if (surrounding) q += "\n\nSurrounding context:\n" + String(surrounding).slice(0, 600);
    askQuestion(q);
  }

  function bindSheetEvents() {
    document.querySelectorAll("[data-ai-chat-close]").forEach(function (el) {
      el.addEventListener("click", closeSheet);
    });
    var form = document.getElementById("casuya-ai-chat-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("casuya-ai-chat-input");
        var q = input ? input.value.trim() : "";
        if (!q) return;
        askQuestion(q);
        if (input) input.value = "";
        var sug = document.getElementById("casuya-ai-chat-suggestions");
        if (sug) sug.innerHTML = "";
      });
    }
    document.getElementById("casuya-ai-lang")?.addEventListener("change", function (e) {
      setLangPref(e.target.value);
    });
    document.getElementById("casuya-ai-chat-suggestions")?.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest("[data-ai-suggest]");
      if (!btn) return;
      askQuestion(btn.getAttribute("data-ai-suggest") || "");
      var sug = document.getElementById("casuya-ai-chat-suggestions");
      if (sug) sug.innerHTML = "";
    });
  }

  function ensureFab() {
    if (document.getElementById(FAB_ID)) return;
    var fab = document.createElement("button");
    fab.id = FAB_ID;
    fab.type = "button";
    fab.className = "casuya-ai-chat-fab";
    fab.setAttribute("aria-label", "Ask AI tutor");
    fab.textContent = "Uliza AI";
    fab.addEventListener("click", openSheet);
    document.body.appendChild(fab);
  }

  function ensureSheet() {
    if (document.getElementById(SHEET_ID)) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = sheetHtml();
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    bindSheetEvents();
  }

  function persistThread() {
    if (!_ctx || typeof saveTutorThread !== "function" || typeof tutorThreadStorageKey !== "function") return;
    saveTutorThread(tutorThreadStorageKey(_ctx), _messages);
  }

  function finishMount() {
    ensureSheet();
    ensureFab();
    renderMessages();
    renderSuggestions();
    var langSel = document.getElementById("casuya-ai-lang");
    if (langSel) langSel.value = langPref();
  }

  function mountLessonAiChat(ctx) {
    _ctx = ctx || {};
    var key = typeof tutorThreadStorageKey === "function" ? tutorThreadStorageKey(_ctx) : "";
    var lesson = (_ctx && _ctx.lesson) || {};
    var lessonId = (_ctx && _ctx.lessonId) || lesson.id || lesson.slug || "";

    if (typeof loadTutorThreadFromServer === "function" && lessonId) {
      loadTutorThreadFromServer(lessonId, key, function (msgs) {
        _messages = msgs || [];
        finishMount();
      });
      return;
    }

    _messages = typeof loadTutorThread === "function" && key ? loadTutorThread(key) : [];
    finishMount();
  }

  function unmountLessonAiChat() {
    persistThread();
    closeSheet();
    var fab = document.getElementById(FAB_ID);
    if (fab) fab.remove();
    _ctx = null;
    _messages = [];
  }

  window.mountLessonAiChat = mountLessonAiChat;
  window.unmountLessonAiChat = unmountLessonAiChat;
  window.openLessonAiChatExplain = openLessonAiChatExplain;
})();
