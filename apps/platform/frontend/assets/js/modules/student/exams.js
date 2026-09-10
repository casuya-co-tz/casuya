// modules/student/exams.js — exam papers list and exam-taking view.

"use strict";

function registerExamsView(d) {
  async function loadStudentExams() {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading exams...</p></div>');
    try {
      const quizzes = await request("/quizzes");
      const quizList = Array.isArray(quizzes) ? quizzes : [];
      let examHistory = [];
      try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}

      d.showView(`
        <div class="content">
          <h2>Exams</h2>
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">Take timed exams. Your progress is saved automatically.</p>
          ${quizList.length === 0 ? '<div class="empty-state" style="margin-top:1rem"><p>No exams available yet.</p></div>' : `
            <div class="card-grid" style="margin-top:1rem">
              ${quizList.map(q => {
                const history = examHistory.filter(h => h.quizId === q.id);
                const bestScore = history.length > 0 ? Math.max(...history.map(h => h.combined_percentage != null ? h.combined_percentage : h.percentage)) : null;
                const bestWork = history.length > 0 ? Math.max(...history.map(h => h.work_percentage ?? 0)) : 0;
                return `
                  <div class="card" style="padding:1rem">
                    <h3 style="margin:0">${escapeHtml(q.title || "Exam")}</h3>
                    <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.25rem">${q.question_count ?? q.questions?.length ?? 0} questions</p>
                    ${bestScore !== null ? `<p style="color:var(--color-success);font-size:0.85rem;margin-top:0.15rem">Best: ${bestScore}%${bestWork ? ` <span style="color:var(--color-text-muted);font-size:0.75rem">(work ${bestWork}%)</span>` : ''}</p>` : ''}
                    <button class="btn btn-primary btn-sm start-exam-btn" data-quiz-id="${q.id}" style="margin-top:0.5rem">Start Exam</button>
                  </div>
                `;
              }).join("")}
            </div>
          `}
          ${examHistory.length > 0 ? `
            <h3 style="margin:1.5rem 0 0.75rem">Exam History</h3>
            <div class="card" style="padding:1rem">
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
                  <tr style="border-bottom:1px solid var(--color-border)">
                    <th style="padding:0.5rem;text-align:left">Quiz</th>
                    <th style="padding:0.5rem;text-align:left">Score</th>
                    <th style="padding:0.5rem;text-align:left">Date</th>
                  </tr>
                  ${examHistory.slice(-10).reverse().map(h => {
                    const dispPct = h.combined_percentage != null ? h.combined_percentage : h.percentage;
                    const workInfo = h.work_percentage != null ? ` + work ${h.work_score}/${h.work_total}` : '';
                    return `
                    <tr style="border-bottom:1px solid var(--color-border)">
                      <td style="padding:0.5rem">${escapeHtml(h.quizTitle || "Quiz")}</td>
                      <td style="padding:0.5rem;color:${dispPct >= 50 ? 'var(--color-success)' : 'var(--color-danger)'}">${h.score}/${h.total} (${h.percentage}%${workInfo} → <strong>${dispPct}%</strong>)</td>
                      <td style="padding:0.5rem;color:var(--color-text-muted)">${new Date(h.takenAt).toLocaleDateString()}</td>
                    </tr>
                  `}).join("")}
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      `);
      document.querySelectorAll(".start-exam-btn").forEach(btn => {
        btn.addEventListener("click", () => d.callView("start-exam", btn.dataset.quizId));
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading exams</p></div>'); }
  }

  async function startExam(quizId) {
    d.showView('<div class="loading-state"><div class="spinner"></div><p>Loading exam...</p></div>');
    try {
      const quizData = await request(`/quizzes/${quizId}`);
      if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        d.showView('<div class="empty-state"><p>No questions in this exam.</p><button class="btn" id="back-btn">← Back</button></div>');
        document.getElementById("back-btn")?.addEventListener("click", () => d.callView("exams"));
        return;
      }

      let timeLimit = quizData.time_limit || 30 * 60;
      let timeLeft = timeLimit;
      let examSubmitted = false;

      const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

      d.showView(`
        <div class="content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding:0.75rem 1rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)">
            <h2 style="margin:0;font-size:1rem">${escapeHtml(quizData.title || "Exam")}</h2>
            <div style="display:flex;align-items:center;gap:1rem">
              <span id="exam-timer" style="font-size:1.1rem;font-weight:700;color:var(--color-primary);font-variant-numeric:tabular-nums">${formatTime(timeLeft)}</span>
              <button class="btn btn-danger btn-sm" id="submit-exam-btn">Submit</button>
            </div>
          </div>
          <form id="exam-form">
            ${quizData.questions.map((q, qi) => `
              <div class="card" style="padding:1rem;margin-bottom:0.75rem">
                <p style="font-weight:600;margin:0 0 0.75rem">${qi + 1}. ${escapeHtml(q.prompt)}</p>
                ${q.options.map(o => `
                  <label style="display:block;padding:0.5rem 0.75rem;cursor:pointer;border:1px solid var(--color-border);border-radius:var(--radius);margin-bottom:0.35rem;transition:background 0.15s">
                    <input type="radio" name="q_${escapeHtml(q.id)}" value="${escapeHtml(o.id)}" required style="margin-right:0.5rem"> ${escapeHtml(o.text)}
                  </label>
                `).join("")}
                <details style="margin-top:0.5rem">
                  <summary style="cursor:pointer;font-size:0.85rem;color:var(--color-text-muted)">Show your work</summary>
                  <div data-blackboard data-lesson-id="exam-${quizId}-${escapeHtml(q.id)}" data-exam-question="${escapeHtml(q.id)}" style="width:100%;height:250px;border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden;margin-top:0.5rem"></div>
                </details>
              </div>
            `).join("")}
          </form>
          <div id="exam-result" style="display:none;margin-top:1rem"></div>
        </div>
      `);

      if (window.CasuyaBlackboardEmbed) { window.CasuyaBlackboardEmbed.autoMount(); }
      document.querySelectorAll("details").forEach(el => {
        const bbDiv = el.querySelector("[data-blackboard]");
        if (!bbDiv) return;
        const summ = el.querySelector("summary");
        if (!summ) return;
        const baseLabel = summ.textContent.trim();
        const check = () => {
          const bb = bbDiv._casuyaBlackboard;
          const has = bb && bb.getElements && bb.getElements().length > 0;
          summ.textContent = has ? `${baseLabel} — ✅ work captured` : baseLabel;
          summ.style.color = has ? "var(--color-success)" : "var(--color-text-muted)";
          summ.style.fontWeight = has ? "600" : "";
        };
        bbDiv.addEventListener("click", () => setTimeout(check, 100));
        const hook = setInterval(() => {
          const bb = bbDiv._casuyaBlackboard;
          if (bb && bb.on) { bb.on("change", check); clearInterval(hook); }
          if (!document.body.contains(bbDiv)) clearInterval(hook);
        }, 500);
        setTimeout(check, 800);
      });

      const timerEl = document.getElementById("exam-timer");
      const timerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = formatTime(timeLeft);
        if (timeLeft <= 0 && !examSubmitted) {
          clearInterval(timerInterval);
          submitExam();
        }
        if (timeLeft <= 60 && timerEl) timerEl.style.color = "var(--color-danger)";
      }, 1000);

      async function submitExam() {
        if (examSubmitted) return;
        examSubmitted = true;
        clearInterval(timerInterval);
        const submitBtn = document.getElementById("submit-exam-btn");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting..."; }
        const answers = {};
        quizData.questions.forEach(q => {
          const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
          if (sel) answers[q.id] = sel.value;
        });
        let work = null;
        try {
          if (window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.collectWorkMap) {
            work = window.CasuyaBlackboardEmbed.collectWorkMap("[data-exam-question]");
          } else {
            work = {};
            document.querySelectorAll("[data-exam-question]").forEach(el => {
              const qid = el.dataset.examQuestion;
              const bb = el._casuyaBlackboard;
              if (bb && bb.getWorkSnapshot) work[qid] = bb.getWorkSnapshot();
              else if (bb && bb.getElements) { const els = bb.getElements(); work[qid] = { elements: els, hasWork: els.length>0, recognizedLatex: els.length>0?"__drawing__":"" }; }
            });
          }
          if (work && Object.keys(work).length === 0) work = null;
        } catch {}
        try {
          const body = work ? { answers, work } : { answers };
          const result = await request(`/quizzes/${quizId}/submit`, {
            method: "POST", body: JSON.stringify(body),
          });
          let extraStepFeedback = null;
          if (work && window.CasuyaBlackboardEmbed && window.CasuyaBlackboardEmbed.gradeWorkMap) {
            try { extraStepFeedback = await window.CasuyaBlackboardEmbed.gradeWorkMap(work, null); } catch {}
          }
          let examHistory = [];
          try { examHistory = JSON.parse(localStorage.getItem("casuya_exam_history") || "[]"); } catch(e) {}
          const finalPct = result.combined_percentage != null ? result.combined_percentage : result.percentage;
          examHistory.push({
            quizId,
            quizTitle: quizData.title,
            score: result.score,
            total: result.total,
            percentage: Math.round(result.percentage),
            work_score: result.work_score,
            work_total: result.work_total,
            work_percentage: result.work_percentage,
            combined_percentage: result.combined_percentage != null ? Math.round(result.combined_percentage) : Math.round(result.percentage),
            timeSpent: timeLimit - timeLeft,
            takenAt: Date.now(),
          });
          localStorage.setItem("casuya_exam_history", JSON.stringify(examHistory));

          const passed = finalPct >= 50;
          const hasWork = result.work_score != null;
          document.getElementById("exam-result").innerHTML = `
            <div class="card" style="padding:1.5rem;text-align:center">
              <h3 style="color:${passed ? 'var(--color-success)' : 'var(--color-danger)'};margin:0 0 0.5rem">Exam ${passed ? 'Passed!' : 'Not Passed'}</h3>
              <p style="font-size:1.5rem;font-weight:700;margin:0.5rem 0">Score: ${result.score}/${result.total} (${Math.round(result.percentage)}%)</p>
              ${hasWork ? `<p style="font-size:0.95rem;margin:0.25rem 0">Work: ${result.work_score}/${result.work_total} (${Math.round(result.work_percentage)}%) · <strong>Combined: ${Math.round(finalPct)}%</strong> <span style="font-size:0.8rem;color:var(--color-text-muted)">(70% answer + 30% work)</span></p>` : ``}
              ${hasWork && result.work_score < result.work_total ? `<p style="font-size:0.8rem;color:var(--color-text-muted)">You left ${result.work_total - result.work_score} "Show your work" board(s) empty.</p>` : ``}
              ${extraStepFeedback && extraStepFeedback.stepResults && extraStepFeedback.stepResults.length ? `<div style="text-align:left;margin-top:0.75rem;font-size:0.85rem">${extraStepFeedback.stepResults.map((s,i)=>`<div style="padding:0.25rem 0;border-bottom:1px solid var(--color-border)"><span style="font-weight:600">Q${i+1} work:</span> ${escapeHtml(s.feedback)} ${s.hasWork ? '✅' : '⬜'}</div>`).join("")}</div>` : ``}
              <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">Time: ${formatTime(timeLimit - timeLeft)}</p>
              <button class="btn btn-primary" id="back-to-exams" style="margin-top:1rem">Back to Exams</button>
            </div>
          `;
          document.getElementById("exam-result").style.display = "block";
          document.getElementById("exam-form").style.display = "none";
          document.getElementById("back-to-exams")?.addEventListener("click", () => d.callView("exams"));
        } catch(err) {
          document.getElementById("exam-result").innerHTML = `<div class="card" style="padding:1rem"><p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p></div>`;
          document.getElementById("exam-result").style.display = "block";
        }
      }

      document.getElementById("submit-exam-btn")?.addEventListener("click", () => {
        if (!examSubmitted && confirm("Submit exam?")) submitExam();
      });
    } catch(e) { d.showView('<div class="empty-state"><p>Error loading exam</p></div>'); }
  }

  d.registerView("exams", loadStudentExams);
  d.registerView("start-exam", startExam);
}
