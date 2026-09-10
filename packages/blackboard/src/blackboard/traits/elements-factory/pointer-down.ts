import type { TextElement } from '../../../types';
import type { BlackboardBase } from '../../base';
import { createEraserStroke, createHighlighterStroke, createLaserStroke, createPenStroke, createShapeElement } from './factories';

export function handlePointerDown(bb: BlackboardBase, e: PointerEvent): void {
    bb.dismissContextMenu();

    bb.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (bb.activePointers.size === 2) {
      if (bb.isDrawing) {
        bb.isDrawing = false;
        bb.currentElement = null;
        bb.flushLive();
      }
      bb.startPinch();
      return;
    }
    if (bb.activePointers.size > 2) {
      return;
    }

    if (bb.activePointerId !== null && bb.activePointerId !== e.pointerId) {
      if (e.pointerType === 'pen' && bb.activePointerType === 'touch') {
        bb.releasePointerCapture();
      } else {
        return;
      }
    }

    if (e.pointerType === 'touch' && bb.activePointerType === 'pen' && bb.isDrawing) {
      return;
    }

    e.preventDefault();
    try { bb.liveCanvas.setPointerCapture(e.pointerId); } catch {}
    bb.activePointerId = e.pointerId;
    bb.activePointerType = e.pointerType;

    const point = bb.getPoint(e);

    if (e.pointerType === 'touch' && bb.activeTool === 'select') {
      bb.longPressStart = point;
      bb.longPressTimer = setTimeout(() => {
        if (bb.longPressStart) {
          const hit = bb.hitTest(bb.longPressStart);
          if (hit) {
            if (!bb.selectedIds.has(hit.id)) {
              bb.selectedIds.clear();
              bb.selectedIds.add(hit.id);
              bb.renderAll();
            }
            bb.isDrawing = false;
            bb.currentElement = null;
            bb.showContextMenu(e.clientX, e.clientY);
          }
        }
      }, 500);
    }

    if (bb.activeTool === 'hand' || (bb.isSpaceDown && !bb.isPanning)) {
      bb.isPanning = true;
      bb.panStart = { x: e.clientX, y: e.clientY };
      bb.panCameraStart = { x: bb.camera.x, y: bb.camera.y };
      return;
    }

    if (bb.activeTool === 'select') {
      const handle = bb.getHandleAtPoint(point);
      if (handle === 'rotate') {
        bb.pushUndo();
        bb.dragState = { type: 'rotate', startWorld: point, origElements: JSON.parse(JSON.stringify(bb.elements)) };
        bb.renderAll();
        return;
      }
      if (handle) {
        bb.pushUndo();
        bb.dragState = { type: 'resize', startWorld: point, origElements: JSON.parse(JSON.stringify(bb.elements)), handle };
        bb.renderAll();
        return;
      }
      const hit = bb.hitTest(point);
        if (hit) {
          if (e.shiftKey) {
            if (bb.selectedIds.has(hit.id)) {
              bb.selectedIds.delete(hit.id);
            } else {
              if (hit.groupId) {
                for (const el of bb.elements) {
                  if (el.groupId === hit.groupId) bb.selectedIds.add(el.id);
                }
              } else {
                bb.selectedIds.add(hit.id);
              }
            }
            bb.renderAll();
            return;
          }
          if (!bb.selectedIds.has(hit.id)) {
            bb.selectedIds.clear();
            if (hit.groupId) {
              for (const el of bb.elements) {
                if (el.groupId === hit.groupId) bb.selectedIds.add(el.id);
              }
            } else {
              bb.selectedIds.add(hit.id);
            }
          }
        bb.pushUndo();
        bb.dragState = { type: 'move', startWorld: point, origElements: JSON.parse(JSON.stringify(bb.elements)) };
      } else {
        if (!e.shiftKey) bb.selectedIds.clear();
        bb.marqueeStart = point;
        bb.marqueeEnd = point;
      }
      bb.renderAll();
      return;
    }

    if (bb.activeTool === 'text') {
      const hit = bb.hitTest(point);
      if (hit && hit.tool === 'text') {
        bb.startTextEdit(hit.position.x, hit.position.y, hit as TextElement);
      } else {
        bb.startTextEdit(point.x, point.y);
      }
      return;
    }

    if (bb.activeTool === 'laser') {
      bb.isDrawing = true;
      bb.currentElement = createLaserStroke(point, bb.strokeWidth);
      return;
    }

    if (bb.activeTool === 'eraser') {
      if (bb.pixelEraser) {
        bb.pushUndo();
        bb.isDrawing = true;
        bb.currentElement = createEraserStroke(point, bb.strokeWidth * 3);
        return;
      }
      bb.pushUndo();
      bb.isDrawing = true;
      bb.lastPointerWorld = point;
      bb.renderAll();
      return;
    }

    bb.isDrawing = true;

    if (e.pointerType === 'pen') bb.usePressure = true;

    if (bb.activeTool === 'pen' || bb.activeTool === 'highlighter') {
      bb.currentElement = bb.activeTool === 'highlighter'
        ? createHighlighterStroke(point, bb.strokeWidth * 3, bb.strokeColor)
        : createPenStroke(point, bb.strokeWidth, bb.strokeColor, bb.strokeOpacity);
    } else {
      const snapped = bb.snapToGrid(point);
      bb.currentElement = createShapeElement(snapped, {
        tool: bb.activeTool,
        color: bb.strokeColor,
        width: bb.strokeWidth,
        opacity: bb.strokeOpacity,
        filled: bb.fillEnabled,
        roughness: bb.roughness,
        dashPattern: bb.dashEnabled ? [8, 4] : undefined,
        cornerRadius: bb.cornerRadius,
      });
    }
}