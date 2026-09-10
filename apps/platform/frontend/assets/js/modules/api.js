// modules/api.js — Facade that re-exports everything from the split modules.
// All symbols are globals after build-js.mjs strips ESM keywords.

// Re-export api-cache globals (already on window from api-cache.js)
// clearRequestCaches, requestCache, inFlight, CACHE_TTL

// Re-export api-auth globals (already on window from api-auth.js)
// decodeToken, tokenNeedsRefresh, refreshAuthToken

// Re-export api-client globals (already on window from api-client.js)
// API_HOST, API_PROTOCOL, API_BASE, render, escapeHtml, injectNodeBase,
// timeAgo, showToast, confirmDelete, deleteBtn, initDeleteButtons,
// renderTutorMarkdown, renderQuizQuestions, renderMath,
// _quizSubmit, _tutorWrongQuestions, _quizExtractData,
// _quizDownloadWord, _quizDownloadPdf, _quizTriggerDownload,
// streamTutorResponse, request
