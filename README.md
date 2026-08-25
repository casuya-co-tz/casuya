# Casuya Hybrid — layered monorepo

A **single-trunk, layered monorepo** for the Casuya interactive-learning
platform: one repository, one main branch, and **downward-only**
dependencies between clearly separated layers.

## Layers (dependencies point downward only)

```
casuya-hybrid/
├── apps/            rank 2 — deployable application
│   └── platform/    FastAPI backend + static/Vite frontend (the only runtime image)
├── packages/        rank 1 — reusable TypeScript libraries
│   ├── ai/          AI tutoring engine
│   ├── blackboard/  interactive math/handwriting blackboard
│   ├── bridge/      offline-first sync + cache engine
│   ├── design-system/   React UI kit (nested workspace with sub-packages)
│   │   ├── packages/    tokens, react, icons, theme, a11y, utils, hooks, styles
│   │   └── apps/        playground, docs
│   ├── editor/      visual lesson builder
│   └── runtime/     lesson player
├── libs/            rank 0 — reusable low-level code
│   └── core/        Python lesson compiler / packager / signer engine
├── infra/           deployment: docker-compose, Dockerfile, nginx, render.yaml
├── tools/           repo scripts (e.g. layer-boundary enforcement)
├── pnpm-workspace.yaml   workspace definition (includes nested design-system)
├── turbo.json            task runner (build/typecheck/lint/test w/ caching)
├── tsconfig.json         root TS config + path aliases
├── packageManager        pnpm@9.15.9 (pinned for CI consistency)
├── CODEOWNERS            mandatory review routing
├── CONTRIBUTING.md       trunk-based workflow & layer rules
└── .github/workflows/ci.yml  build + typecheck + lint + test + layer check
```

**Rule:** `libs/` may depend on nothing above; `packages/` may depend on
`libs/` only; `apps/` may depend on both. Enforced by `tools/check-layers.mjs`
and in CI.

## Getting started

```bash
pnpm install
pip install -r requirements.txt
cp .env.example .env

pnpm dev:backend      # apps/platform on :8765 (serves API + frontend)

# Full local stack (postgres + redis + backend + nginx) — production build
docker compose -f infra/docker-compose.yml up -d
```

### Prerequisites

- **Node.js** >= 20
- **pnpm** 9.15.9 (pinned via `packageManager` in root `package.json`)
- **Python** >= 3.12 with `pip`

## Repo commands

```bash
pnpm build            # via turbo, across affected packages
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint across JS/TS packages
pnpm test             # vitest (TS) + pytest (Python) + jest (AI)
pnpm clean            # remove build artifacts

pnpm check:layers     # enforce downward-only dependencies
pnpm validate         # layers + lint + typecheck
pnpm install:py       # pip install -r requirements.txt
```

## Testing

Tests run across multiple frameworks:

| Package | Framework | Command |
|---------|-----------|---------|
| TypeScript packages | vitest | `pnpm test` (via turbo) |
| `@casuya/ai` | jest | `pnpm test` (via turbo) |
| `casuya-platform` | pytest | `pnpm test` (via turbo) |
| `casuya-bridge` | node:test | `pnpm test` (via turbo) |

CI installs Python + pytest before running `pnpm test` so the platform's
Python test suite can execute alongside the TypeScript tests.

## Deployment (production-preserving)

The runtime image and deploy config mirror production exactly:
`infra/docker-compose.yml` and `infra/render.yaml` build
`apps/platform/docker/Dockerfile` (gunicorn `backend.main:app` on `PORT`).
`apps/platform/vercel.json` serves the static frontend on Vercel. The
`Dockerfile` and `vercel.json` are the production sources of truth and were left
untouched — only their paths moved under `apps/platform`.

## License

MIT
