// build-js.mjs — dependency-free code split for the static frontend.
//
// Role bundles used to ship a shared "core" that also contained landing i18n,
// speech, and every student route. See docs/infra/performance-optimization-plan.md
// Week 2 (P-12): student first paint is shell + dashboard + lessons; games/exams/
// library/payments/speech load as separate chunks.
//
// Source modules use ESM syntax but load as classic <script> tags. We concatenate
// and strip `import`/`export` so symbols stay globals.

import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

function stripEsm(src) {
  return src
    .replace(/^\s*import\s+.*\bfrom\s+["'][^"']*["']\s*;?\s*$/gm, "")
    .replace(/^\s*import\s+["'][^"']*["']\s*;?\s*$/gm, "")
    .replace(/export\s+default\s+/g, "")
    .replace(/export\s+/g, "");
}

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "assets", "js");
const cssDir = join(here, "assets", "css");

// Shared by every portal. No landing i18n, speech, or test-generator.
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
  "modules/api-client/core/fetch.js",
  "modules/ai-source-badge.js",
  "modules/api-quiz.js",
  "modules/api.js",
  "modules/auth.js",
  "modules/appearance.js",
  "modules/lesson/lesson-content.js",
  "modules/lesson/lesson-idb.js",
  "modules/lesson/lesson-viewer/cache.js",
  "modules/lesson/lesson-viewer/bridge.js",
  "modules/exams.js",
  "modules/lazy-script.js",
  "auth-client.js",
  "auth-guard.js",
  "a11y.js",
];

// Teacher/admin lesson viewer (student uses modules/student/lessons/*).
const lessonViewer = [
  "modules/student/game-runtime.js",
  "modules/lesson/lesson-viewer/iframe.js",
  "modules/lesson/lesson-viewer/sections.js",
  "modules/lesson/lesson-viewer/interactions.js",
  "modules/lesson/lesson-viewer/viewer.js",
  "modules/lesson.js",
  "modules/api-client/core/test-generator.js",
];

const speechFiles = [
  "modules/speech-storage.js",
  "modules/speech.js",
];

const studentExtras = [
  "modules/api-client/core/test-generator.js",
  "modules/student/games.js",
  "modules/student/exams.js",
  "modules/student/tests.js",
  "modules/student/files.js",
  "modules/student/library.js",
  "modules/student/payments.js",
  "modules/student/downloads.js",
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
    "modules/student/game-runtime.js",
    "modules/student/lessons/interactions.js",
    "modules/student/lessons/viewer.js",
    "modules/student/progress.js",
    "modules/student/bookmarks.js",
    "modules/student/assignments.js",
    "modules/student/notifications.js",
    "modules/student/settings.js",
    "modules/student/class-view.js",
    "modules/student/profile.js",
    "modules/student/lazy-views.js",
    "modules/student/index.js",
    "modules/student-dashboard.js",
    "modules/dashboards.js",
    "main.js",
  ],
  teacher: [
    ...lessonViewer,
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
    ...lessonViewer,
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

const extraJsBundles = [
  "student.extras.bundle.js",
  "speech.bundle.js",
];

function concatJs(files) {
  return files.map((f) => stripEsm(readFileSync(join(jsDir, f), "utf8"))).join("\n;\n");
}

function writeJs(outName, source) {
  const outPath = join(jsDir, outName);
  writeFileSync(outPath, source);
  writeFileSync(`${outPath}.gz`, gzipSync(source, { level: 9 }));
  console.log(`wrote ${outName} + ${outName}.gz`);
}

function gzipFile(absPath) {
  if (!existsSync(absPath)) return;
  writeFileSync(`${absPath}.gz`, gzipSync(readFileSync(absPath), { level: 9 }));
  console.log(`wrote ${absPath.replace(here + "\\", "").replace(here + "/", "")}.gz`);
}

function writeCssBundle(outName, files) {
  const parts = files.map((f) => {
    const raw = readFileSync(join(cssDir, f), "utf8");
    return raw.replace(/@import\s+(?:url\()?['"]?main\.css['"]?\)?;?/gi, "");
  });
  const out = parts.join("\n");
  const outPath = join(cssDir, outName);
  writeFileSync(outPath, out);
  writeFileSync(`${outPath}.gz`, gzipSync(out, { level: 9 }));
  console.log(`wrote ${outName} + ${outName}.gz`);
}

function writeCssBundles() {
  const mainMin = join(cssDir, "main.min.css");
  const tw = join(cssDir, "tailwind.min.css");
  if (!existsSync(mainMin) || !existsSync(tw)) {
    console.log("skip CSS bundles (minify:css / build:css first)");
    return;
  }
  writeCssBundle("student.bundle.css", ["main.min.css", "student.css", "tailwind.min.css"]);
  writeCssBundle("teacher.bundle.css", ["main.min.css", "teacher.css", "tailwind.min.css"]);
  writeCssBundle("admin.bundle.css", ["main.min.css", "admin.css", "tailwind.min.css"]);
  ["main.min.css", "tailwind.min.css", "landing-extra.css", "landing.css", "student.css", "teacher.css", "admin.css"]
    .forEach((f) => gzipFile(join(cssDir, f)));
}

function gzipBundles() {
  for (const role of Object.keys(roles)) {
    gzipFile(join(jsDir, `${role}.bundle.js`));
  }
  gzipFile(join(jsDir, "i18n.swahili.bundle.js"));
  extraJsBundles.forEach((name) => gzipFile(join(jsDir, name)));
  gzipFile(join(jsDir, "vendor-blackboard.min.js"));
  gzipFile(join(jsDir, "blackboard-embed.js"));
  copyRuntimeVendor();
  walkGzip(join(here, "static", "lib"), [".js", ".css"]);
  writeCssBundles();
}

function walkGzip(dir, exts) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkGzip(p, exts);
    else if (exts.some((e) => name.name.endsWith(e)) && !name.name.endsWith(".gz")) gzipFile(p);
  }
}

function copyRuntimeVendor() {
  const src = join(here, "..", "..", "..", "packages", "runtime", "dist", "casuya-runtime.min.js");
  const destDir = join(here, "static", "pkg", "runtime");
  if (!existsSync(src)) {
    console.log("skip runtime vendor (packages/runtime/dist missing)");
    return;
  }
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, "casuya-runtime.min.js");
  copyFileSync(src, dest);
  gzipFile(dest);
  console.log("copied casuya-runtime.min.js");
}

const STAMP_ASSETS = [
  "assets/js/student.bundle.js",
  "assets/js/teacher.bundle.js",
  "assets/js/admin.bundle.js",
  "assets/js/student.extras.bundle.js",
  "assets/js/speech.bundle.js",
  "assets/js/i18n.swahili.bundle.js",
  "assets/js/blackboard-embed.js",
  "assets/js/vendor-blackboard.min.js",
  "assets/js/brand.js",
  "assets/js/rum.js",
  "assets/js/tracker.js",
  "assets/js/env.js",
  "assets/js/config.js",
  "assets/js/landing-extra.js",
  "assets/css/student.bundle.css",
  "assets/css/teacher.bundle.css",
  "assets/css/admin.bundle.css",
  "assets/css/landing.css",
  "assets/css/landing-extra.css",
  "static/pkg/runtime/casuya-runtime.min.js",
];

function fileHash(absPath) {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex").slice(0, 10);
}

function listHtmlFiles(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name === "node_modules" || name.name.startsWith(".")) continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) listHtmlFiles(p, acc);
    else if (name.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function stampAssetRevs() {
  const map = {};
  for (const rel of STAMP_ASSETS) {
    const abs = join(here, rel);
    if (!existsSync(abs)) continue;
    map["/" + rel.replace(/\\/g, "/")] = fileHash(abs);
  }
  const json = JSON.stringify(map);
  const markerStart = "<!--casuya-assets-->";
  const markerEnd = "<!--/casuya-assets-->";
  const inject = `${markerStart}<script>window.CASUYA_ASSETS=${json};</script>${markerEnd}`;
  const files = listHtmlFiles(here);
  for (const abs of files) {
    let html = readFileSync(abs, "utf8");
    html = html.replace(/<!--casuya-assets-->[\s\S]*?<!--\/casuya-assets-->/, "");
    html = html.replace(/(["'])(\/assets\/[^"'?]+)(?:\?v=[^"']*)?\1/g, (_, q, path) => {
      const v = map[path];
      return v ? `${q}${path}?v=${v}${q}` : `${q}${path}${q}`;
    });
    if (html.includes("</head>")) {
      html = html.replace("</head>", `  ${inject}\n</head>`);
    }
    writeFileSync(abs, html);
  }
  console.log(`stamped ?v= hashes on ${files.length} HTML files`);
}

if (process.argv.includes("--gzip-only")) {
  gzipBundles();
  stampAssetRevs();
} else {
  for (const [role, files] of Object.entries(roles)) {
    writeFileSync(join(jsDir, `${role}.bundle.js`), concatJs([...core, ...files]));
  }
  writeJs("i18n.swahili.bundle.js", concatJs(i18nBundleFiles));
  writeJs("speech.bundle.js", concatJs(speechFiles));
  writeJs("student.extras.bundle.js", concatJs(studentExtras));
  gzipBundles();
  stampAssetRevs();
  console.log(`wrote ${Object.keys(roles).length} role bundles, extras, speech, and CSS gz`);
}
