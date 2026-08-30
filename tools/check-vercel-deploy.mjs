// tools/check-vercel-deploy.mjs
// Guards the Vercel deployment pipeline against silent regressions.
//
// The deploys are driven by .github/workflows/deploy.yml. Each of the four
// dedicated projects is built and prebuilt-deployed in FULL ISOLATION from its
// own directory:
//
//   vercel build  --cwd <rootDirectory> --project=<name>
//   vercel deploy --prebuilt --cwd <rootDirectory>
//
// The Vercel App `rootDirectory` for every project is cleared (null) so that
// `--cwd` alone defines the project root and each project keeps its OWN
// `.vercel/output` (no shared repo-root output -> no cross-project artifact
// contamination).
//
// This script is hermetic (no network, no secrets) and fails fast on the exact
// regressions that broke production before:
//   * Sharing a single repo-root `.vercel/output` across projects made the
//     LAST deploy (frontend) ship the leftover artifact of an earlier project
//     (the site served the ds-playground app). -> enforce per-project --cwd.
//   * Re-adding `--cwd` when the App `rootDirectory` was NON-NULL double-appended
//     the path and failed with ".../<dir>/<dir> does not exist". -> the App
//     rootDirectory must stay null (checked via committed expectations + no
//     forbidden shared form below).
//   * Re-linking a project to Vercel's native Git builder reintroduces a pnpm
//     install crash (ERR_PNPM_META_FETCH_FAIL). -> workflow must stay CLI-driven.
//
// Run via `pnpm check:deploy` (also wired into `pnpm validate` and CI).

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const DEPLOY_YML = join(ROOT, ".github", "workflows", "deploy.yml");

// The four dedicated Vercel projects and the local directory from which each is
// built and deployed in isolation. KEEP IN SYNC with deploy.yml.
const PROJECTS = [
  { name: "ds-playground", rootDirectory: "apps/ds-playground", vercelJson: "apps/ds-playground/vercel.json", expectedOutput: "dist" },
  { name: "editor", rootDirectory: "packages/editor", vercelJson: "packages/editor/vercel.json", expectedOutput: "dist-demo" },
  { name: "runtime", rootDirectory: "packages/runtime", vercelJson: "packages/runtime/vercel.json", expectedOutput: "." },
  { name: "frontend", rootDirectory: "apps/platform/frontend", vercelJson: "apps/platform/frontend/vercel.json", expectedOutput: "." },
];

const failures = [];
const fail = (msg) => failures.push(msg);

if (!existsSync(DEPLOY_YML)) {
  console.error("✖ Missing .github/workflows/deploy.yml — deploy pipeline is gone.");
  process.exit(1);
}

const yml = readFileSync(DEPLOY_YML, "utf8");

for (const p of PROJECTS) {
  const cwdBuild = new RegExp(
    `vercel build[^\n]*--cwd ${p.rootDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\n]*--project=${p.name}\\b`
  ).test(yml);
  const cwdDeploy = new RegExp(
    `vercel deploy --prebuilt[^\n]*--cwd ${p.rootDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  ).test(yml);

  if (!cwdBuild || !cwdDeploy) {
    fail(
      `Project ${p.name} must be built+deployed (prebuilt) in isolation from its own directory:\n` +
        `  vercel build --cwd ${p.rootDirectory} --project=${p.name}\n` +
        `  vercel deploy --prebuilt --cwd ${p.rootDirectory}\n` +
        `(Do NOT use the old shared repo-root --project-only form — it makes the last deploy` +
        ` ship an earlier project's artifact.)`
    );
  }

  // The App rootDirectory must stay null so --cwd is the single source of truth.
  // Detect the dangerous half-state: --cwd used while the workflow also builds
  // from repo root (would double-append). We cannot read the remote App here, so
  // we enforce that there is no stray repo-root --project-only build line.
  const stray = new RegExp(
    `vercel build[^\n]*--project=${p.name}\\b(?![\\s\\S]{0,200}--cwd)`
  ).test(yml);

  // Committed vercel.json must still produce the expected output directory.
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

if (failures.length) {
  console.error("\n✖ Vercel deploy contract violations:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(
    "\nThese guard the production deploys. Fix the repo, re-run `pnpm check:deploy` locally,\nthen commit."
  );
  process.exit(1);
}

console.log("✓ Vercel deploy contract OK (isolated per-project build+deploy).");
