// tools/bundle-main.mjs
// Concatenate the split classic scripts (modules/*.js) + main.js glue, in load
// order, into a single main.bundle.js that is functionally identical to the
// original monolithic main.js. The frontend build then minifies this to
// main.min.js (which the HTML actually loads).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = join(__dirname, "..", "apps", "platform", "frontend", "assets", "js");
const ORDER = [
  "api",
  "appearance",
  "lesson",
  "auth",
  "dashboards",
  "student-dashboard",
  "admin-dashboard",
  "teacher-dashboard",
];

const parts = [];
for (const name of ORDER) {
  const dir = join(BASE, "modules", name);
  // A module may be a single file (name.js) or a folder of fragments
  // (name/*.js) that must be concatenated contiguously and in sorted order
  // to reassemble one logical script across multiple source files.
  if (statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .sort();
    for (const f of files) {
      parts.push(`// ===== modules/${name}/${f} =====`);
      parts.push(readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n"));
    }
  } else {
    const p = join(BASE, "modules", `${name}.js`);
    parts.push(`// ===== modules/${name}.js =====`);
    parts.push(readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
  }
}
parts.push("// ===== main.js (glue) =====");
parts.push(readFileSync(join(BASE, "main.js"), "utf8").replace(/\r\n/g, "\n"));

const bundle = parts.join("\n") + "\n";
const out = join(BASE, "main.bundle.js");
writeFileSync(out, bundle);
console.log("Wrote", out, `(${bundle.split("\n").length} lines)`);
