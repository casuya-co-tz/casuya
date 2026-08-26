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
  const parts = [...core, ...files].map((f) => stripEsm(readFileSync(join(jsDir, f), "utf8")));
  const out = parts.join("\n;\n");
  const outPath = join(jsDir, `${role}.bundle.js`);
  writeFileSync(outPath, out);
  // Pre-compressed copy so nginx `gzip_static on;` can serve it without
  // spending CPU compressing on every request (P0-4). Cloudflare still applies
  // Brotli at the edge; this only helps the origin hop / direct visitors.
  writeFileSync(`${outPath}.gz`, gzipSync(Buffer.from(out), { level: 9 }));
  console.log(`wrote assets/js/${role}.bundle.js (${parts.length} source files) + .gz`);
}
