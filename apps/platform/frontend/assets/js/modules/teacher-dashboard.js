// modules/teacher-dashboard.js — backward-compatible re-export
// The actual implementation is in modules/teacher/
window.renderTeacherDashboard = async function() {
  const mod = await import('./teacher/index.js');
  await mod.renderTeacherDashboard();
};
