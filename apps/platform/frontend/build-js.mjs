// build-js.mjs — dependency-free code split for the static frontend.
//
// The frontend currently ships one monolithic bundle (main.min.js) containing
// every role's dashboard. On 2G/3G that makes a student download teacher + admin
// code they never use. This concatenates a shared "core" (all cross-role helpers
// live there — see PERFORMANCE_OPTIMIZATION_PLAN.md P1-1) plus only the active
// role's dashboard into per-role bundles. No minifier required; nginx gzip/brotli
// handles transfer size. Run from the frontend/ directory: `node build-js.mjs`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "assets", "js");

// Shared core — every function used by more than one role (request, escapeHtml,
// decodeToken, render, showToast, renderTutorMarkdown, renderQuizQuestions,
// renderApp, renderLogin, viewLessonContent, applyAppearance, …) lives here.
const core = [
  "env.js",
  "config.js",
  "modules/api.js",
  "modules/auth.js",
  "modules/dashboards.js",
  "modules/appearance.js",
  "modules/lesson.js",
  "i18n.js",
  "site-features.js",
  "auth-ui.js",
  "auth-client.js",
  "auth-guard.js",
  "a11y.js",
];

const roles = {
  student: ["modules/student-dashboard.js", "main.js"],
  teacher: ["modules/teacher-dashboard.js", "main.js"],
  admin: [
    "modules/admin-dashboard/00-shell.js",
    "modules/admin-dashboard/01-overview.js",
    "modules/admin-dashboard/02-lessons-quizzes-games.js",
    "modules/admin-dashboard/03-users.js",
    "modules/admin-dashboard/04-payments-notif-uploads.js",
    "modules/admin-dashboard/05-branding-analytics-settings.js",
    "main.js",
  ],
};

for (const [role, files] of Object.entries(roles)) {
  const parts = [...core, ...files].map((f) => readFileSync(join(jsDir, f), "utf8"));
  writeFileSync(join(jsDir, `${role}.bundle.js`), parts.join("\n;\n"));
  console.log(`wrote assets/js/${role}.bundle.js (${parts.length} source files)`);
}
