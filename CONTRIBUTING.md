# Contributing to Casuya Hybrid

This repository follows a **single-trunk, layered monorepo** convention.

## Repository layers

Dependencies may only point **downward**:

```
apps/      (rank 2)  deployable services — may use packages/ and libs/
packages/  (rank 1)  reusable TS libraries — may use libs/ only
libs/      (rank 0)  reusable Python/low-level code — may depend on nothing above
```

- `apps/platform` is the only deployable application (FastAPI + static frontend).
- `packages/*` are framework/libraries (runtime, bridge, editor, blackboard,
  ai, and the flattened design system: `ds-tokens`, `ds-react`, `ds-a11y`,
  `ds-hooks`, `ds-icons`, `ds-styles`, `ds-utils`, `ds-theme`).
- `libs/core` is the Python lesson engine.
- The design system's dev `playground` and `docs` apps live under `apps/ds-playground`
  and `apps/ds-docs`.
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
   Or use the combined validation command:
   ```bash
   pnpm validate
   ```
4. Open a PR. At least one CODEOWNERS reviewer must approve.
5. CI (`.github/workflows/ci.yml`) must be green before merge.

## CI pipeline

The CI workflow (`.github/workflows/ci.yml`) runs on every push and PR:

1. **Setup** — Python 3.12 + pytest + platform requirements, Node 20 + pnpm 9.15.9
2. **Install** — `pnpm install --frozen-lockfile`
3. **Layer check** — `pnpm check:layers`
4. **Build** — `pnpm build` (Turborepo, cached)
5. **Typecheck** — `pnpm typecheck`
6. **Lint** — `pnpm lint`
7. **Test** — `pnpm test` (vitest, pytest, jest, node:test)

A separate `backend` job validates that the Python app boots correctly.

## Conventions

- **TypeScript:** extend the shared `tsconfig.base.json`; no per-package compiler
  rewrites of shared rules. The `exports` field in `package.json` must list
  `types` first for TypeScript bundler resolution.
- **Formatting:** Prettier (`.prettierrc.json`). **Linting:** ESLint base
  (`.eslintrc.base.json`).
- **Python:** PEP8, type hints, Pydantic models for I/O.
- **Commits:** clear, imperative ("add lesson cache", not "added cache").
- **Storybook stories:** excluded from typecheck via `tsconfig.json` `exclude`
  field (Storybook is not installed as a dependency).
- Document cross-cutting decisions in `docs/adr/` (ADRs).

## Local setup

```bash
pnpm install
pip install -r requirements.txt
cp .env.example .env
pnpm dev:backend      # apps/platform on :8765 (serves API + frontend)
```

## Testing locally

```bash
# Run all tests across all packages
pnpm test

# Run tests for a specific package
cd packages/blackboard && pnpm test
cd packages/editor && pnpm test
cd packages/ai && pnpm test
cd apps/platform && pytest tests/ -v
```
