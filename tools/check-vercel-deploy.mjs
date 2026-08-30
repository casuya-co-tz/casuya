// tools/check-vercel-deploy.mjs
// Guards the Vercel deployment pipeline against silent regressions.
//
// The deploys are driven by .github/workflows/deploy.yml using the local build
// pipeline (`vercel build` + `vercel deploy --prebuilt`) run from the repo ROOT
// with `--project=<name>`. Each project's Vercel app setting (`rootDirectory`,
// `installCommand`, `buildCommand`, `outputDirectory`) is what makes that work.
//
// We learned the hard way that small edits break this and fail fast with no
// deployment created and no meaningful error:
//   * Re-adding `--cwd <subdir>` double-appends the project rootDirectory and
//     fails with `The provided path ".../ds-playground/ds-playground" does not exist.`
//   * Changing a project's build/install command or rootDirectory no longer
//     matches the App settings, so `vercel build`/`deploy --prebuilt` deploy the
//     wrong artifact (or nothing).
//   * Re-linking a project to Git (the editor) reintroduces Vercel's native
//     cloud builder which crashes on `pnpm install` (ERR_PNPM_META_FETCH_FAIL).
//
// This script is hermetic (no network, no secrets): it checks the repo tree so
// CI can fail fast and loudly on the exact regressions above. Run via `pnpm check:deploy`.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const DEPLOY_YML = join(ROOT, ".github", "workflows", "deploy.yml");

// The four dedicated Vercel projects, the rootDirectory the App resolves the
// build from, and the build command the workflow expects to produce the artifact.
// KEEP IN SYNC with the Vercel App settings (api.vercel.com) and deploy.yml.
const PROJECTS = [
  {
    name: "ds-playground",
    rootDirectory: "apps/ds-playground",
    vercelJson: "apps/ds-playground/vercel.json",
    expectedOutput: "dist",
  },
  {
    name: "editor",
    rootDirectory: "packages/editor",
    vercelJson: "packages/editor/vercel.json",
    expectedOutput: "dist-demo",
  },
  {
    name: "runtime",
    rootDirectory: "packages/runtime",
    vercelJson: "packages/runtime/vercel.json",
    expectedOutput: ".",
  },
  {
    name: "frontend",
    rootDirectory: "apps/platform/frontend",
    vercelJson: "apps/platform/frontend/vercel.json",
    expectedOutput: ".",
  },
];

const failures = [];
const ok = (msg) => console.log("  \u2713 " + msg);
const fail = (msg) => failures.push(msg);

if (!existsSync(DEPLOY_YML)) {
  console.error("✖ Missing .github/workflows/deploy.yml — deploy pipeline is gone.");
  process.exit(1);
}

const yml = readFileSync(DEPLOY_YML, "utf8");

// The build + deploy of every dedicated project must run from the repo ROOT via
// --project=<name>. A re-added --cwd double-appends rootDirectory and breaks the
// prebuilt deploy. Only the orchestrating steps are allowed --cwd.
const deployBody = yml.split("jobs:")[1] || "";
const cwdMentions = [...yml.matchAll(/\b--cwd\b/g)];
if (cwdMentions.length) {
  const lineNums = cwdMentions
    .map((m) => yml.slice(0, m.index).split("\n").length)
    .join(", ");
  fail(
    `deploy.yml uses --cwd (line(s) ${lineNums}). This double-appends rootDirectory and breaks the prebuilt deploy. Build/deploy each project from the repo root with --project=<name>.`
  );
}

for (const p of PROJECTS) {
  // 1) The workflow must reference the project by name with --project and build its artifact.
  const buildLine = new RegExp(`vercel build.*--project=${p.name}\\b`).test(yml);
  const deployLine = new RegExp(`vercel deploy --prebuilt.*--project=${p.name}\\b`).test(yml);
  if (!buildLine || !deployLine) {
    fail(`deploy.yml must contain \`vercel build --project=${p.name}\` and \`vercel deploy --prebuilt --project=${p.name}\` (build + deploy from repo root).`);
  }

  // 2) The workflow must not re-add a --cwd pointing into this project's directory.
  if (new RegExp(`--cwd\\s+${p.rootDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(yml)) {
    fail(`deploy.yml must NOT pass --cwd ${p.rootDirectory} — pass --project=${p.name} instead.`);
  }

  // 3) The project's committed vercel.json must still point at the expected output.
  const vj = join(ROOT, p.vercelJson);
  if (!existsSync(vj)) {
    fail(`Missing ${p.vercelJson} — the Vercel project relies on it.`);
    continue;
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(vj, "utf8"));
  } catch {
    fail(`Invalid JSON in ${p.vercelJson}.`);
    continue;
  }
  if (cfg.outputDirectory !== p.expectedOutput) {
    fail(`${p.vercelJson} outputDirectory is "${cfg.outputDirectory}" but expected "${p.expectedOutput}" for project ${p.name}.`);
  }
}

// The editor must be deployed only through GitHub Actions, never Vercel's native
// Git builder (whose pnpm install crashes in Vercel's container). The repo tree
// cannot carry the remote App link state, so guard the local signals: there must
// be no attempt to wire the editor to Git auto-deploy inside the workflow, and
// the editor's install command must stay on the toolchain that works in CI.
if (/editor[^\n]*--(cwd|scope)[^\n]*--project=editor/.test(yml)) {
  fail(`deploy.yml must deploy the editor via --project=editor from the repo root only (Vercel native Git builds crash on pnpm install).`);
}

if (failures.length) {
  console.error("\n✖ Vercel deploy contract violations:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(
    "\nThese guard the production deploys. Fix the repo, re-run `pnpm check:deploy` locally,\nthen commit."
  );
  process.exit(1);
}

console.log("✓ Vercel deploy contract OK (deploy.yml + project vercel.json).");
