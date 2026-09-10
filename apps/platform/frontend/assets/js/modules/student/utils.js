// modules/student/utils.js — shared utilities for student dashboard views.
//
// Provides convenience aliases for global functions used across view modules.
// All globals (escapeHtml, request, render, showToast, etc.) are already
// available in the shared global scope — these are re-exported for clarity.

"use strict";

const studentUtils = Object.freeze({
  escapeHtml,
  decodeToken,
  render,
  request,
  showToast,
  timeAgo,
  handleLogout,
  examPaperMetaLine,
  renderExamPaper,
  bindExamScore,
  injectNodeBase,
  appearancePanelHTML,
  setupAppearanceControls,
  get API_BASE() { return API_BASE; },
  get globalAbort() { return _globalAbort; },
});
