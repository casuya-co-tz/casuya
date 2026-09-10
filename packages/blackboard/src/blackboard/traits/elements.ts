import type { Element, Point, Stroke, TextElement } from '../../types';
import { IS_MOBILE } from '../../utils';
import { BlackboardBase, Constructor } from '../base';
import { handlePointerDown, handlePointerUp } from './elements-factory';

export const ElementsMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class ElementsTrait extends Base {
elements: Element[] = [];

undoStack: Element[][] = [];

redoStack: Element[][] = [];

currentElement: Element | null = null;

isDrawing = false;

dirty = false;

animFrameId: number | null = null;

selectedIds: Set<string> = new Set();

dragState: { type: 'move' | 'resize' | 'rotate'; startWorld: Point; origElements: Element[]; handle?: string } | null = null;

clipboard: Element[] = [];

clipboardData = '';

textInput: HTMLTextAreaElement | null = null;

editingTextId: string | null = null;

editingTextOriginal: TextElement | null = null;

editingShapeId: string | null = null;

lastPointerWorld: Point | null = null;

marqueeStart: Point | null = null;

marqueeEnd: Point | null = null;

laserStrokes: { id: string; points: Point[]; color: string; width: number; opacity: number; createdAt: number }[] = [];

laserAnimFrame: number | null = null;

imagePool: string[] = [];

imageSrcToIdx = new Map<string, number>();

imageCache = new Map<string, HTMLImageElement>();

katexImageCache = new Map<string, HTMLImageElement>();

alignmentGuides: { x?: number; y?: number } = {};

onPointerDown = (e: PointerEvent): void => {
    handlePointerDown(this, e);
  };

onPointerMove = (e: PointerEvent): void => {
    if (this.longPressTimer && this.longPressStart) {
      const dx = e.clientX - this.longPressStart.x;
      const dy = e.clientY - this.longPressStart.y;
      if (Math.hypot(dx, dy) > 10) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.longPressStart = null;
      }
    }
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    }
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = this.liveCanvas.getBoundingClientRect();
      const curCenter = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
      if (this.pinchStartDist > 0) {
        const newZoom = this.pinchStartZoom * (dist / this.pinchStartDist);
        this.zoomTo(newZoom, this.pinchCenter);
        const panDx = (curCenter.x - this.pinchCenter.x) / this.camera.zoom;
        const panDy = (curCenter.y - this.pinchCenter.y) / this.camera.zoom;
        this.camera.x = this.pinchStartCamera.x - panDx;
        this.camera.y = this.pinchStartCamera.y - panDy;
        this.graphDirty = true;
        this.renderAll();
        this.updateToolbar();
      }
      return;
    }

    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;

    if (this.isPanning) {
      const dx = (e.clientX - this.panStart.x) / this.camera.zoom;
      const dy = (e.clientY - this.panStart.y) / this.camera.zoom;
      this.camera.x = this.panCameraStart.x - dx;
      this.camera.y = this.panCameraStart.y - dy;
      this.graphDirty = true;
      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.dragState?.type === 'rotate') {
      const point = this.getPoint(e);
      const id = this.selectedIds.values().next().value!;
      const el = this.elements.find(e => e.id === id);
      if (el) {
        const center = this.getRotationCenter(el);
        const origAngle = Math.atan2(this.dragState.startWorld.y - center.y, this.dragState.startWorld.x - center.x);
        const curAngle = Math.atan2(point.y - center.y, point.x - center.x);
        const deltaAngle = curAngle - origAngle;
        const origEl = this.dragState.origElements.find(e => e.id === id);
        if (origEl) {
          el.rotation = ((origEl.rotation ?? 0) + deltaAngle) % (Math.PI * 2);
        }
      }
      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.dragState?.type === 'resize') {
      const point = this.getPoint(e);
      this.resizeSelected(this.dragState.handle!, point);
      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.dragState?.type === 'move') {
      const point = this.getPoint(e);
      const dx = point.x - this.dragState.startWorld.x;
      const dy = point.y - this.dragState.startWorld.y;
      this.moveSelectedElements(dx, dy);

      let combinedBounds = { x: Infinity, y: Infinity, w: 0, h: 0 };
      let hasBounds = false;
      for (const id of this.selectedIds) {
        const el = this.elements.find(e => e.id === id);
        if (!el) continue;
        const b = this.getElementBounds(el);
        if (!hasBounds) {
          combinedBounds = { x: b.x, y: b.y, w: b.w, h: b.h };
          hasBounds = true;
        } else {
          const nx = Math.min(combinedBounds.x, b.x);
          const ny = Math.min(combinedBounds.y, b.y);
          combinedBounds = {
            x: nx, y: ny,
            w: Math.max(combinedBounds.x + combinedBounds.w, b.x + b.w) - nx,
            h: Math.max(combinedBounds.y + combinedBounds.h, b.y + b.h) - ny,
          };
        }
      }
      if (hasBounds) {
        this.alignmentGuides = this.findAlignmentGuides(combinedBounds);
      }

      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.marqueeStart) {
      this.marqueeEnd = this.getPoint(e);
      this.renderAll();
      return;
    }

    if (this.activeTool === 'eraser' && this.isDrawing) {
      if (this.pixelEraser && this.currentElement) {
        const events = (e as any).getCoalescedEvents?.() ?? [e];
        for (const ce of events) {
          const p = this.getPoint(ce as PointerEvent);
          const pts = (this.currentElement as Stroke).points;
          const last = pts[pts.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
            pts.push(p);
          }
        }
        this.dirty = true;
        if (!this.animFrameId) this.animFrameId = requestAnimationFrame(this.flush);
        return;
      }
      const point = this.getPoint(e);
      this.lastPointerWorld = point;
      const hitDist = IS_MOBILE() ? this.strokeWidth * 3.5 : this.strokeWidth * 2.5;
      const toRemove: string[] = [];
      for (const el of this.elements) {
        if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
          const stroke = el as Stroke;
          const rotation = (stroke as any).rotation ?? 0;
          const center = this.getRotationCenter(stroke);
          const localPoint = rotation !== 0 ? this.rotatePoint(point, center, -rotation) : point;
          const hit = stroke.points.some(p => Math.hypot(p.x - localPoint.x, p.y - localPoint.y) < hitDist);
          if (hit) toRemove.push(el.id);
        } else {
          const bounds = this.getElementBounds(el);
          const pad = hitDist;
          if (point.x >= bounds.x - pad && point.x <= bounds.x + bounds.w + pad &&
              point.y >= bounds.y - pad && point.y <= bounds.y + bounds.h + pad) {
            toRemove.push(el.id);
          }
        }
      }
      if (toRemove.length > 0) {
        const kill = new Set(toRemove);
        this.elements = this.elements.filter(e => !kill.has(e.id));
        this.renderStatic();
        this.emit('change');
      }
      this.dirty = true;
      if (!this.animFrameId) this.animFrameId = requestAnimationFrame(this.flush);
      return;
    }

    if (!this.isDrawing || !this.currentElement) return;
    e.preventDefault();

    if (this.currentElement.tool === 'pen' || this.currentElement.tool === 'highlighter' || this.currentElement.tool === 'laser') {
      const events = (e as any).getCoalescedEvents?.() ?? [e];
      for (const ce of events) {
        const p = this.getPoint(ce as PointerEvent);
        const pts = this.currentElement.points;
        const last = pts[pts.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
          pts.push(p);
        }
      }
    } else {
      const point = this.getPoint(e);
      const shape = this.currentElement as any;
      let endPoint = this.snapToGrid(point);
      if (shape.tool === 'arrow') {
        const conn = this.findNearestEdgePoint(endPoint, this.currentElement?.id);
        if (conn) endPoint = conn;
      }
      shape.end = endPoint;

      if (e.shiftKey && 'start' in this.currentElement) {
        const dx = shape.end.x - shape.start.x;
        const dy = shape.end.y - shape.start.y;
        if (shape.tool === 'rect' || shape.tool === 'diamond') {
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          shape.end = { x: shape.start.x + size * Math.sign(dx || 1), y: shape.start.y + size * Math.sign(dy || 1) };
        } else if (shape.tool === 'circle') {
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          shape.end = { x: shape.start.x + size * Math.sign(dx || 1), y: shape.start.y + size * Math.sign(dy || 1) };
        } else if (shape.tool === 'line' || shape.tool === 'arrow') {
          const angle = Math.atan2(dy, dx);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          shape.end = { x: shape.start.x + len * Math.cos(snapped), y: shape.start.y + len * Math.sin(snapped) };
        }
      }
    }

    this.dirty = true;
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(this.flush);
    }
  };

onPointerUp = (e: PointerEvent): void => {
    handlePointerUp(this, e);
  };

flush = (): void => {
    this.animFrameId = null;
    if (!this.dirty) return;
    this.dirty = false;
    this.flushLive();
  };
};