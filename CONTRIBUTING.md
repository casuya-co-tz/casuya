# Contributing to Casuya Hybrid

This repository follows a **single-trunk, layered monorepo** convention:

## Repository layers

Dependencies may only point **downward**:

```
apps/      (rank 2)  deployable services — may use packages/ and libs/
packages/  (rank 1)  reusable TS libraries — may use libs/ only
libs/      (rank 0)  reusable Python/low-level code — may depend on nothing above
```

- `apps/platform` is the only deployable application (FastAPI + static frontend).
- `packages/*` are framework/libraries (runtime, bridge, editor, blackboard,
  design-system, ai).
- `libs/core` is the Python lesson engine.
- `infra/` holds deployment (Docker, nginx, render). `tools/` holds repo scripts.

Run `pnpm check:layers` to verify no upward (illegal) imports exist. CI enforces it.

## Workflow

1. Branch from `main` (short-lived feature branches).
2. Make your change within the correct layer.
3. Ensure it builds, typechecks, lints, and tests:
   ```bash
   pnpm build && pnpm typecheck && pnpm lint && pnpm test
   pnpm check:layers
   ```
4. Open a PR. At least one CODEOWNERS reviewer must approve.
5. CI (`.github/workflows/ci.yml`) must be green before merge.

## Conventions

- TypeScript: extend the shared `tsconfig.base.json`; no per-package compiler
  rewrites of shared rules.
- Formatting: Prettier (`.prettierrc.json`). Linting: ESLint base
  (`.eslintrc.base.json`).
- Python: PEP8, type hints, Pydantic models for I/O.
- Commits: clear, imperative ("add lesson cache", not "added cache").
- Document cross-cutting decisions in `docs/adr/` (ADRs).

## Local setup

```bash
pnpm install
pip install -r requirements.txt
cp .env.example .env
pnpm dev:backend      # apps/platform on :8000
pnpm dev:frontend     # static UI on :5173
```
