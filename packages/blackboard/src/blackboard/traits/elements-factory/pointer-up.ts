import type { Stroke } from '../../../types';
import type { BlackboardBase } from '../../base';

export function handlePointerUp(bb: BlackboardBase, e: PointerEvent): void {
    bb.activePointers.delete(e.pointerId);
    if (e.pointerType === 'pen') bb.usePressure = false;
    if (bb.longPressTimer) { clearTimeout(bb.longPressTimer); bb.longPressTimer = null; }
    bb.longPressStart = null;

    if (bb.activePointerId !== null && bb.activePointerId !== e.pointerId) return;
    bb.activePointerId = null;
    bb.activePointerType = 'mouse';

    if (bb.isPanning) {
      bb.isPanning = false;
      return;
    }

    if (bb.activeTool === 'select' && bb.dragState) {
      bb.alignmentGuides = {};
      bb.dragState = null;
      bb.emit('change');
      return;
    }

    if (bb.activeTool === 'select' && bb.marqueeStart && bb.marqueeEnd) {
      const mx = Math.min(bb.marqueeStart.x, bb.marqueeEnd.x);
      const my = Math.min(bb.marqueeStart.y, bb.marqueeEnd.y);
      const mw = Math.abs(bb.marqueeEnd.x - bb.marqueeStart.x);
      const mh = Math.abs(bb.marqueeEnd.y - bb.marqueeStart.y);
      if (mw > 2 / bb.camera.zoom || mh > 2 / bb.camera.zoom) {
        for (const el of bb.elements) {
          const b = bb.getElementBounds(el);
          if (b.x >= mx && b.y >= my && b.x + b.w <= mx + mw && b.y + b.h <= my + mh) {
            bb.selectedIds.add(el.id);
          }
        }
      }
      bb.marqueeStart = null;
      bb.marqueeEnd = null;
      bb.renderAll();
      return;
    }
    bb.marqueeStart = null;
    bb.marqueeEnd = null;

    if (bb.activeTool === 'eraser' && bb.isDrawing) {
      if (bb.pixelEraser && bb.currentElement) {
        bb.isDrawing = false;
        if ((bb.currentElement as Stroke).points.length < 2) {
          const p = (bb.currentElement as Stroke).points[0];
          (bb.currentElement as Stroke).points = [
            { x: p.x, y: p.y, pressure: 0.5 },
            { x: p.x + 0.5, y: p.y + 0.5, pressure: 0.5 },
          ];
      } else {
        (bb.currentElement as Stroke).points = bb.downsampleStroke((bb.currentElement as Stroke).points, 2);
      }
    bb.pushUndo();
    bb.elements.push(bb.currentElement);
      bb.currentElement = null;
      bb.flushLive();
      bb.renderStatic();
      bb.updateToolbar();
      bb.emit('change');
      return;
    }
    bb.isDrawing = false;
    bb.lastPointerWorld = null;
    bb.renderAll();
    bb.updateToolbar();
    return;
  }

  if (!bb.isDrawing || !bb.currentElement) return;
  bb.isDrawing = false;

  if (bb.currentElement.tool === 'laser') {
    const laser = bb.currentElement as Stroke;
    if (laser.points.length >= 2) {
      bb.laserStrokes.push({
        id: laser.id,
        points: [...laser.points],
        color: laser.color,
        width: laser.width,
        opacity: 1,
        createdAt: Date.now(),
      });
      if (!bb.laserAnimFrame) bb.laserAnimFrame = requestAnimationFrame(bb.animateLaser);
    }
    bb.currentElement = null;
    return;
  }

  if (bb.currentElement.tool === 'pen' || bb.currentElement.tool === 'highlighter') {
    if ((bb.currentElement as Stroke).points.length < 2) {
      const p = (bb.currentElement as Stroke).points[0];
      (bb.currentElement as Stroke).points = [
        { x: p.x, y: p.y, pressure: 0.5 },
        { x: p.x + 0.5, y: p.y + 0.5, pressure: 0.5 },
      ];
    } else {
      (bb.currentElement as Stroke).points = bb.downsampleStroke((bb.currentElement as Stroke).points, 2);
    }
    }

    bb.pushUndo();
    bb.elements.push(bb.currentElement);
    if (bb.currentElement.tool === 'arrow' || bb.currentElement.tool === 'line') {
      bb.autoBindArrow(bb.currentElement as any);
    }
    bb.currentElement = null;
    bb.flushLive();
    bb.renderStatic();
    bb.updateToolbar();
    bb.emit('change');
}