// modules/teacher/plans/state.js — teaching-documents shared state.

function createPlansState(dashboard) {
  return { dashboard, savedPlans: [], activeSubTab: "lesson" };
}