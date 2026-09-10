// modules/teacher/plans/lesson.js — lesson-plan generator form (autofill, syllabus wiring, submit).

function setupLessonForm(state) {
  const lessonSs = document.getElementById("tdoc-ss");
  lessonSs?.addEventListener("change", plansLoadSyllabusTopics);
  const lessonFormLevel = document.querySelector("#tdoc-lesson-form [name=form_level]");
  lessonFormLevel?.addEventListener("change", plansLoadSyllabusTopics);
  document.getElementById("tdoc-topic")?.addEventListener("change", plansLoadSubtopicOptions);
  plansLoadSyllabusTopics();

  document.getElementById("tdoc-lesson-seed")?.addEventListener("click", async () => {
    const topicSel = document.getElementById("tdoc-topic");
    const subSel = document.getElementById("tdoc-subtopic");
    const form = document.querySelector("#tdoc-lesson-form");
    if (topicSel && topicSel.options.length > 1) {
      topicSel.selectedIndex = 1;
      topicSel.dispatchEvent(new Event("change"));
      await new Promise(r => setTimeout(r, 0));
      if (subSel && subSel.options.length > 1) subSel.selectedIndex = 1;
    }
    if (form) {
      if (form.period) form.period.value = "Period 1";
      if (form.number_of_students) form.number_of_students.value = "40";
      if (form.students_boys) form.students_boys.value = "20";
      if (form.students_girls) form.students_girls.value = "20";
      if (form.duration_minutes) form.duration_minutes.value = "40";
    }
  });

  document.getElementById("tdoc-lesson-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const resultDiv = document.getElementById("tdoc-lesson-result");
    resultDiv.style.display = "block";
    resultDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Generating lesson plan...</div>';
    try {
      const res = await request("/teacher-plans/generate/lesson-plan", {
        method: "POST",
        body: JSON.stringify({
          subject_slug: fd.get("subject_slug"),
          form_level: parseInt(fd.get("form_level")) || 2,
          topic: fd.get("topic"),
          subtopic: fd.get("subtopic") || null,
          school_name: fd.get("school_name") || null,
          teacher_name: fd.get("teacher_name") || null,
          number_of_students: parseInt(fd.get("number_of_students")) || 40,
          students_boys: fd.get("students_boys") ? parseInt(fd.get("students_boys")) : null,
          students_girls: fd.get("students_girls") ? parseInt(fd.get("students_girls")) : null,
          duration_minutes: parseInt(fd.get("duration_minutes")) || 40,
          period: fd.get("period") || null,
        }),
      });
      await plansSaveGenerated(form, res, "lesson_plan");
      resultDiv.innerHTML = plansRenderGenerated(res, "lesson_plan");
      plansFillGenFrame();
      window.renderMath?.(resultDiv);
    } catch(err) { resultDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
  });
}