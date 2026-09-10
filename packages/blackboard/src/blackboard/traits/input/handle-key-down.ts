import type { BlackboardBase } from '../../base';
import { isInInput } from '../../../utils';
import type { Tool } from '../../../types';

export function handleKeyDown(bb: BlackboardBase, e: KeyboardEvent): void {
    if (bb.textInput) return;
    if (isInInput(e.target)) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      e.shiftKey ? bb.redo() : bb.undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      bb.redo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      bb.zoomTo(bb.camera.zoom * 1.1);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      bb.zoomTo(bb.camera.zoom * 0.9);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      bb.resetView();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      bb.duplicateSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      bb.copySelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      bb.pasteClipboard();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      bb.copySelected();
      bb.deleteSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      bb.selectAll();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (bb.contextMenu) { bb.dismissContextMenu(); return; }
      if (bb.selectedIds.size > 0) {
        bb.selectedIds.clear();
        bb.renderAll();
      } else if (bb.isDrawing && bb.currentElement) {
        bb.isDrawing = false;
        bb.currentElement = null;
        bb.flushLive();
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (!bb.isSpaceDown) {
        bb.isSpaceDown = true;
        bb.liveCanvas.style.cursor = 'grab';
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      bb.deleteSelected();
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const nudge = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); bb.nudgeSelected(-nudge, 0); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); bb.nudgeSelected(nudge, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); bb.nudgeSelected(0, -nudge); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); bb.nudgeSelected(0, nudge); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === ']') {
      e.preventDefault();
      if (e.shiftKey) bb.bringToFront(); else bb.bringForward();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '[') {
      e.preventDefault();
      if (e.shiftKey) bb.sendToBack(); else bb.sendBackward();
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
      e.preventDefault();
      if (bb.activeTool === 'text') bb.setFontSize(bb.fontSize + 2);
      else bb.setWidth(bb.strokeWidth + 1);
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
      e.preventDefault();
      if (bb.activeTool === 'text') bb.setFontSize(bb.fontSize - 2);
      else bb.setWidth(bb.strokeWidth - 1);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
      e.preventDefault();
      bb.groupSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      bb.ungroupSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      const svg = bb.exportSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'blackboard.svg'; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      bb.exportPNG();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      bb.applyStyleToSelected();
      return;
    }

    if (e.shiftKey && e.key === 'R') {
      e.preventDefault();
      bb.rotateSelected(Math.PI / 12);
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      bb.showShortcutHelp();
      return;
    }

    const keyToolMap: Record<string, Tool> = {
      'v': 'select', 'h': 'hand', 'p': 'pen', 'm': 'highlighter',
      't': 'text', 'l': 'line', 'r': 'rect', 'o': 'circle',
      'a': 'arrow', 'e': 'eraser', 'b': 'laser', 'n': 'diamond'
    };

    if ((e.ctrlKey || e.metaKey) && !['z','+','-','0','d','c','v','x','a','g',']','['].includes(e.key.toLowerCase())) {
      return;
    }

    const tool = keyToolMap[e.key.toLowerCase()];
    if (tool) {
      bb.commitText();
      bb.setTool(tool);
    }
  }