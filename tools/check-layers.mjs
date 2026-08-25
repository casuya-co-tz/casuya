// tools/check-layers.mjs
// Enforces Google/Meta-style downward-only dependencies:
//   libs/   (rank 0) -> may depend on nothing above
//   packages/(rank 1) -> may depend on libs/ only
//   apps/   (rank 2) -> may depend on packages/ and libs/
// A violation is any import whose target lives in a HIGHER layer than the source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(".");
const LAYER = (p) => {
  if (p.startsWith(join(ROOT, "apps"))) return 2;
  if (p.startsWith(join(ROOT, "packages"))) return 1;
  if (p.startsWith(join(ROOT, "libs"))) return 0;
  return -1; // outside layered tree (infra/tools/root) -> unrestricted
};

const IMPORT_RE =
  /(?:import\s+(?:[^'"]+\s+from\s+)?|require\(\s*|from\s+)(['"])([^'"]+)\1/g;
const PY_IMPORT_RE = /^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (["node_modules", "dist", "build", ".next", ".turbo", ".git"].includes(e)) continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|py)$/.test(e)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const violations = [];
for (const file of files) {
  const rank = LAYER(file);
  if (rank < 0) continue;
  const txt = readFileSync(file, "utf8");
  const targets = [];
  let m;
  while ((m = IMPORT_RE.exec(txt))) targets.push(m[2]);
  while ((m = PY_IMPORT_RE.exec(txt))) targets.push(m[1] || m[2]);
  for (let t of targets) {
    if (!t.startsWith(".") && !t.startsWith("/")) continue; // skip bare/alias for this simple check
    const abs = resolve(dirname(file), t);
    const tr = LAYER(abs);
    if (tr > rank) {
      violations.push(`${file.replace(ROOT + "\\", "")}  ->  ${t}  (imports higher layer)`);
    }
  }
}

if (violations.length) {
  console.error("✖ Layer boundary violations (dependencies must point downward):\n");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("✓ Layer boundaries OK (libs < packages < apps, downward-only).");
