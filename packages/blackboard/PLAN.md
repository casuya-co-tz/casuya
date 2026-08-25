# casuya-blackboard — Digital Blackboard Module

## Overview

A lightweight TypeScript library providing an interactive digital blackboard for the Casuya educational platform. Students draw freely, write math, create diagrams, and plot graphs using a stylus, finger, nail, or any sharp object on cheap devices.

## Problem Statement

Students in Tanzania and low-connectivity markets need to write math, draw diagrams, and plot graphs on low-end devices with no pressure-sensitive stylus. The blackboard must feel natural and responsive without requiring expensive hardware.

## Architecture

```
casuya-blackboard/
├── src/
│   ├── index.ts          # Public API exports (full package)
│   ├── browser-core.ts   # Browser-only entry (Blackboard + toolbar, no heavy deps)
│   ├── types.ts          # TypeScript interfaces
│   ├── Blackboard.ts     # Core drawing engine + rendering
│   ├── viewport.ts       # Viewport transform (zoom/pan) utility
│   ├── toolbar.ts        # Beautiful UI toolbar
│   └── integrations/
│       ├── ExamsBridge.ts    # casuya-exams step validation + submission
│       ├── MathBridge.ts     # casuya-math KaTeX render + solve + equivalence
│       ├── OcrBridge.ts      # Handwriting OCR (Mathpix / Tesseract / mock)
│       ├── PlatformBridge.ts # Orchestrates all bridges + auto-save
│       └── index.ts          # Re-exports bridges
├── dist/                 # Built output
│   ├── index.js          # ESM (full pkg)
│   ├── index.cjs         # CJS (full pkg)
│   ├── blackboard.umd.js # Browser UMD bundle — core only
│   └── index.d.ts        # Types
├── demo.html             # Live demo page
├── tests/                # Vitest tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5 | Strict mode, clean types |
| Build | tsup | Fast bundling, ESM + CJS + IIFE output |
| Testing | Vitest + happy-dom | Fast, modern test runner |
| Stroke Engine | **perfect-freehand** | Industry standard (5.6k stars, used by tldraw, Excalidraw) |
| Rendering | Canvas 2D API | Direct pixel control, no framework overhead |
| Math | **katex** + mathjs (fallback) | LaTeX rendering + local solve |
| OCR | **tesseract.js** / Mathpix | Handwriting recognition (lazy-loaded) |
| Dependencies | 3 | perfect-freehand, katex, tesseract.js |

## Features

### Drawing

| Tool | Description |
|---|---|
| **Pen** | Freehand drawing with velocity-based pressure simulation |
| **Line** | Straight line between two points |
| **Rectangle** | Rectangle shape |
| **Circle** | Ellipse shape |
| **Arrow** | Line with arrowhead |
| **Text** | Click-to-place text annotation with font size control |
| **Eraser** | Remove strokes |
| **Select** | Click to select elements for move/delete |

### Element Model (v0.2.0 — Excalidraw-inspired)

Every element on the blackboard has:
- **ID** (`crypto.randomUUID()`) — unique identity for selection, undo/redo, serialization
- **Bounding box** — computed from element geometry for hit-testing and selection
- **Z-ordering** — elements rendered in insertion order; selected element brought to front
- **Selection state** — visual highlight with dashed border + resize handles (future)

This replaces the raw stroke/shape arrays of v0.1.0 with a proper element-based architecture, enabling per-element selection, movement, and deletion.

### Text Tool (NEW in v0.2.0)

- Click to place a text cursor on the canvas
- Type text directly; renders via Canvas 2D `fillText`
- Configurable font size (12–48px) via toolbar slider
- Text element stores: position, text content, font size, color
- Double-click to edit existing text element
- Essential for teacher annotations, labels, and headings

### Viewport: Zoom & Pan (NEW in v0.2.0)

Inspired by Excalidraw's viewport model:
- **Zoom**: Ctrl+scroll wheel to zoom in/out (50%–300%)
- **Pan**: Space+drag or middle-mouse to pan the canvas
- **Coordinate translation**: All pointer events pass through viewport transform
- **Reset**: Double-click zoom indicator to reset to 100%
- Zoom level displayed in toolbar
- Grid/graph paper scales with viewport

### Selection & Move (NEW in v0.2.0)

- **Select tool**: Click on any element to select it
- **Visual feedback**: Dashed blue border around selected element's bounding box
- **Move**: Drag selected element to reposition
- **Delete**: Press Delete/Backspace to remove selected element
- **Multi-select**: (future) Ctrl+click for multiple selection
- **Deselect**: Click empty space or press Escape

### Stroke Quality (perfect-freehand)

- **Polygon outline rendering** — strokes look like real ink, not centerlines
- **Velocity-based pressure** — fast strokes are thin, slow strokes are thick
- **Thinning (0.5)** — pressure affects width naturally
- **Smoothing (0.5)** — smooth curves without jitter
- **Streamline (0.5)** — reduces noise from cheap touch screens
- **Simulated pressure** — automatic when no hardware pressure available

### Graph Paper

- Toggle grid with coordinate axes
- Configurable spacing (default 25px)
- X/Y axis labels
- Arrow heads on axes
- Scales with viewport zoom

### UI Toolbar

- Tool buttons with SVG icons and hover/active states
- 8-color picker with scale animation
- Width slider (1-20px) with live preview dot
- Font size slider (12-48px) — visible when text tool active
- Undo/Redo/Clear/Graph/Save buttons
- Zoom level indicator with reset button
- Toast notification on save
- 150ms ease transitions on all interactive elements

### Persistence

- Save to localStorage
- Load from localStorage
- Export to PNG (merged canvas)
- Export to JSON (full scene snapshot with viewport)
- Import from JSON

### Integrations (PlatformBridge)

| Bridge | Purpose | Online | Offline fallback |
|---|---|---|---|
| **ExamsBridge** | Validate/substantiate each step against `casuya-exams` | `POST /exams/validate-step`, `/exams/submit` | Local string/normalized grading |
| **MathBridge** | Render LaTeX (KaTeX), solve, equivalence | `POST /math/solve`, `/math/equivalence` | mathjs (require) → string normalization |
| **OcrBridge** | Handwriting → LaTeX | Mathpix API / Tesseract worker | Mock provider returns sample LaTeX |
| **PlatformBridge** | Mount blackboard, auto-save progress (30s), step tracking | `POST /progress/sync`, `GET /progress/:student/:lesson` | Silent (saved locally) |

The browser UMD bundle (`blackboard.umd.js`) contains **only the core** (Blackboard + toolbar). The integration bridges and their heavy deps (katex, tesseract.js) are kept out of the UMD bundle so the static frontend loads fast on 2G. In the platform, `frontend/assets/js/blackboard-embed.js` mounts the core and calls the REST endpoints directly.

#### Backend endpoints (casuya-api)

Registered in `casuya-api/src/blackboard-handlers.ts` and `server.ts`. Handlers delegate to
`src/integrations/exams-service.ts` (wraps **casuya-exams** `GradingEngine`) and
`src/integrations/math-service.ts` (wraps **casuya-math** `EquationSolver`), each with a
local fallback if the package fails to load:

- `POST /progress/sync` — append a step snapshot for a student+lesson
- `GET  /progress/:studentId/:lessonId` — latest saved snapshot
- `POST /exams/validate-step` — grade one step via `casuya-exams` `GradingEngine` (short-answer strategy)
- `POST /exams/submit` — grade a full exam, return percentage + pass
- `POST /math/solve` — solve a formula via `casuya-math` `EquationSolver`
- `POST /math/equivalence` — numeric + structural equivalence check

### Performance

- **Two-canvas architecture** — static canvas (committed strokes) + live canvas (active stroke)
- **requestAnimationFrame** — dirty flag + rAF for optimal rendering
- **DevicePixelRatio** — HiDPI support
- **Viewport culling** — only render elements visible in the current viewport
- **< 1ms render** — no framework overhead

## Usage

```typescript
import { Blackboard } from 'casuya-blackboard';

const board = new Blackboard({
  container: document.getElementById('app')!,
  width: 800,
  height: 600,
});

// Draw with pen
board.setTool('pen');
board.setColor('#1e293b');
board.setWidth(2);

// Draw shapes
board.setTool('rect');
board.setTool('circle');
board.setTool('line');
board.setTool('arrow');

// Add text annotations
board.setTool('text');
board.setFontSize(18);
// Click on canvas to place text, then type

// Select and move elements
board.setTool('select');
// Click element to select, drag to move, Delete to remove

// Zoom and pan
board.setZoom(1.5);          // 150%
board.setZoom(1);            // reset
board.panTo(x, y);           // pan viewport
// Or use Ctrl+Scroll to zoom, Space+Drag to pan

// Toggle graph paper
board.enableGraph({ spacing: 25, showAxes: true });
board.disableGraph();

// Undo/Redo
board.undo();
board.redo();

// Save/Load
board.saveToStorage();
board.loadFromStorage();

// Export
const png = board.toDataURL();
const json = board.exportJSON();
board.importJSON(json);

// Clean up
board.destroy();
```

## For Tanzanian Students

| Need | Solution |
|---|---|
| Write math | Pen tool with velocity-based pressure |
| Draw diagrams | Shape tools (rect, circle, line, arrow) |
| Annotate | Text tool with configurable font size |
| Plot graphs | Graph paper with coordinate axes |
| Zoom in on small screens | Pinch/scroll zoom (50%–300%) |
| Move mistakes | Select tool + drag to reposition |
| Works offline | localStorage save/load |
| Cheap devices | Lightweight UMD bundle, rAF rendering |
| No stylus | Velocity simulates pressure from finger/nail |
| 2G network | Fast loading, < 15KB gzipped core |
| Platform | Auto-mounts in student lesson view via `blackboard-embed.js` |

## Platform Integration Plan (Lessons, Quizzes, Exams, Games, Assignments)

**Status:** Plan approved 2026-08-01. Not yet implemented. This section is the source of truth — every implementation update to blackboard integration in the Casuya platform MUST be reflected here (status, files touched, verified behavior).

### 1. Status

| Feature | Status | Files touched | Verified behavior |
|---|---|---|---|
| Shared foundation (mount helper) | DONE | casuya-platform/frontend/assets/js/blackboard-embed.js | **Bugfixes:** (1) `mountBlackboard` was calling `new Blackboard(container, {...})` but the constructor expects `{ container, ... }` — threw `Cannot read properties of undefined (reading 'clientWidth')`, so blackboard never mounted. Now passes options object; removed non-existent `bb.start()` and redundant `createToolbar()` call. (2) Drawing area had **0px height**: canvases are absolutely positioned, so the wrapper (only `position:relative; overflow:hidden`) collapsed to 0 → toolbar visible but nothing to draw on / no cursor interaction. Fixed in `Blackboard` constructor (src/Blackboard.ts + vendor-blackboard.js): wrapper now gets explicit `width`/`height` from `this.width`/`this.height`; embed passes `width/height` from the container (`clientWidth`/`clientHeight`). Verified headless: wrapper 420px, canvas 600x420, synthetic pointer drag creates an element (`getElements()` 0→1). |
| Lessons (student flow) | DONE | casuya-platform/frontend/assets/js/main.js | Practice Blackboard card added to viewStudentLesson (line ~1508) + autoMount() called after render |
| Quizzes (show-your-work) | DONE | casuya-platform/frontend/assets/js/main.js (renderQuiz + renderStudentQuiz) | Each quiz question now has a collapsible "Show your work" blackboard (`data-blackboard` + `data-lesson-id="lessonId-questionId"`). Both teacher/admin and student views updated. |
| Exams (step grading) | DONE | casuya-platform/frontend/assets/js/main.js (startExam) | Each exam question now has a collapsible "Show your work" blackboard (`data-blackboard` + `data-lesson-id="exam-quizId-questionId"`). Students can scratch during timed exams. |
| Games (scratch pad) | DONE | casuya-platform/frontend/assets/js/main.js (viewStudentGame, game-item click handler) | Scratch blackboard added below game iframe in both standalone game view and lesson game area. Collapsible "Scratch Pad" with autoMount(). |
| Assignments (backend + grading) | DONE | casuya-platform/backend/models/assignment.py, services/assignment_service.py, api/assignments.py, config/database.py, main.py; casuya-platform/frontend/assets/js/main.js, blackboard-embed.js | Full stack: Assignment + AssignmentSubmission models (PostgreSQL), REST routes (list/get/create/delete/submit/list-submissions, teacher-role guarded on create/delete), teacher view rewritten off localStorage, student nav entry + `loadStudentAssignments`/`openStudentAssignment` with blackboard submission. Fixes during smoke test: submit body via Pydantic model, `current_user["sub"]`, `el._casuyaBlackboard` instance stored in mountBlackboard, delete cascades submissions. Verified live on :8765 (create→get→submit→submissions→delete all 200). |
| Routing fix (8765 ↔ /api prefix) | DONE | casuya-platform/backend/config/settings.py, casuya-platform/backend/api/casuya_api_proxy.py, casuya-platform/backend/main.py, casuya-platform/frontend/assets/js/blackboard-embed.js | Proxy added: `/api/*` → casuya-api `:8081/api/*`; blackboard-embed.js updated to use `/api/exams/*`, `/api/math/*` |

### 2. Goals

Give students a working blackboard in every learning surface: work out lesson problems, show work on quiz answers, solve exam steps with auto-grading, scratch-pad in games, and submit gradeable assignment work.

### 3. Design

**Shared foundation:** one reusable mount helper (e.g. `CasuyaBlackboardEmbed.mountScratch(container, { lessonId, step })`) used by all features. Blackboard snapshots drawing to JSON → auto-save every 30s → grade via `POST /exams/validate-step` (returns `{ correct, score, feedback, recognizedLatex }`).

### 4. Per-feature plan

#### 4.1 Lessons
- Insert the existing "Practice Blackboard" card (currently only in `viewLessonContent`, main.js:431-435) into the student flow `viewStudentLesson` (main.js:1410) and call `autoMount()`.
- Function: student draws/writes math in the lesson, gets step feedback, progress auto-saved.
- Effort: SMALL. Zero backend work.

#### 4.2 Quizzes
- Add a "Show your work" blackboard under each quiz question in the quiz form.
- On submit, blackboard snapshot → `/exams/validate-step` alongside the answer; work score merges into the existing `/quizzes/{id}/submit` result (e.g. 70% answer + 30% work).
- Requires the routing fix (§6).
- Effort: MEDIUM.

#### 4.3 Exams
- Wire the student exam flow (`startExam`, main.js:1824) to the existing step-grading endpoints `POST /exams/submit` / `POST /exams/validate-step` (casuya-api, backed by `casuya-exams` GradingEngine), instead of (or alongside) `/quizzes/{id}/submit`.
- Activates the step-by-step grading engine that already exists in `casuya-api` + `casuya-exams`.
- Requires the routing fix (§6).
- Effort: MEDIUM.

#### 4.4 Games
- Add a scratch blackboard panel beside each game ("work it out here"). No grading; scratch only + optional `/math/solve`.
- Effort: SMALL-MEDIUM.

#### 4.5 Assignments
- Currently a localStorage-only teacher stub (`loadTeacherAssignments`, main.js:5307) — no backend, no student view, no grading.
- Needs a real backend from scratch: model + routes (`/assignments`, `/assignments/{id}/submit`), student view, and grading using the blackboard step engine.
- Effort: LARGE.

### 5. Suggested order

1. Routing fix (§6) — unblocks 4.2/4.3
2. Lessons (§4.1) — smallest, proves the pattern
3. Quizzes + Exams (§4.2, §4.3) — reuse existing grading stack
4. Games (§4.4)
5. Assignments (§4.5) — largest

### 6. Prerequisites (must resolve before 4.2/4.3)

1. **Routing fix:** `blackboard-embed.js` posts to `:8765/exams/*` but handlers live at `:8081/api/exams/*` — add a proxy/rewrite so the blackboard reaches its own grading endpoints.
2. **Progress persistence:** casuya-api `/progress/sync` is in-memory only; prefer the platform's persisted `/progress/sync` (via `progress_service`).
3. **Two exam stacks:** decide whether to unify (quizzes-as-exams vs casuya-api exams) or keep separate.

### 7. Known gaps captured

- Lesson blackboard card is wired but not reachable by students (rendered only in teacher/admin `viewLessonContent`).
- Teacher/admin portals do not load `vendor-blackboard.js`/`blackboard-embed.js` (only `student/index.html` does).
- Assignments feature is a localStorage-only stub.

## Changelog

### v0.2.0 (2026-07-19)

Inspired by [Excalidraw](https://github.com/excalidraw/excalidraw)'s architecture. Adopted patterns (not code) from their element-based model, text tool, and viewport system.

**New features:**
- **Element model**: Every stroke/shape has a unique ID and bounding box, enabling selection and manipulation
- **Text tool**: Click to place text, configurable font size (12–48px)
- **Zoom/pan**: Ctrl+scroll to zoom, Space+drag to pan, zoom indicator in toolbar
- **Select tool**: Click to select elements, drag to move, Delete to remove
- **Font size control**: Slider in toolbar when text tool is active
- **Viewport-aware rendering**: Elements outside viewport are skipped during render

**Improvements:**
- Selection highlights with dashed blue border
- Toolbar reorganized with separators and grouped controls
- JSON export now includes viewport state (zoom, scroll)
- Graph paper scales with viewport zoom

**Architecture changes:**
- `types.ts`: Added `TextElement`, `Viewport`, `SelectionBox` types
- `viewport.ts`: New file — viewport transform utilities (screen→canvas, canvas→screen, bounds check)
- `Blackboard.ts`: Element-based rendering with selection/move/delete, viewport management
- `toolbar.ts`: New tools (text, select), font size slider, zoom indicator

### v0.1.0 (2026-07-18)

Initial release:
- Pen, line, rect, circle, arrow, eraser tools
- Graph paper with coordinate axes
- Undo/redo, save/load, PNG/JSON export
- Integration bridges (exams, math, OCR, platform)
- Two-canvas rendering architecture
- 32KB UMD bundle
