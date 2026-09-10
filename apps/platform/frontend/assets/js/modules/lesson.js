// modules/lesson.js — backward-compatible facade (classic script, shared global scope).
// The lesson viewer was split into focused modules:
//   - modules/lesson/lesson-content.js  (bridge script + quiz/games section builders)
//   - modules/lesson/lesson-viewer/     (viewLessonContent implementation + helpers)
// This file is kept so existing bundle lists / script tags continue to resolve the
// same module id. The sub-modules must be loaded before this file.