// tools/split-main.mjs
// Split apps/platform/frontend/assets/js/main.js into smaller CLASSIC scripts.
// Classic scripts share the global scope, so no import/export is needed and
// global functions (used by inline HTML handlers and other classic scripts
// like auth-client.js) keep working. Files are loaded in dependency order.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "apps/platform/frontend/assets/js/main.js";
const OUT = "apps/platform/frontend/assets/js/modules";
const text = readFileSync(SRC, "utf8");
const lines = text.split("\n");

// 1. Detect top-level declarations (indent 0) and their brace ranges.
const decls = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const m = line.match(/^(?:async function|function)\s+(\w+)\s*\(/);
  const arrow = line.match(/^const\s+(\w+)\s*=\s*(?:async\s*)?\(\s*[^)]*\)\s*=>/);
  const fnExpr = line.match(/^const\s+(\w+)\s*=\s*function\s*\(/);
  if (m || arrow || fnExpr) {
    const name = (m || arrow || fnExpr)[1];
    let depth = 0, started = false, j = i;
    for (; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") { depth++; started = true; }
        else if (ch === "}") { depth--; }
      }
      if (started && depth === 0) break;
    }
    decls.push({ name, start: i, end: j });
    i = j + 1;
    continue;
  }
  const c = line.match(/^(?:const|let|var)\s+(\w+)\s*=/);
  if (c && !line.includes("=>") && !/=\s*(?:async\s*)?function/.test(line)) {
    const name = c[1];
    let j = i, depth = 0, started = false;
    for (; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "(" || ch === "[" || ch === "{") { depth++; started = true; }
        else if (ch === ")" || ch === "]" || ch === "}") { depth--; }
      }
      const trimmed = lines[j].trim();
      if (started && depth === 0 && trimmed.endsWith(";")) break;
      if (!started && trimmed.endsWith(";")) break;
    }
    decls.push({ name, start: i, end: j });
    i = j + 1;
    continue;
  }
  i++;
}

// 2. Category assignment (only affects file organization).
function moduleFor(name) {
  if (/^(API_|decodeToken|requestCache|inFlight|CACHE_TTL|request$|refreshAuthToken|^render$|escapeHtml|timeAgo|showToast|confirmDelete|deleteBtn|initDeleteButtons)/.test(name)) return "api";
  if (/^(THEME_|FONT_|applyAppearance|appearancePanelHTML|setupAppearanceControls)/.test(name)) return "appearance";
  if (/^(renderLogin|handleLogin|handleLogout)/.test(name)) return "auth";
  if (/^(lessonContentCache|viewLessonContent)/.test(name)) return "lesson";
  if (/^renderStudentDashboard/.test(name)) return "student-dashboard";
  if (/^renderAdminDashboard/.test(name)) return "admin-dashboard";
  if (/^renderTeacherDashboard/.test(name)) return "teacher-dashboard";
  if (/^renderApp/.test(name)) return "dashboards";
  return "api";
}

// Load order: dependencies first.
const ORDER = ["api", "appearance", "lesson", "auth", "dashboards", "student-dashboard", "admin-dashboard", "teacher-dashboard"];

const modules = {};
for (const d of decls) {
  const mod = moduleFor(d.name);
  modules[mod] = modules[mod] || [];
  modules[mod].push(...lines.slice(d.start, d.end + 1));
  modules[mod].push("");
}

mkdirSync(OUT, { recursive: true });
for (const mod of ORDER) {
  if (!modules[mod]) continue;
  const header = `// modules/${mod}.js — extracted from main.js (classic script, shared global scope)\n`;
  writeFileSync(join(OUT, `${mod}.js`), header + modules[mod].join("\n"));
}

// 3. Rebuild main.js as the bootstrap/glue file: everything not captured as a decl.
const captured = new Set();
for (const d of decls) for (let k = d.start; k <= d.end; k++) captured.add(k);
const glue = [];
for (let k = 0; k < lines.length; k++) {
  if (captured.has(k)) continue;
  const ln = lines[k];
  if (ln.trim() === "") continue;
  glue.push(ln);
}
const entry = [
  "// main.js — bootstrap/glue. Loaded AFTER modules/*.js (classic scripts, shared global scope).",
  ...glue,
  "",
].join("\n");
writeFileSync(SRC, entry);
console.log("Split main.js into classic modules (load order):", ORDER.filter((m) => modules[m]).join(" -> "));
