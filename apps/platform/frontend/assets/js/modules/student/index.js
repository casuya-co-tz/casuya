// modules/student/index.js — main entry point for student dashboard.
//
// Creates the StudentDashboard instance, registers all view modules,
// and kicks off the dashboard initialization. This replaces the old
// monolithic renderStudentDashboard() closure.

"use strict";

function renderStudentDashboard() {
  const dashboard = new StudentDashboard();
  window._casuyaStudentDashboard = dashboard;

  registerOverviewView(dashboard);
  registerSubjectsView(dashboard);
  registerLessonsView(dashboard);
  registerProgressView(dashboard);
  registerBookmarksView(dashboard);
  registerAssignmentsView(dashboard);
  registerNotificationsView(dashboard);
  registerSettingsView(dashboard);
  registerClassView(dashboard);
  registerProfileView(dashboard);
  registerLazyStudentViews(dashboard);

  dashboard.init();

  var prefetch = function () {
    if (typeof dashboard._prefetchExtras === "function") dashboard._prefetchExtras();
    if (typeof ensureSpeechBundle === "function") ensureSpeechBundle();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(prefetch, { timeout: 8000 });
  } else {
    setTimeout(prefetch, 4000);
  }
}
