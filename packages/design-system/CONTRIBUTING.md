# Contributing

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>

feat(tokens): add new color scale
fix(react): correct Button disabled state
docs: update README usage examples
chore(repo): configure CI caching
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

**Scopes:** `tokens`, `react`, `icons`, `theme`, `a11y`, `utils`, `hooks`, `styles`, `docs`, `playground`, `repo`

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — protected, requires PR |
| `feat/*` | Feature branches |
| `fix/*` | Bug fix branches |
| `chore/*` | Maintenance branches |

## Development Workflow

1. Branch from `main`: `git checkout -b feat/my-feature main`
2. Make changes
3. Run `pnpm lint && pnpm typecheck && pnpm test`
4. Create a changeset: `pnpm changeset`
5. Commit with conventional message
6. Open a PR into `main`

## PR Guidelines

- PR title must follow conventional commits
- Include screenshots for visual changes
- Link related issues
- Ensure CI passes

## Adding New Components

1. Create component in `packages/react/src/components/`
2. Export from `packages/react/src/index.ts`
3. Add Storybook story: `ComponentName.stories.tsx` (excluded from typecheck)
4. Run `pnpm build` to verify

## Design Token Changes

1. Edit `packages/tokens/src/` source files
2. Update CSS custom properties in `packages/tokens/src/tokens.css`
3. Run `pnpm build` to verify

## Technical Notes

- All sub-packages build with `tsup` (ESM + CJS + type declarations)
- The `exports` field in `package.json` must list `types` **first** for TypeScript bundler resolution
- Storybook stories (`*.stories.tsx`) are excluded from typecheck — Storybook is not installed as a dependency
- This is a nested pnpm workspace — root `pnpm-workspace.yaml` includes `packages/design-system/packages/*` and `packages/design-system/apps/*`
