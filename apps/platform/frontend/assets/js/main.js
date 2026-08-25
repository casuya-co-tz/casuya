// main.js — bootstrap/glue. Loaded AFTER modules/*.js (classic scripts, shared global scope).
// Derive the API base the same way auth-client.js does: when the page is
// served from the API host (port 8765) use same-origin, otherwise assume the
// backend runs on :8765. This keeps dev (separate frontend port) and a
// reverse-proxied production deploy behaviour consistent.
// --- Login ---
// --- App Router ---
// --- Student Dashboard ---
// --- Admin Dashboard ---
// --- Teacher Dashboard ---
document.addEventListener("DOMContentLoaded", () => {
  applyAppearance();
  const token = localStorage.getItem("casuya_token");
  if (token) {
    renderApp();
  } else {
    renderLogin();
  }
});
