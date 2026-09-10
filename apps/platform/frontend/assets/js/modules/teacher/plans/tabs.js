// modules/teacher/plans/tabs.js — teaching-documents sub-tabs.

function renderSubTabs(state) {
  const ss = document.querySelector("#tdoc-ss")?.value || "mathematics";
  const sw = plansIsSwSubject(ss);
  const labels = {
    lesson: sw ? "Mpango wa Somo" : "Lesson Plan",
    scheme: "Scheme of Work",
    saved: state.savedPlans.length ? `Saved (${state.savedPlans.length})` : (sw ? "Hati Zilizohifadhiwa" : "Saved Documents"),
  };
  const tabHtml = (["lesson", "scheme", "saved"]).map(key =>
    `<button class="btn btn-sm tdocs-tab ${state.activeSubTab === key ? "btn-primary" : "btn-outline"}" data-panel="${key}" style="flex:1 1 auto;min-width:0">${escapeHtml(labels[key])}</button>`
  ).join("");
  const el = document.getElementById("tdocs-tabs");
  if (el) el.innerHTML = tabHtml;
}

function showPanel(panel) {
  const lesson = document.getElementById("tdocs-lesson-panel");
  const scheme = document.getElementById("tdocs-scheme-panel");
  const saved = document.getElementById("tdocs-saved-panel");
  if (lesson) lesson.style.display = panel === "lesson" ? "" : "none";
  if (scheme) scheme.style.display = panel === "scheme" ? "" : "none";
  if (saved) saved.style.display = panel === "saved" ? "" : "none";
}