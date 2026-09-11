// modules/student/index.js — main entry point for student dashboard.
//
// Creates the StudentDashboard instance, registers all view modules,
// and kicks off the dashboard initialization. This replaces the old
// monolithic renderStudentDashboard() closure.

"use strict";

function renderStudentDashboard() {
  const dashboard = new StudentDashboard();

  registerOverviewView(dashboard);
  registerSubjectsView(dashboard);
  registerLessonsView(dashboard);
  registerProgressView(dashboard);
  registerBookmarksView(dashboard);
  registerAssignmentsView(dashboard);
  registerGamesView(dashboard);
  registerExamsView(dashboard);
  registerTestsView(dashboard);
  registerFilesView(dashboard);
  registerLibraryView(dashboard);
  registerPaymentsView(dashboard);
  registerDownloadsView(dashboard);
  registerNotificationsView(dashboard);
  registerSettingsView(dashboard);
  registerClassView(dashboard);
  registerProfileView(dashboard);

  dashboard.init();
}
