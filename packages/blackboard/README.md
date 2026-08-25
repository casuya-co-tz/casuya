# casuya-blackboard

**Identity**: The Digital Blackboard — collaborative teaching surface for the Casuya ecosystem.

## Mission

Provide a lightweight, embeddable digital blackboard with real-time drawing, annotation, and
ecosystem integrations (lessons, media, and progress sync) so educators can present and explain
concepts directly inside Casuya-powered learning experiences.

## Features

### Drawing Tools
- Freehand pen with pressure sensitivity and Catmull-Rom smoothing
- Shapes: line, rectangle, circle, arrow with dash patterns and corner radius
- Text with word-wrap, font size control (8-72px), and custom font family
- Eraser with stroke-level point-proximity removal
- Roughness toggle (4 levels: clean to heavy sketch style)

### Selection & Manipulation
- Select, move, resize with 8 handles (4 corners + 4 edge midpoints)
- Rotate any element by 15° increments (Shift+R)
- Group/Ungroup elements (Ctrl+G / Ctrl+Shift+G)
- Multi-select via Shift+click or Ctrl+A (select all)
- Copy/Paste (Ctrl+C/V), Duplicate (Ctrl+D)
- Z-order: bring forward/backward, to front/back

### Canvas Features
- Infinite canvas with pan (Space+drag, Hand tool) and zoom (scroll, pinch)
- Graph paper with configurable grid, axes, and labels
- Snap-to-grid when graph paper enabled
- Smart alignment guides (blue dashed lines)
- Arrow edge-snapping to nearby elements

### Export & Storage
- SVG export with camera transform (Ctrl+Shift+S)
- PNG/JPEG export via toDataURL/toBlob
- JSON snapshot export/import
- localStorage persistence with size warnings
- Image paste (Ctrl+V) and drag-drop support

### UI & Themes
- Light and dark theme toggle
- Responsive toolbar (two-row on mobile)
- Context menu (right-click / long-press)
- Toast notifications
- ~28KB gzipped — fast on 2G networks

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| H | Hand tool |
| P | Pen tool |
| T | Text tool |
| L | Line tool |
| R | Rectangle tool |
| O | Circle tool |
| A | Arrow tool |
| E | Eraser tool |
| Space+drag | Pan canvas |
| Shift+R | Rotate 15° |
| Ctrl+A | Select all |
| Ctrl+G | Group |
| Ctrl+Shift+G | Ungroup |
| Ctrl+C/V | Copy/Paste |
| Ctrl+D | Duplicate |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+Shift+S | Export SVG |
| Ctrl+/- | Zoom in/out |
| Ctrl+0 | Reset zoom |
| Del/Backspace | Delete selected |

## Integration

Built with `tsup`. The compiled `dist/` is mounted by `casuya-platform/backend/main.py`.

## Usage

```typescript
import { Blackboard } from 'casuya-blackboard';

const board = new Blackboard({
  container: document.getElementById('app'),
  theme: 'light',
});

// Access API
board.setTool('pen');
board.setColor('#ff0000');
board.rotateSelected(Math.PI / 6);
board.groupSelected();
const svg = board.exportSVG();
```
