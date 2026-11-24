#!/usr/bin/env bash
# Preflight for the real deployment pipeline.
#
# Deployments are performed by .github/workflows/deploy.yml (Vercel CLI per
# project) — never by an ad-hoc script on a laptop. This script runs the same
# hermetic checks CI runs and prints the exact next step, so it cannot silently
# pretend a deploy happened.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "==> Checking Vercel deploy contract"
node tools/check-vercel-deploy.mjs

echo "==> Building platform frontend"
(cd apps/platform/frontend && npm run build)

echo "==> Checking frontend byte budget"
node tools/check-frontend-budget.mjs

echo
echo "Preflight passed. Push the commit to main to deploy via"
echo ".github/workflows/deploy.yml; then run scripts/smoke-production.ps1."
