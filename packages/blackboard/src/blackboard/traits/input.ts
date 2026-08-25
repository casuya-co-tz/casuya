import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const InputMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class InputTrait extends Base {
attachEvents(): void {
    this.liveCanvas.addEventListener('pointerdown', this.onPointerDown);
    this.liveCanvas.addEventListener('pointermove', this.onPointerMove);
    this.liveCanvas.addEventListener('pointerup', this.onPointerUp);
    this.liveCanvas.addEventListener('pointerleave', this.onPointerUp);
    this.liveCanvas.addEventListener('pointercancel', this.onPointerUp);
    this.liveCanvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.liveCanvas.addEventListener('contextmenu', this.onContextMenu);
    this.liveCanvas.addEventListener('dblclick', this.onDoubleClick);
    this.liveCanvas.addEventListener('dragover', this.boundHandleDragOver);
    this.liveCanvas.addEventListener('drop', this.boundHandleFileDrop);
    window.addEventListener('paste', this.boundHandleImagePaste);
    window.addEventListener('click', this.onWindowClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('scroll', this.onScrollDismiss, { capture: true, passive: true });
    window.addEventListener('resize', this.onResizeDismiss);
  }

detachEvents(): void {
    this.liveCanvas.removeEventListener('pointerdown', this.onPointerDown);
    this.liveCanvas.removeEventListener('pointermove', this.onPointerMove);
    this.liveCanvas.removeEventListener('pointerup', this.onPointerUp);
    this.liveCanvas.removeEventListener('pointerleave', this.onPointerUp);
    this.liveCanvas.removeEventListener('pointercancel', this.onPointerUp);
    this.liveCanvas.removeEventListener('wheel', this.onWheel);
    this.liveCanvas.removeEventListener('contextmenu', this.onContextMenu);
    this.liveCanvas.removeEventListener('dblclick', this.onDoubleClick);
    this.liveCanvas.removeEventListener('dragover', this.boundHandleDragOver);
    this.liveCanvas.removeEventListener('drop', this.boundHandleFileDrop);
    window.removeEventListener('paste', this.boundHandleImagePaste);
    window.removeEventListener('click', this.onWindowClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('scroll', this.onScrollDismiss);
    window.removeEventListener('resize', this.onResizeDismiss);
  }

autoBindArrow(shape: Shape): void {
    const edge = this.findNearestEdgePoint(shape.start, shape.id);
    if (edge) {
      const target = this.elements.find(e => {
        if (e.id === shape.id) return false;
        const b = this.getElementBounds(e);
        return Math.hypot(edge.x - (b.x + b.w / 2), edge.y - (b.y + b.h / 2)) < Math.max(b.w, b.h);
      });
      if (target) {
        shape.boundTo = target.id;
        shape.start = edge;
      }
    }
    const edgeEnd = this.findNearestEdgePoint(shape.end, shape.id);
    if (edgeEnd) {
      const target = this.elements.find(e => {
        if (e.id === shape.id) return false;
        const b = this.getElementBounds(e);
        return Math.hypot(edgeEnd.x - (b.x + b.w / 2), edgeEnd.y - (b.y + b.h / 2)) < Math.max(b.w, b.h);
      });
      if (target) {
        if (!shape.boundTo) shape.boundTo = target.id;
        shape.end = edgeEnd;
      }
    }
  }

startPinch(): void {
    const pts = Array.from(this.activePointers.values());
    this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    this.pinchStartZoom = this.camera.zoom;
    this.pinchStartCamera = { x: this.camera.x, y: this.camera.y };
    const rect = this.liveCanvas.getBoundingClientRect();
    this.pinchCenter = {
      x: (pts[0].x + pts[1].x) / 2 - rect.left,
      y: (pts[0].y + pts[1].y) / 2 - rect.top,
    };
  }

releasePointerCapture(): void {
    if (this.activePointerId !== null) {
      try { this.liveCanvas.releasePointerCapture(this.activePointerId); } catch {}
      const upEvt = new PointerEvent('pointerup', { pointerId: this.activePointerId });
      this.onPointerUp(upEvt);
    }
  }

getZoom(): number { return this.camera.zoom; }

zoomTo(level: number, center?: Point): void {
    const cx = center?.x ?? (this.width / 2);
    const cy = center?.y ?? (this.height / 2);
    const worldBefore = this.screenToWorld(cx, cy);
    this.camera.zoom = Math.max(0.1, Math.min(10, level));
    const worldAfter = this.screenToWorld(cx, cy);
    this.camera.x += worldBefore.x - worldAfter.x;
    this.camera.y += worldBefore.y - worldAfter.y;
    this.renderAll();
    this.updateToolbar();
  }

handleDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

};
