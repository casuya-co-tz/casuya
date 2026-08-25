# Casuya Design System

> Standardized UI foundation for the Casuya educational platform.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@casuya/tokens` | Design tokens — colors, typography, spacing, shadows | Alpha |
| `@casuya/react` | React component library — buttons, inputs, cards, etc. | Alpha |
| `@casuya/icons` | SVG icon library — 40+ educational icons | Alpha |
| `@casuya/theme` | Theme system — light, dark, and high-contrast modes | Alpha |
| `@casuya/a11y` | Accessibility utilities — focus trap, screen readers | Alpha |
| `@casuya/utils` | Utility functions — cn, formatBytes, truncate, pluralize | Alpha |
| `@casuya/hooks` | React hooks — useDebounce, useMediaQuery, useBreakpoint | Alpha |
| `@casuya/styles` | Global CSS — reset, tokens, dark mode | Alpha |

### Apps

| App | Description |
|-----|-------------|
| `playground` | Component test harness / visual playground |
| `docs` | Storybook documentation (Storybook not yet installed) |

## Principles

1. **Education-first** — Every component serves the Casuya educational platform.
2. **Accessible** — WCAG 2.1 AA minimum; high-contrast theme included.
3. **Performant** — Tree-shakeable, zero-dependency runtime, small bundles.
4. **Extensible** — Design tokens drive theming; new variants are additive.
5. **Consistent** — Single source of truth for colors, spacing, typography.
6. **Responsive** — Works on low-end Android devices and unreliable networks.

## Quick Start

```bash
pnpm install
pnpm build
```

### Import tokens

```css
@import '@casuya/tokens/css';
```

```tsx
import { colors, spacing } from '@casuya/tokens';
```

### Use components

```tsx
import { Button, Input, Card, Heading } from '@casuya/react';
import { ThemeProvider } from '@casuya/theme';

function App() {
  return (
    <ThemeProvider>
      <Card>
        <Heading level={2}>Welcome</Heading>
        <Button onClick={() => alert('Hello!')}>Get Started</Button>
      </Card>
    </ThemeProvider>
  );
}
```

### Dark mode

```tsx
import { useTheme } from '@casuya/theme';

function Toggle() {
  const { mode, toggle } = useTheme();
  return <button onClick={toggle}>Current: {mode}</button>;
}
```

## Architecture

```
packages/design-system/
├── packages/
│   ├── tokens/      # Design tokens (zero-dependency)
│   ├── react/       # React components (Button, Input, Card, etc.)
│   ├── icons/       # SVG icon library
│   ├── theme/       # Theme provider (light/dark/hc)
│   ├── a11y/        # Accessibility utilities
│   ├── utils/       # Utility functions
│   ├── hooks/       # React hooks
│   └── styles/      # Global CSS (reset, tokens, dark mode)
├── apps/
│   ├── playground/  # Component test harness
│   └── docs/        # Storybook documentation
└── tsconfig.base.json
```

This is a **nested pnpm workspace** — the root `pnpm-workspace.yaml` includes
`packages/design-system/packages/*` and `packages/design-system/apps/*`.

## Build

All sub-packages use `tsup` for building (ESM + CJS + type declarations).
The `exports` field in each `package.json` must list `types` first for
TypeScript bundler resolution.

```bash
pnpm build           # build all packages via Turborepo
pnpm typecheck       # type-check all packages
pnpm lint            # lint all packages
pnpm test            # run all tests
```

## Git Practices

- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **Branching** — `main` (stable), short-lived feature branches
- **Versioning** — Semantic versioning via Changesets
- **Hooks** — Pre-commit linting, commit message validation

## License

MIT
