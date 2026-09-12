// build-js.mjs — dependency-free code split for the static frontend.
//
// The frontend currently ships one monolithic bundle (main.min.js) containing
// every role's dashboard. On 2G/3G that makes a student download teacher + admin
// code they never use. This concatenates a shared "core" (all cross-role helpers
// live there — see PERFORMANCE_OPTIMIZATION_PLAN.md P1-1) plus only the active
// role's dashboard into per-role bundles. No minifier required; nginx gzip/brotli
// handles transfer size. Run from the frontend/ directory: `node build-js.mjs`.
//
// The source modules are written as ES modules (they use `export`/`import`), but
// the app loads them as classic <script> tags in a shared global scope. So we
// concatenate AND strip the ESM keywords: `import` lines are dropped (the
// referenced symbols are already globals from sibling files in the same bundle)
// and `export` is dropped (turning the declaration into a global). This is exactly
// the global-script behavior the runtime expects; brand.js/blackboard-embed.js
// are loaded separately and are self-contained, so they are unaffected.

import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Turn an ES module source into classic-script-compatible source.
function stripEsm(src) {
  return src
    // Drop static `import ... from "..."` statements (symbols are already global).
    .replace(/^\s*import\s+.*\bfrom\s+["'][^"']*["']\s*;?\s*$/gm, "")
    // Drop side-effect `import "..."` statements.
    .replace(/^\s*import\s+["'][^"']*["']\s*;?\s*$/gm, "")
    // Drop `export default` / `export` keywords (leaving global declarations).
    .replace(/export\s+default\s+/g, "")
    .replace(/export\s+/g, "");
}

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "assets", "js");

// Shared core — every function used by more than one role (request, escapeHtml,
// decodeToken, render, showToast, renderTutorMarkdown, renderQuizQuestions,
// renderLogin, viewLessonContent, applyAppearance, …) lives here.
const core = [
  "env.js",
  "config.js",
  "modules/api-cache.js",
  "modules/api-auth.js",
  "modules/api-client/core/host.js",
  "modules/api-client/core/dom.js",
  "modules/api-client/core/errors.js",
  "modules/api-client/core/markdown.js",
  "modules/api-client/core/quiz.js",
  "modules/api-client/core/katex-loader.js",
  "modules/api-client/core/test-generator.js",
  "modules/api-client/core/fetch.js",
  "modules/api-quiz.js",
  "modules/api.js",
  "modules/auth.js",
  "modules/appearance.js",
  "modules/lesson/lesson-content.js",
  "modules/lesson/lesson-viewer/cache.js",
  "modules/lesson/lesson-viewer/bridge.js",
  "modules/lesson/lesson-viewer/iframe.js",
  "modules/lesson/lesson-viewer/sections.js",
  "modules/lesson/lesson-viewer/interactions.js",
  "modules/lesson/lesson-viewer/viewer.js",
  "modules/lesson.js",
  "modules/exams.js",
  "i18n/swahili/navigation.js",
  "i18n/swahili/accessibility.js",
  "i18n/swahili/hero.js",
  "i18n/swahili/landing.js",
  "i18n/swahili/demo.js",
  "i18n/swahili/auth.js",
  "i18n/swahili.js",
  "i18n.js",
  "site-features.js",
  "auth-ui.js",
  "auth-client.js",
  "auth-guard.js",
  "a11y.js",
];

const roles = {
  student: [
    "modules/student/dashboard/state.js",
    "modules/student/dashboard/sidebar.js",
    "modules/student/dashboard/bootstrap.js",
    "modules/student/sidebar.js",
    "modules/student/utils.js",
    "modules/student/overview.js",
    "modules/student/subjects.js",
    "modules/student/lessons/cache.js",
    "modules/student/lessons/builders.js",
    "modules/student/lessons/iframe.js",
    "modules/student/lessons/interactions.js",
    "modules/student/lessons/viewer.js",
    "modules/student/progress.js",
    "modules/student/bookmarks.js",
    "modules/student/assignments.js",
    "modules/student/games.js",
    "modules/student/exams.js",
    "modules/student/tests.js",
    "modules/student/files.js",
    "modules/student/library.js",
    "modules/student/payments.js",
    "modules/student/downloads.js",
    "modules/student/notifications.js",
    "modules/student/settings.js",
    "modules/student/class-view.js",
    "modules/student/profile.js",
    "modules/student/index.js",
    "modules/student-dashboard.js",
    "modules/dashboards.js",
    "main.js",
  ],
  teacher: [
    "modules/teacher/dashboard.js",
    "modules/teacher/utils.js",
    "modules/teacher/overview.js",
    "modules/teacher/class.js",
    "modules/teacher/students.js",
    "modules/teacher/lessons.js",
    "modules/teacher/assignments-crud.js",
    "modules/teacher/assignments-create-form.js",
    "modules/teacher/assignments-grading.js",
    "modules/teacher/reports.js",
    "modules/teacher/plans-syllabus.js",
    "modules/teacher/plans-builder.js",
    "modules/teacher/plans/state.js",
    "modules/teacher/plans/layout.js",
    "modules/teacher/plans/saved.js",
    "modules/teacher/plans/tabs.js",
    "modules/teacher/plans/lesson.js",
    "modules/teacher/plans/scheme.js",
    "modules/teacher/plans/actions.js",
    "modules/teacher/plans/index.js",
    "modules/teacher/library.js",
    "modules/teacher/ai-assistant.js",
    "modules/teacher/test-generator.js",
    "modules/teacher/files.js",
    "modules/teacher/payments.js",
    "modules/teacher/notifications.js",
    "modules/teacher/settings.js",
    "modules/teacher/sidebar.js",
    "modules/teacher/index.js",
    "modules/dashboards.js",
    "main.js",
  ],
  admin: [
    "modules/admin-dashboard/00-shell.js",
    "modules/admin-dashboard/01-overview/greeting.js",
    "modules/admin-dashboard/01-overview/kpi.js",
    "modules/admin-dashboard/01-overview/charts.js",
    "modules/admin-dashboard/02-lessons-quizzes-games.js",
    "modules/admin-dashboard/admin-progress.js",
    "modules/admin-dashboard/admin-lessons.js",
    "modules/admin-dashboard/admin-quizzes.js",
    "modules/admin-dashboard/admin-test-generator.js",
    "modules/admin-dashboard/03-users.js",
    "modules/admin-dashboard/admin-games.js",
    "modules/admin-dashboard/admin-users-list.js",
    "modules/admin-dashboard/admin-users-detail.js",
    "modules/admin-dashboard/04-payments-notif-uploads.js",
    "modules/admin-dashboard/admin-payments.js",
    "modules/admin-dashboard/admin-notifications.js",
    "modules/admin-dashboard/admin-uploads.js",
    "modules/admin-dashboard/admin-library.js",
    "modules/admin-dashboard/05-branding-analytics-settings.js",
    "modules/admin-dashboard/admin-branding.js",
    "modules/admin-dashboard/admin-analytics.js",
    "modules/admin-dashboard/admin-settings-platform.js",
    "modules/admin-dashboard/admin-settings.js",
    "modules/dashboards.js",
    "main.js",
  ],
};

// Landing i18n bundle (P1-5) — merges the eight Swahili/English translation
// scripts into one request for the landing/auth pages. Order must match the
// classic-script order previously inlined in index.html: dictionary parts
// (i18n/swahili/*) first, then swahili.js (exposes SW), then i18n.js (engine).
const i18nBundleFiles = [
  "i18n/swahili/navigation.js",
  "i18n/swahili/accessibility.js",
  "i18n/swahili/hero.js",
  "i18n/swahili/landing.js",
  "i18n/swahili/demo.js",
  "i18n/swahili/auth.js",
  "i18n/swahili.js",
  "i18n.js",
];

function buildBundle(outName, files) {
  const parts = files.map((f) => stripEsm(readFileSync(join(jsDir, f), "utf8")));
  const out = parts.join("\n;\n");
  const outPath = join(jsDir, outName);
  writeFileSync(outPath, out);
  writeFileSync(`${outPath}.gz`, gzipSync(out, { level: 9 }));
  console.log(`wrote ${outName} + ${outName}.gz`);
}

function gzipBundles() {
  for (const role of Object.keys(roles)) {
    const outPath = join(jsDir, `${role}.bundle.js`);
    const out = readFileSync(outPath);
    writeFileSync(`${outPath}.gz`, gzipSync(out, { level: 9 }));
    console.log(`wrote assets/js/${role}.bundle.js.gz`);
  }
  const i18nPath = join(jsDir, "i18n.swahili.bundle.js");
  const i18nOut = readFileSync(i18nPath);
  writeFileSync(`${i18nPath}.gz`, gzipSync(i18nOut, { level: 9 }));
  console.log("wrote assets/js/i18n.swahili.bundle.js.gz");
}

if (process.argv.includes("--gzip-only")) {
  gzipBundles();
} else {
  for (const [role, files] of Object.entries(roles)) {
    const parts = [...core, ...files].map((f) => stripEsm(readFileSync(join(jsDir, f), "utf8")));
    const out = parts.join("\n;\n");
    const outPath = join(jsDir, `${role}.bundle.js`);
    writeFileSync(outPath, out);
  }
  buildBundle("i18n.swahili.bundle.js", i18nBundleFiles);
  gzipBundles();
  console.log(`wrote ${Object.keys(roles).length} role bundles and updated .gz files`);
}

