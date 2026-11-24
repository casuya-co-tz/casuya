// tools/check-frontend-budget.mjs
//
// Hermetic static-host budget + minified-asset lint. This is the lightweight
// stand-in for a full Lighthouse CI job: it guards the bytes that actually
// reach a 2G/3G device and verifies that generated bundles are syntactically
// valid, without network access or a browser.
//
// Run via `pnpm check:budget` (wired into `pnpm validate`).

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JS = join(ROOT, "apps", "platform", "frontend", "assets", "js");
const CSS = join(ROOT, "apps", "platform", "frontend", "assets", "css");

// Gzip bytes budget for the first-load role bundle. Student is the 2G path and
// must stay under the documented 40 KB target; teacher/admin get more room.
const BUDGETS = {
  "student.bundle.js": 40 * 1024,
  "teacher.bundle.js": 55 * 1024,
  "admin.bundle.js": 55 * 1024,
  "student.bundle.css": 20 * 1024,
  "teacher.bundle.css": 20 * 1024,
  "admin.bundle.css": 20 * 1024,
};

const failures = [];
const fail = (msg) => failures.push(msg);

function jsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) jsFiles(p, acc);
    else if (/\.(?:js|mjs)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

for (const [name, budget] of Object.entries(BUDGETS)) {
  const path = join(name.endsWith(".css") ? CSS : JS, name);
  if (!existsSync(path)) {
    fail(`Missing built asset ${name} — run 'npm run build' in apps/platform/frontend.`);
    continue;
  }
  const bytes = gzipSync(readFileSync(path), { level: 9 }).length;
  if (bytes > budget) {
    fail(`${name} is ${bytes} B gzip (budget ${budget} B). Reduce the bundle before deploying.`);
  }
}

// Syntax-check every generated bundle. A broken minifier output would otherwise
// only be discovered by a browser on a device we cannot test in CI.
let checked = 0;
for (const path of jsFiles(JS)) {
  const name = path.slice(JS.length + 1);
  if (!/(\.min\.js|\.bundle\.js)$/.test(name)) continue;
  try {
    execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
    checked++;
  } catch (err) {
    fail(`Minified asset ${name} fails 'node --check': ${String(err.stderr || err.message).split("\n")[0]}`);
  }
}

if (failures.length) {
  console.error("\n✖ Frontend budget / asset lint violations:\n");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ Frontend budget OK (${Object.keys(BUDGETS).length} assets, ${checked} bundles linted).`);
