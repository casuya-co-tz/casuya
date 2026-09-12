// modules/api-quiz.js — Quiz rendering, tutor, downloads

/* ── Math (KaTeX) Rendering ───────────────────────────────────────── */
window.renderMath = function (el) {
  if (!el) return;
  // KaTeX is lazy-loaded on demand (see api-client/core/katex-loader.js).
  window.ensureKaTeX().then(function () {
    if (typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    } catch (e) {
      // Never let a math failure break the page.
    }
  });
};

window._quizSubmit = function(quizId, total) {
  var correct = 0;
  var i, container, correctAnswer, selected, selectedVal, exp;
  var scoreEl, scoreNum, scoreLabel, pct, msg, btn;
  var wrong = [];

  for (i = 0; i < total; i++) {
    container = document.querySelector("#" + quizId + " .quiz-question[data-index=\"" + i + "\"]");
    if (!container) continue;
    correctAnswer = container.getAttribute("data-correct");
    selected = document.querySelector("input[name=\"" + quizId + "-q" + i + "\"]:checked");
    selectedVal = selected ? selected.value : null;

    var options = container.querySelectorAll(".quiz-option");
    var j, opt, letter;
    for (j = 0; j < options.length; j++) {
      opt = options[j];
      letter = opt.getAttribute("data-letter");
      opt.style.pointerEvents = "none";
      if (letter === correctAnswer) {
        opt.classList.add("correct");
      } else if (letter === selectedVal && letter !== correctAnswer) {
        opt.classList.add("incorrect");
      }
    }

    if (selectedVal === correctAnswer) correct++;
    if (selectedVal !== correctAnswer) wrong.push(i);

    exp = document.getElementById(quizId + "-exp-" + i);
    if (exp) exp.classList.add("visible");
  }

  scoreEl = document.getElementById(quizId + "-score");
  scoreNum = document.getElementById(quizId + "-score-num");
  scoreLabel = document.getElementById(quizId + "-score-label");
  if (scoreEl && scoreNum && scoreLabel) {
    scoreNum.textContent = correct + " / " + total;
    pct = Math.round((correct / total) * 100);
    msg = pct >= 80 ? "Excellent! Keep it up!" : pct >= 50 ? "Good effort! Review the explanations." : "Keep practicing. Review the explanations below.";
    scoreLabel.textContent = pct + "% \u2014 " + msg;
    scoreEl.classList.add("visible");
  }

  btn = document.querySelector("#" + quizId + " .quiz-submit-all");
  if (btn) btn.style.display = "none";

  if (wrong.length) {
    _tutorWrongQuestions(quizId, total, wrong);
  }
};

function _tutorWrongQuestions(quizId, total, wrongIndexes) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions || !wrongIndexes.length) return;

  var subjectSlug = "";
  var formLevel = "";
  var slugMap = { mathematics:"mathematics", math:"mathematics", chemistry:"chemistry", physics:"physics" };
  var m = (data.meta || "").match(/^([A-Za-z ]+)\s*(\u2022)?\s*Form\s*([IVX]+)/i);
  if (m) {
    var label = slugMap[m[1].trim().toLowerCase()];
    if (label) subjectSlug = label;
    var roman = m[3];
    formLevel = (roman === "I") ? "1" : (roman === "II") ? "2" : (roman === "III") ? "3" : "4";
  }

  var parts = [];
  wrongIndexes.forEach(function(idx) {
    var q = data.questions[idx];
    if (!q) return;
    var chosen = null;
    if (q.options) {
      q.options.forEach(function(o) { if (o.letter === q.correct) chosen = o.text; });
    }
    var chosenText = chosen ? chosen : "(question left unanswered)";
    parts.push(
      "QUESTION " + (idx + 1) + ": " + (q.text || "")
      + "\n- Options: " + (q.options || []).map(function(o){ return o.letter + ") " + o.text; }).join("; ")
      + "\n- The student answered: " + chosenText
      + "\n- The correct answer is: " + q.correct
    );
  });

  var question = "A student answered the following questions incorrectly. Please explain, "
    + "in simple step-by-step language a secondary school student will understand, EXACTLY how to arrive at the correct answer for each one. "
    + "Do not just repeat the correct letter \u2014 show the working/method step by step, call out any common mistake the student likely made, and keep the tone encouraging.\n\n"
    + parts.join("\n\n");

  var wrap = document.getElementById(quizId + "-score");
  if (!wrap) return;
  var tutorHtml = '<div class="quiz-tutor" id="' + quizId + '-tutor">'
    + '<div class="quiz-tutor-header"><span class="quiz-tutor-icon">\uD83C\uDF93</span>'
    + '<div><div class="quiz-tutor-title">Let\u2019s Learn: Step-by-Step</div>'
    + '<div class="quiz-tutor-sub">The AI tutor will show you exactly how to solve the ' + wrongIndexes.length + ' question'
    + (wrongIndexes.length > 1 ? "s" : "") + ' you got wrong.</div></div></div>'
    + '<div class="quiz-tutor-body"><div class="tutor-loading"><span class="spinner"></span> Explaining the correct method\u2026</div></div>'
    + '</div>';
  if (wrap.insertAdjacentHTML) {
    wrap.insertAdjacentHTML("afterend", tutorHtml);
  } else if (wrap.parentNode) {
    var tmp = document.createElement("div");
    tmp.innerHTML = tutorHtml;
    while (tmp.firstChild) wrap.parentNode.insertBefore(tmp.firstChild, wrap.nextSibling);
  }

  var body = document.getElementById(quizId + "-tutor").querySelector(".quiz-tutor-body");

  var payload = {
    question: question,
    lesson_context: data.topic
      ? "Topic: " + data.topic
      : (data.meta ? "Subject: " + data.meta : ""),
    subject_slug: subjectSlug || undefined,
    form_level: formLevel ? Number(formLevel) : undefined
  };

  request("/ai/tutoring/explain", {
    method: "POST",
    body: JSON.stringify(payload)
  }).then(function(result) {
    var response = (result && result.response) ? result.response : "";
    if (!response) {
      body.innerHTML = '<div class="tutor-fallback">The AI tutor is temporarily unavailable. Please review the explanations above or ask your teacher for help.</div>';
      return;
    }
    body.innerHTML = '<div class="tutor-response">' + renderTutorMarkdown(response) + '</div>';
  }).catch(function() {
    body.innerHTML = '<div class="tutor-fallback">The AI tutor could not be reached. Please review the explanations above or ask your teacher for help.</div>';
  });
}

function _quizExtractData(quizId) {
  var container = document.getElementById(quizId);
  if (!container) return null;
  var badge = container.querySelector(".quiz-badge");
  var topic = container.querySelector(".quiz-topic");
  var meta = badge ? badge.textContent.trim() : "";
  var topicText = topic ? topic.textContent.replace("Topic:", "").trim() : "";
  var questions = [];
  var qEls = container.querySelectorAll(".quiz-question");
  var i, qEl, qText, opts, j, optEl, letter, optText;
  for (i = 0; i < qEls.length; i++) {
    qEl = qEls[i];
    qText = qEl.querySelector(".quiz-question-text");
    opts = qEl.querySelectorAll(".quiz-option");
    var options = [];
    for (j = 0; j < opts.length; j++) {
      optEl = opts[j];
      letter = optEl.getAttribute("data-letter");
      optText = optEl.querySelector("span:last-child");
      options.push({ letter: letter, text: optText ? optText.textContent.trim() : "" });
    }
    var expEl = qEl.querySelector(".quiz-explanation");
    var expText = expEl ? expEl.textContent.replace("Explanation:", "").trim() : "";
    questions.push({
      num: i + 1,
      text: qText ? qText.textContent.trim() : "",
      options: options,
      correct: qEl.getAttribute("data-correct") || "",
      explanation: expText
    });
  }
  return { meta: meta, topic: topicText, questions: questions };
}

window._quizDownloadWord = function(quizId) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions.length) return;
  var html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>";
  html += "<head><meta charset='utf-8'><title>Quiz</title>";
  html += "<style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}h1{color:#1e3a8a;font-size:20px}h2{color:#333;font-size:15px;margin-top:24px}.q{margin-bottom:16px}.q-text{font-weight:bold;font-size:13px}.opt{margin:4px 0 4px 20px;font-size:12px}.correct{color:#16a34a;font-weight:bold}.exp{color:#555;font-size:11px;margin-left:20px;border-left:3px solid #16a34a;padding-left:8px;margin-top:4px}.meta{color:#666;font-size:12px;margin-bottom:16px}</style></head><body>";
  html += "<h1>Quiz Questions</h1>";
  html += "<div class='meta'>" + data.meta;
  if (data.topic) html += " &bull; Topic: " + data.topic;
  html += "</div>";
  var i, q, j, opt;
  for (i = 0; i < data.questions.length; i++) {
    q = data.questions[i];
    html += "<div class='q'>";
    html += "<div class='q-text'>" + q.num + ". " + q.text + "</div>";
    for (j = 0; j < q.options.length; j++) {
      opt = q.options[j];
      html += "<div class='opt'>" + opt.letter + ". " + opt.text + "</div>";
    }
    html += "<div class='exp'><strong>Answer:</strong> " + q.correct + "</div>";
    if (q.explanation) html += "<div class='exp'>" + q.explanation + "</div>";
    html += "</div>";
  }
  html += "</body></html>";
  var blob = new Blob(["\ufeff" + html], { type: "application/msword" });
  _quizTriggerDownload(blob, "quiz-questions.doc");
};

window._quizDownloadPdf = function(quizId) {
  var data = _quizExtractData(quizId);
  if (!data || !data.questions.length) return;
  var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Quiz</title>";
  html += "<style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.5;color:#111}h1{color:#1e3a8a;font-size:22px;border-bottom:2px solid #1e3a8a;padding-bottom:8px}h2{color:#333;font-size:14px;margin-top:20px}.meta{color:#555;font-size:12px;margin-bottom:16px;padding:8px;background:#f3f4f6;border-radius:6px}.q{margin-bottom:20px;page-break-inside:avoid}.q-text{font-weight:bold;font-size:13px;margin-bottom:4px}.opt{margin:3px 0 3px 24px;font-size:12px}.correct{color:#16a34a;font-weight:bold}.exp{color:#444;font-size:11px;margin-left:24px;border-left:3px solid #16a34a;padding-left:8px;margin-top:4px}@media print{body{margin:20px}.q{page-break-inside:avoid}}</style></head><body>";
  html += "<h1>Quiz Questions</h1>";
  html += "<div class='meta'>" + data.meta;
  if (data.topic) html += " &bull; Topic: " + data.topic;
  html += "</div>";
  var i, q, j, opt;
  for (i = 0; i < data.questions.length; i++) {
    q = data.questions[i];
    html += "<div class='q'>";
    html += "<div class='q-text'>" + q.num + ". " + q.text + "</div>";
    for (j = 0; j < q.options.length; j++) {
      opt = q.options[j];
      html += "<div class='opt'>" + opt.letter + ". " + opt.text + "</div>";
    }
    html += "<div class='exp'><strong>Answer:</strong> " + q.correct + "</div>";
    if (q.explanation) html += "<div class='exp'>" + q.explanation + "</div>";
    html += "</div>";
  }
  html += "</body></html>";
  var win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(function() { win.print(); }, 400);
  }
};

function _quizTriggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}
