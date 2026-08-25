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
│   ├── design-system/  React UI kit
│   ├── editor/      visual lesson builder
│   └── runtime/     lesson player
├── libs/            rank 0 — reusable low-level code
│   └── core/        Python lesson compiler / packager / signer engine
├── infra/           deployment: docker-compose, Dockerfile, nginx, render.yaml
├── tools/           repo scripts (e.g. layer-boundary enforcement)
├── pnpm-workspace.yaml   workspace definition (apps/*, packages/*, libs/*)
├── turbo.json            task runner (build/typecheck/lint/test w/ caching)
├── tsconfig.json         root TS config + path aliases
├── CODEOWNERS            mandatory review routing
├── CONTRIBUTING.md       trunk-based workflow & layer rules
└── .github/workflows/ci.yml  build + typecheck + lint + test + layer check
```

**Rule:** `libs/` may depend on nothing above; `packages/` may depend on
`libs/` only; `apps/` may depend on both. Enforced by `tools/check-layers.mjs`
and in CI.

## Why this matches the "giants"

- **One repo, one trunk** — no per-service repositories; atomic cross-cutting
  changes, single source of truth.
- **Layered, dependency-enforced layout** — downward-only deps enforced by
  a lightweight boundary checker + Turborepo.
- **Hermetic, cached builds** — `turbo` builds/tests only what changed.
- **Scale-oriented runtime** — `apps/platform` is stateless behind nginx, uses
  Postgres + Redis (cache/queue via RQ), and serves the static frontend from a
  CDN/Vercel, so it scales horizontally like a standard web tier.
- **Process discipline** — `CODEOWNERS`, `CONTRIBUTING.md`, CI gate on every PR.

## Getting started

```bash
pnpm install
pip install -r requirements.txt
cp .env.example .env

pnpm dev:backend      # apps/platform on :8000
pnpm dev:frontend     # static UI on :5173

# Full local stack (postgres + redis + backend + nginx) — production build
docker compose -f infra/docker-compose.yml up -d
```

## Repo commands

```bash
pnpm build / typecheck / lint / test   # via turbo, across affected packages
pnpm check:layers                      # enforce downward-only dependencies
pnpm validate                          # layers + lint + typecheck
```

## Deployment (production-preserving)

The runtime image and deploy config mirror production exactly:
`infra/docker-compose.yml` and `infra/render.yaml` build
`apps/platform/docker/Dockerfile` (gunicorn `backend.main:app` on `PORT`).
`apps/platform/vercel.json` serves the static frontend on Vercel. The
`Dockerfile` and `vercel.json` are the production sources of truth and were left
untouched — only their paths moved under `apps/platform`.

## License

MIT
