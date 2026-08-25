# casuya-editor

> Canva + PowerPoint for Educational Lessons.

## Identity

Phase 2 repository within the Casuya educational ecosystem. The editor allows teachers and administrators to build educational experiences visually without programming.

## Mission

Empower educators to create rich, interactive lessons through a drag-and-drop visual interface — no coding required.

## Principles

- **Extensible** — new component types, templates, and import/export formats are pluggable
- **Offline-resilient** — autosave and resume work even on unreliable connections
- **Lightweight** — designed for low-end Android devices and weak hardware
- **Modular** — each module (visual-builder, component-library, templates, etc.) is independently maintainable
- **Phase 1 boundary** — never bypasses casuya-core; never owns auth, sync, or lesson execution

## Repository Structure

```
casuya-editor
├── visual-builder/     — canvas, drag-drop, grids, snapping, selection
├── component-library/  — text, headings, images, videos, audio, quizzes, games, simulations, forms, containers
├── templates/          — notes, quizzes, laboratories, presentations, assignments
├── previews/           — interactive lesson preview system
├── autosave/           — automatic save and recovery
├── importers/          — html, markdown, word, pdf
├── exporters/          — lesson package export
├── assets/             — shared asset management
├── themes/             — theme builder and styling
├── versioning/         — version history and undo/redo
├── accessibility/      — accessibility tooling
├── utilities/          — shared utilities
└── tests/              — test suites
```

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## License

MIT
