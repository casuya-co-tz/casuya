// modules/student-dashboard.js — backward-compatible wrapper.
//
// The original 2,448-line closure-based implementation has been refactored
// into a class-based module architecture under modules/student/*.js.
//
// This file preserves the original renderStudentDashboard() entry point
// so that dashboards.js and any other callers continue to work without
// changes.  The actual implementation lives in:
//
//   modules/student/index.js      — entry point
//   modules/student/dashboard/state.js  — StudentDashboard class
//   modules/student/dashboard/sidebar.js — sidebar helpers
//   modules/student/dashboard/bootstrap.js — startup & lifecycle
//   modules/student/overview.js   — dashboard overview
//   modules/student/subjects.js   — subject/topic/subtopic browser
//   modules/student/lessons/      — lesson viewer (cache/builders/iframe/interactions/viewer)
//   modules/student/progress.js   — progress tracking
//   modules/student/bookmarks.js  — bookmarks
//   modules/student/assignments.js — assignments
//   modules/student/games.js      — games
//   modules/student/exams.js      — exam papers
//   modules/student/files.js      — file management
//   modules/student/library.js    — reference library
//   modules/student/payments.js   — payments & plans
//   modules/student/downloads.js  — offline downloads
//   modules/student/notifications.js — notifications
//   modules/student/settings.js   — settings & appearance
//   modules/student/class-view.js — My Class view
//   modules/student/profile.js    — profile editor
//   modules/student/utils.js      — shared utilities
//
// When bundled, all student/*.js files are concatenated BEFORE this file,
// so renderStudentDashboard is already defined. This wrapper is kept for
// backward compatibility and as a safety net.

"use strict";

// If the new module entry point hasn't loaded yet (e.g. during testing or
// an unusual load order), fall back to an informative error.
if (typeof renderStudentDashboard !== "function") {
  var renderStudentDashboard = function () {
    console.error(
      "renderStudentDashboard is not defined. " +
      "Ensure the student/*.js modules are loaded before student-dashboard.js."
    );
  };
}
