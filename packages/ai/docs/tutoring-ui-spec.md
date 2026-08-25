# AI Tutoring Response — Visual Style & UI Specification

> For the `#ai-assistant` tutoring explanation panel at `/teacher/#ai-assistant`.

---

## 1. Core Visual Style & Aesthetics

### Color Palette (Exam-Focused & Accessible)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--tutor-primary` | `#1D4ED8` | `#3B82F6` | Brand, headers, links |
| `--tutor-accent` | `#F59E0B` | `#FBBF24` | NECTA Exam Tips, warnings |
| `--tutor-bg` | `#F8FAFC` | `#0F172A` | Response background |
| `--tutor-surface` | `#FFFFFF` | `#1E293B` | Cards, code blocks |
| `--tutor-success` | `#16A34A` | `#22C55E` | Correct answers, marking schemes |
| `--tutor-danger` | `#DC2626` | `#EF4444` | Common NECTA pitfalls |
| `--tutor-text` | `#1E293B` | `#E2E8F0` | Body text |
| `--tutor-muted` | `#64748B` | `#94A3B8` | Secondary text |
| `--tutor-border` | `#E2E8F0` | `#334155` | Borders |

### Typography

- **Body:** `'Plus Jakarta Sans', 'Inter', system-ui, sans-serif` — line-height `1.6`
- **Code/Formulas:** `'Fira Code', 'JetBrains Mono', monospace` — light background tint `#F1F5F9`
- **Mobile:** designed for 360px minimum width

---

## 2. Custom UI Components

### 💡 NECTA Exam Tip Callout

High-contrast callout box. Gold left border, warm background, lightbulb badge.

```
┌──────────────────────────────────────┐
│ 💡 NECTA Examination Tip             │  ← bold, amber text
│                                      │
│ Arrows must point in the direction   │
│ energy flows (eaten → eater).        │
└──────────────────────────────────────┘
```

- `border-left: 4px solid var(--tutor-accent)`
- Background: `#FFFBEB` (light) / `#451A03` (dark, 30% opacity)
- Badge: 💡 inline, left-aligned

### > Local Context Blockquote

Styled quotation block with subtle badge, muted tint, italicized prose.

```
┌──────────────────────────────────────┐
│ 🌍 Tanzania Context                  │  ← muted badge
│                                      │
│ In a Serengeti savannah ecosystem:   │
│ Grass → Zebra → Lion.               │
└──────────────────────────────────────┘
```

- `border-left: 3px solid var(--tutor-primary)`
- Background: `#EFF6FF` (light) / `#1E3A8A` (dark, 20% opacity)

### 📊 Code / Diagram Block

Monospaced container with horizontal scroll. No wrapping on mobile.

```
┌──────────────────────────────────────┐
│ Sun → Grass (100%) → Zebra (10%)    │  ← horizontally scrollable
│ → Lion (1%)                         │
└──────────────────────────────────────┘
```

- Font: monospace, 0.85rem
- Background: `#F1F5F9` / `#1E293B`
- `overflow-x: auto` — scrollable on narrow screens
- `border-radius: 8px`

### ❓ Review Question Card

Card container with toggle button for marking scheme.

```
┌──────────────────────────────────────┐
│ Review Question (Section B):         │
│ Distinguish between food chain       │
│ and food web.                        │
│                                      │
│  [Show Marking Scheme]  ← toggle    │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ ✅ Model Answer:                     │
│ A food chain is linear...            │
└──────────────────────────────────────┘
```

- Card with subtle border
- Toggle: pill button, expands to show answer
- Answer: green-tinted background `#F0FDF4`

### ⚡ Follow-up Action Chips

Tap-friendly chips at bottom of response. Mobile-optimized (min 44px touch target).

```
[📄 Marking Scheme]  [➡️ Next Topic]  [❓ Ask Again]
```

- Pill shape, `border-radius: 9999px`
- Border: `1px solid var(--tutor-border)`
- Hover: background tint
- Min height: 44px (WCAG touch target)

### 📋 Markdown Table → Mobile Card Collapse

On screens < 640px, tables collapse to stacked key-value pairs:

```
┌─────────────────────────┐
│ Verb     │ Define       │
│ Response │ Short,       │
│          │ precise only │
└─────────────────────────┘
```

---

## 3. Mobile-First Constraints

- Design for **360px minimum** screen width
- No side-by-side multi-column tables on mobile — auto-collapse to cards
- Formula steps use **expandable accordions** (Step 1, Step 2, Step 3)
- All interactive elements: **min 44px** touch target
- Generous white space between sections
- Dark mode via `[data-theme="dark"]`

---

## 4. Implementation Notes

### CSS Architecture

- All tutoring styles scoped under `.tutor-response` namespace
- Uses existing `--color-*` CSS variables from `main.css`
- Dark mode handled via `[data-theme="dark"]` overrides
- No external dependencies — pure CSS

### Markdown Rendering

- Lightweight inline renderer (no library)
- Converts: `###` headers, `**bold**`, `*italic*`, `` `code` ``, `> blockquote`, `***` hr, `- lists`, ```` ``` ```` code blocks, `| tables |`
- Wraps detected NECTA tips in callout component
- Wraps detected blockquotes in local context component
- Wraps detected code/diagram blocks in scrollable container
- Extracts review questions into card with toggle
- Extracts follow-up bullets into action chips

### File Locations

- CSS: `apps/platform/frontend/assets/css/main.css` (append to end)
- JS: `apps/platform/frontend/assets/js/modules/teacher-dashboard.js` (`loadTeacherAIAssistant`)
