// Student blackboard embed for Casuya platform.
// Mounts a blackboard into any element marked with [data-blackboard].
// Requires the blackboard UMD bundle (blackboard.umd.js) loaded before this.
(function () {
  const API_BASE = window.casuyaApiBase ? window.casuyaApiBase()
    : (window.location.port === "8765" || window.location.port === "" || window.location.port === "443" || window.location.port === "80")
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:8765`;

  function request(path, options) {
    const token = localStorage.getItem("casuya_token");
    const headers = { "Content-Type": "application/json", ...(options && options.headers) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, { ...options, headers })
      .then(async (r) => {
        if (!r.ok) {
          let detail = r.statusText || "Request failed";
          try {
            const errBody = await r.json();
            if (errBody && errBody.detail) detail = String(errBody.detail);
          } catch (e) { /* non-JSON error body */ }
          throw new Error(detail);
        }
        return r.json();
      });
  }

  let ocrAvailable = null;
  async function isOcrAvailable() {
    if (ocrAvailable !== null) return ocrAvailable;
    const token = localStorage.getItem("casuya_token");
    if (!token) {
      ocrAvailable = false;
      return false;
    }
    try {
      const status = await request("/v1/ocr/status");
      ocrAvailable = !!(status && status.available);
    } catch {
      ocrAvailable = false;
    }
    return ocrAvailable;
  }

  async function recognizeDrawing(bb) {
    if (!bb || typeof bb.toDataURL !== "function") return null;
    if (!(await isOcrAvailable())) return null;
    try {
      const image = bb.toDataURL("image/png").replace(/^data:image\/[^;]+;base64,/, "");
      if (!image || image.length < 32) return null;
      return await request("/v1/ocr/handwriting", {
        method: "POST",
        body: JSON.stringify({ image }),
      });
    } catch {
      return null;
    }
  }

  // Lazy-load the (110KB) blackboard UMD vendor on demand, so students who never
  // open a blackboard lesson don't pay for it on every portal load.
  var vendorLoading = null;
  function ensureVendor() {
    if (window.CasuyaBlackboard && window.CasuyaBlackboard.Blackboard) {
      return Promise.resolve(true);
    }
    if (!vendorLoading) {
      vendorLoading = new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = (typeof casuyaAssetUrl === "function")
          ? casuyaAssetUrl("/assets/js/vendor-blackboard.min.js")
          : "/assets/js/vendor-blackboard.min.js";
        s.async = true;
        s.onload = function () {
          resolve(!!(window.CasuyaBlackboard && window.CasuyaBlackboard.Blackboard));
        };
        s.onerror = function () {
          resolve(false);
        };
        document.head.appendChild(s);
      });
    }
    return vendorLoading;
  }

  async function mountBlackboard(container, opts) {
    const vendorReady = await ensureVendor();
    if (!vendorReady || !window.CasuyaBlackboard || !window.CasuyaBlackboard.Blackboard) {
      if (container) {
        container.innerHTML =
          '<div style="padding:1rem;color:#b91c1c">Blackboard failed to load. Check your connection.</div>';
      }
      return;
    }

    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
      container.style.touchAction = 'none';
      container.style.webkitOverflowScrolling = 'touch';
    }

    const lessonId = opts.lessonId || container.dataset.lessonId || "demo";
    const quizQuestionId = container.dataset.quizQuestion || container.dataset.examQuestion || "";
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const progressLessonId = UUID_RE.test(String(lessonId))
      ? lessonId
      : ((String(lessonId).match(UUID_RE) || [])[0] || null);
    let studentId = opts.studentId || null;
    const token = localStorage.getItem("casuya_token");
    if (token) {
      try {
        const me = await request("/students/me");
        studentId = me && (me.id || me.user_id);
      } catch (e) {}
    }

    const bb = new window.CasuyaBlackboard.Blackboard({
      container,
      graph: false,
      width: container.clientWidth || 800,
      height: container.clientHeight || 420,
    });

    // Store the instance on the element so consumers (e.g. assignment
    // submissions) can grab it via element._casuyaBlackboard.
    container._casuyaBlackboard = bb;

    if (studentId && progressLessonId && !quizQuestionId && typeof bb.importJSON === "function") {
      try {
        const saved = await request(`/progress/${studentId}/${progressLessonId}`);
        if (saved && Array.isArray(saved.elements) && saved.elements.length) {
          bb.importJSON({ elements: saved.elements, width: 880, height: 560 });
        }
      } catch (e) { /* no saved snapshot */ }
    }

    let saveTimer = null;
    const startTime = Date.now();
    const sessionId = "bb-" + Math.random().toString(36).slice(2, 10);
    const syncProgress = () => {
      if (!studentId || !progressLessonId || quizQuestionId) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const elements = bb.getElements ? bb.getElements() : [];
        const totalSteps = elements.length || 1;
        request("/progress/sync", {
          method: "POST",
          body: JSON.stringify({
            student_id: studentId,
            lesson_id: progressLessonId,
            session_id: sessionId,
            elapsed_ms: Date.now() - startTime,
            completion_percentage: Math.min(100, (totalSteps / Math.max(totalSteps, 1)) * 100),
            step: elements.length || 1,
            elements,
          }),
        }).catch(() => {});
      }, 2000);
    };
    bb.on("change", syncProgress);

    async function mountRecognizeButton() {
      if (!(await isOcrAvailable())) return;
      container.style.position = container.style.position || "relative";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn casuya-ocr-recognize";
      btn.textContent = "\u270D Recognize";
      btn.title = "Convert handwriting to text or LaTeX";
      btn.setAttribute("aria-label", "Recognize handwriting");
      btn.style.cssText =
        "position:absolute;top:8px;right:8px;z-index:5;font-size:0.8rem;padding:0.35rem 0.65rem;";
      btn.addEventListener("click", async function onRecognizeClick() {
        const elements = bb.getElements ? bb.getElements() : [];
        if (!elements.length) {
          if (typeof bb.showToast === "function") bb.showToast("Draw something first");
          return;
        }
        btn.disabled = true;
        const prevLabel = btn.textContent;
        btn.textContent = "Recognizing\u2026";
        const ocr = await recognizeDrawing(bb);
        btn.disabled = false;
        btn.textContent = prevLabel;
        if (ocr && ocr.latex) {
          bb._recognizedLatex = String(ocr.latex).trim();
          if (typeof bb.insertLaTeX === "function" && bb._recognizedLatex) {
            bb.insertLaTeX(bb._recognizedLatex);
          }
          if (typeof bb.showToast === "function") {
            const preview = bb._recognizedLatex.length > 40
              ? bb._recognizedLatex.slice(0, 40) + "\u2026"
              : bb._recognizedLatex;
            bb.showToast("Recognized: " + preview);
          }
        } else if (typeof bb.showToast === "function") {
          bb.showToast("Could not recognize handwriting");
        }
      });
      container.appendChild(btn);
    }
    mountRecognizeButton().catch(function () {});

    // Snapshot helpers: centralize how work is extracted so quiz/exam wiring
    // can treat "Show your work" as graded input rather than decoration.
    function extractLatex(elements) {
      if (!Array.isArray(elements) || elements.length === 0) return "";
      const texts = elements
        .filter((el) => el && (el.tool === "text" || el.tool === "katex") && (el.content || el.latex))
        .map((el) => el.content || el.latex || "")
        .join(" ")
        .trim();
      // Fallback: if only drawings, return a placeholder that still counts as "work present"
      if (texts) return texts;
      return elements.length > 0 ? "__drawing__" : "";
    }

    function getWorkSnapshot() {
      try {
        const elements = bb.getElements ? bb.getElements() : (bb.getSnapshot ? bb.getSnapshot().elements : []);
        let recognizedLatex = extractLatex(elements);
        if (recognizedLatex === "__drawing__" && bb._recognizedLatex) {
          recognizedLatex = bb._recognizedLatex;
        }
        return { elements, recognizedLatex, hasWork: elements.length > 0 };
      } catch {
        return { elements: [], recognizedLatex: "", hasWork: false };
      }
    }

    async function getWorkSnapshotAsync() {
      const snap = getWorkSnapshot();
      if (snap.recognizedLatex !== "__drawing__") return snap;
      const ocr = await recognizeDrawing(bb);
      if (ocr && ocr.latex) {
        snap.recognizedLatex = String(ocr.latex).trim();
      }
      return snap;
    }

    // Expose helpers that talk to the blackboard REST endpoints directly.
    const api = {
      studentId,
      lessonId,
      blackboard: bb,
      getWorkSnapshot,
      getWorkSnapshotAsync,
      recognizeDrawing,
      extractLatex,
      submitExam(steps) {
        return request("/api/exams/submit", {
          method: "POST",
          body: JSON.stringify({
            lessonId,
            studentId: studentId || "anonymous",
            steps: steps || [],
          }),
        });
      },
      validateStep(step) {
        return request("/api/exams/validate-step", {
          method: "POST",
          body: JSON.stringify({ lessonId, studentId: studentId || "anonymous", step }),
        });
      },
      solveMath(equation) {
        return request("/api/math/solve", {
          method: "POST",
          body: JSON.stringify({ equation }),
        });
      },
      checkEquivalence(expr1, expr2) {
        return request("/api/math/equivalence", {
          method: "POST",
          body: JSON.stringify({ expr1, expr2 }),
        });
      },
    };
    // Expose snapshot directly on the board instance for consumers that
    // grab bb via element._casuyaBlackboard (e.g. exam submit).
    bb.getWorkSnapshot = getWorkSnapshot;
    bb.getWorkSnapshotAsync = getWorkSnapshotAsync;

    window.dispatchEvent(new CustomEvent("casuya:blackboard-ready", { detail: { blackboard: bb, api } }));
  }

  // Collect all show-your-work boards matching a selector (e.g. per-question boards).
  // Returns: { questionId: { elements, recognizedLatex, hasWork, lessonId } }
  function collectWorkMap(selector) {
    const sel = selector || "[data-blackboard][data-quiz-question], [data-blackboard][data-exam-question]";
    const out = {};
    document.querySelectorAll(sel).forEach((el) => {
      const qid = el.dataset.quizQuestion || el.dataset.examQuestion || el.dataset.lessonId || el.id;
      if (!qid) return;
      const bb = el._casuyaBlackboard;
      let snap = { elements: [], recognizedLatex: "", hasWork: false };
      if (bb && bb.getWorkSnapshot) snap = bb.getWorkSnapshot();
      else if (bb && bb.getElements) {
        const elements = bb.getElements();
        snap = { elements, recognizedLatex: elements.length > 0 ? "__drawing__" : "", hasWork: elements.length > 0 };
      } else if (bb && bb.getSnapshot) {
        try { const s = bb.getSnapshot(); snap = { elements: s.elements || [], recognizedLatex: (s.elements && s.elements.length ? "__drawing__" : ""), hasWork: (s.elements && s.elements.length > 0) }; } catch {}
      }
      out[qid] = { ...snap, lessonId: el.dataset.lessonId || "" };
    });
    return out;
  }

  async function enrichWorkWithOcr(workMap) {
    const enriched = { ...workMap };
    await Promise.all(
      Object.entries(enriched).map(async ([qid, snap]) => {
        if (!snap || snap.recognizedLatex !== "__drawing__") return;
        const el =
          document.querySelector(`[data-quiz-question="${qid}"]`) ||
          document.querySelector(`[data-exam-question="${qid}"]`) ||
          document.querySelector(`[data-blackboard][data-lesson-id="${qid}"]`);
        const bb = el && el._casuyaBlackboard;
        if (!bb) return;
        const ocr = bb.getWorkSnapshotAsync ? await bb.getWorkSnapshotAsync() : await recognizeDrawing(bb);
        const latex = ocr && (ocr.recognizedLatex || ocr.latex);
        if (latex && latex !== "__drawing__") snap.recognizedLatex = String(latex).trim();
      }),
    );
    return enriched;
  }

  // Grade work presence/validity by calling the grading engine via proxy.
  // Falls back to local presence check if the service is unavailable.
  async function gradeWorkMap(workMap, expectedAnswers) {
    workMap = await enrichWorkWithOcr(workMap);
    const entries = Object.entries(workMap);
    if (entries.length === 0) return { workScore: 0, workTotal: 0, workPercentage: 0, stepResults: [] };
    const stepResults = [];
    let workScore = 0;
    for (let i = 0; i < entries.length; i++) {
      const [qid, snap] = entries[i];
      if (!snap.hasWork) {
        stepResults.push({ questionId: qid, correct: false, score: 0, maxScore: 1, feedback: "No work shown", hasWork: false });
        continue;
      }
      const expected = expectedAnswers ? expectedAnswers[qid] : undefined;
      // If grading service is reachable, validate; otherwise count presence as 1 point.
      try {
        const res = await request("/api/exams/validate-step", {
          method: "POST",
          body: JSON.stringify({
            step: {
              stepNumber: i + 1,
              recognizedLatex: snap.recognizedLatex || "__drawing__",
              expectedAnswer: expected || snap.recognizedLatex || "__drawing__",
              elements: snap.elements,
            },
          }),
        });
        // validateStep returns { stepNumber, correct, score, maxScore, feedback }
        const correct = res && (res.correct === true || res.score > 0);
        const score = res && typeof res.score === "number" ? res.score : (correct ? 1 : snap.hasWork ? 1 : 0);
        const maxScore = res && typeof res.maxScore === "number" ? res.maxScore : 1;
        // For drawings without OCR, treat presence as full credit for that step (can't meaningfully diff)
        const finalScore = snap.recognizedLatex === "__drawing__" ? 1 : score;
        workScore += finalScore;
        stepResults.push({ questionId: qid, correct: finalScore > 0, score: finalScore, maxScore, feedback: (res && res.feedback) || "Work captured", hasWork: true, recognizedLatex: snap.recognizedLatex });
      } catch {
        // Offline / service down: presence = full credit
        workScore += 1;
        stepResults.push({ questionId: qid, correct: true, score: 1, maxScore: 1, feedback: "Work captured (offline)", hasWork: true, recognizedLatex: snap.recognizedLatex });
      }
    }
    const workTotal = entries.length;
    const workPercentage = workTotal > 0 ? Math.round((workScore / workTotal) * 100) : 0;
    return { workScore, workTotal, workPercentage, stepResults };
  }

  function autoMount() {
    document.querySelectorAll("[data-blackboard]").forEach((el) => {
      if (el._casuyaMounted) return;
      el._casuyaMounted = true;
      mountBlackboard(el, {}).catch(() => {});
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }

  window.CasuyaBlackboardEmbed = { mountBlackboard, autoMount, request, collectWorkMap, gradeWorkMap };
})();

