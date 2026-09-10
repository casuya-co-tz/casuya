// modules/teacher/plans/index.js — teaching documents orchestration.
// View orchestration only. Curriculum data + syllabus topic loading live in
// modules/teacher/plans-syllabus.js; document build/preview/export/save helpers in plans-builder.js.

async function loadPlans(dashboard) {
  const state = createPlansState(dashboard);

  dashboard.showView(renderPlansLayout());

  (async function initDocs() {
    await loadSaved(state);
    renderSubTabs(state);
    showPanel(state.activeSubTab);
    renderSavedList(state);

    document.getElementById("tdocs-tabs")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-panel]");
      if (!btn) return;
      state.activeSubTab = btn.dataset.panel;
      renderSubTabs(state);
      showPanel(state.activeSubTab);
      if (state.activeSubTab === "saved") renderSavedList(state);
    });
    document.getElementById("tdoc-refresh")?.addEventListener("click", async () => {
      await loadSaved(state);
      renderSubTabs(state);
      renderSavedList(state);
    });

    setupLessonForm(state);
    setupSchemeForm(state);
    setupActions(state);
  })();
}