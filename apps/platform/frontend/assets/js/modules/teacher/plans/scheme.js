// modules/teacher/plans/scheme.js — scheme-of-work generator form submit.

function setupSchemeForm(state) {
  document.getElementById("tdoc-scheme-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const resultDiv = document.getElementById("tdoc-scheme-result");
    resultDiv.style.display = "block";
    resultDiv.innerHTML = '<div class="tutor-thinking"><div class="tutor-thinking-dots"><span></span><span></span><span></span></div>Generating scheme of work...</div>';
    try {
      const topicsRaw = (fd.get("topics") || "").split(",").map(t => t.trim()).filter(Boolean);
      const res = await request("/teacher-plans/generate/scheme-of-work", {
        method: "POST",
        body: JSON.stringify({
          subject_slug: fd.get("subject_slug"),
          form_level: parseInt(fd.get("form_level")) || 2,
          term: fd.get("term"),
          academic_year: fd.get("academic_year") || null,
          school_name: fd.get("school_name") || null,
          teacher_name: fd.get("teacher_name") || null,
          topics: topicsRaw.length ? topicsRaw : null,
        }),
      });
      await plansSaveGenerated(form, res, "scheme_of_work");
      resultDiv.innerHTML = plansRenderGenerated(res, "scheme_of_work");
      plansFillGenFrame();
      window.renderMath?.(resultDiv);
    } catch(err) { resultDiv.innerHTML = `<p style="color:var(--color-danger)">Error: ${escapeHtml(err.message)}</p>`; }
  });
}