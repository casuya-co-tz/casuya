// modules/student/sidebar.js — sidebar helpers for student dashboard.
//
// Provides the updateNotifBadge helper used by the notifications view
// and the getFormFilter helper used by the subjects view. The sidebar
// HTML rendering and event wiring live in StudentDashboard (dashboard.js).

"use strict";

function updateNotifBadge(count) {
  const badge = document.getElementById("notif-badge");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline" : "none";
  }
}

function getFormFilter() {
  return localStorage.getItem("casuya_form_filter") || "";
}
