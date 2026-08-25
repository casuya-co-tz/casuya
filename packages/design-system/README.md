# Casuya Design System

> Standardized UI foundation for the Casuya educational platform.

## Packages

| Package          | Description                                            | Status |
| ---------------- | ------------------------------------------------------ | ------ |
| `@casuya/tokens` | Design tokens — colors, typography, spacing, shadows   | Alpha  |
| `@casuya/react`  | React component library — buttons, inputs, cards, etc. | Alpha  |
| `@casuya/icons`  | SVG icon library — 40+ educational icons               | Alpha  |
| `@casuya/theme`  | Theme system — light, dark, and high-contrast modes    | Alpha  |
| `@casuya/a11y`   | Accessibility utilities — focus trap, screen readers   | Alpha  |

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

## Git Practices

- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **Branching** — `main` (stable), `develop` (integration), `feat/*` (features)
- **Versioning** — Semantic versioning via Changesets
- **Hooks** — Pre-commit linting, commit message validation

## Architecture

```
casuya-design-system/
├── packages/
│   ├── tokens/      # Design tokens (zero-dependency)
│   ├── react/       # React components
│   ├── icons/       # SVG icon library
│   ├── theme/       # Theme provider (light/dark/hc)
│   └── a11y/        # Accessibility utilities
├── apps/
│   ├── docs/        # Storybook documentation
│   └── playground/  # Component test harness
└── .github/         # CI/CD workflows
```

## License

MIT
