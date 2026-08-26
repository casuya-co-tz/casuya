# AGENTS.md — AI Agent Instructions

## Project overview

Casuya is a **single-trunk, layered monorepo** for an interactive-learning
platform targeting Tanzanian secondary schools on low-end Android devices
and 2G/3G networks.

## Monorepo structure

```
apps/platform/         FastAPI backend + static frontend (rank 2)
packages/ai/           AI tutoring engine (rank 1)
packages/blackboard/   Digital blackboard (rank 1)
packages/bridge/       Offline-first sync engine (rank 1)
packages/ds-tokens/    Design tokens + theme (flattened from design-system)
packages/ds-react/     React UI kit (flattened from design-system)
packages/ds-a11y/      Accessibility primitives (flattened from design-system)
packages/ds-hooks/     React hooks (flattened from design-system)
packages/ds-icons/     Icon set (flattened from design-system)
packages/ds-styles/    Style primitives (flattened from design-system)
packages/ds-utils/     UI utilities (flattened from design-system)
packages/ds-theme/     Theme definitions (flattened from design-system)
packages/editor/       Visual lesson builder (rank 1)
packages/runtime/      Lesson player (rank 1)
libs/core/             Python lesson compiler (rank 0)
```

**Dependency rule:** downward-only. `apps/` → `packages/` → `libs/`.
Enforced by `tools/check-layers.mjs` and CI.

## Essential commands

```bash
# Build and validate everything
pnpm build             # Turborepo build across all packages
pnpm typecheck         # TypeScript type checking
pnpm lint              # ESLint across JS/TS packages
pnpm test              # vitest + pytest + jest + node:test

# Combined validation
pnpm validate          # layers + lint + typecheck
pnpm check:layers      # enforce downward-only dependencies

# Platform-specific
cd apps/platform/frontend && npm run minify:js   # minify frontend JS
pytest apps/platform/tests/ -v                    # run Python tests
```

## Key technical details

- **Package manager:** pnpm 9.15.9 (pinned via `packageManager` in root `package.json`)
- **Node:** 20
- **Python:** 3.12
- **Build tool:** Turborepo with caching
- **Test frameworks:** vitest (TS packages), pytest (Python), jest (AI), node:test (bridge)
- **TypeScript:** `moduleResolution: "bundler"` — `exports` must list `types` first
- **Storybook:** not installed; `*.stories.tsx` files excluded from typecheck

## Code conventions

- TypeScript: extend `tsconfig.base.json`, strict mode
- Python: PEP8, type hints, Pydantic models
- Commits: imperative mood ("add feature", not "added feature")
- All CI steps must pass: build, typecheck, lint, test, layer check
