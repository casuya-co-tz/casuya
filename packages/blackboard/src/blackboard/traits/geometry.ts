import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const GeometryMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class GeometryTrait extends Base {
screenToWorld(screenX: number, screenY: number): Point {
    return { x: screenX / this.camera.zoom + this.camera.x, y: screenY / this.camera.zoom + this.camera.y };
  }

worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.camera.x) * this.camera.zoom, y: (wy - this.camera.y) * this.camera.zoom };
  }

findNearestConnectionPoint(point: Point, excludeId?: string): Point | null {
    let bestDist = 30 / this.camera.zoom;
    let bestPoint: Point | null = null;
    for (const el of this.elements) {
      if (el.id === excludeId) continue;
      const bounds = this.getElementBounds(el);
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const dist = Math.hypot(point.x - cx, point.y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = { x: cx, y: cy };
      }
    }
    return bestPoint;
  }

findNearestEdgePoint(point: Point, excludeId?: string): Point | null {
    let bestDist = 30 / this.camera.zoom;
    let bestPoint: Point | null = null;
    for (const el of this.elements) {
      if (el.id === excludeId) continue;
      if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'laser') continue;
      const bounds = this.getElementBounds(el);
      const rx = bounds.x;
      const ry = bounds.y;
      const rw = bounds.w;
      const rh = bounds.h;
      if (rw <= 0 && rh <= 0) continue;
      const candidates: Point[] = [];
      if (rw > 0) {
        candidates.push({ x: rx, y: this.clamp(point.y, ry, ry + rh) });
        candidates.push({ x: rx + rw, y: this.clamp(point.y, ry, ry + rh) });
      }
      if (rh > 0) {
        candidates.push({ x: this.clamp(point.x, rx, rx + rw), y: ry });
        candidates.push({ x: this.clamp(point.x, rx, rx + rw), y: ry + rh });
      }
      for (const c of candidates) {
        const dist = Math.hypot(point.x - c.x, point.y - c.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestPoint = c;
        }
      }
    }
    return bestPoint;
  }

hitTest(worldPoint: Point): Element | null {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      const rotation = el.rotation ?? 0;
      if ((el.tool === 'pen' || el.tool === 'highlighter' || el.tool === 'eraser') && 'points' in el) {
        const hitDist = Math.max(el.width * 2, 10) / this.camera.zoom;
        const center = this.getRotationCenter(el);
        const testPoint = rotation !== 0 ? this.rotatePoint(worldPoint, center, -rotation) : worldPoint;
        const hit = (el as Stroke).points.some(
          p => Math.hypot(p.x - testPoint.x, p.y - testPoint.y) < hitDist
        );
        if (hit) return el;
        continue;
      }
      const bounds = this.getElementBounds(el);
      const pad = (IS_MOBILE() ? 12 : 8) / this.camera.zoom;
      if (
        worldPoint.x >= bounds.x - pad &&
        worldPoint.x <= bounds.x + bounds.w + pad &&
        worldPoint.y >= bounds.y - pad &&
        worldPoint.y <= bounds.y + bounds.h + pad
      ) {
        return el;
      }
    }
    return null;
  }

getHandleAtPoint(worldPoint: Point): string | null {
    if (this.selectedIds.size !== 1) return null;
    const id = this.selectedIds.values().next().value!;
    const el = this.elements.find(e => e.id === id);
    if (!el) return null;
    const bounds = this.getElementBounds(el);
    const local = this.getLocalBounds(el);
    const rotation = el.rotation ?? 0;
    const pad = 6 / this.camera.zoom;
    const handleSize = (IS_MOBILE() ? 14 : 10) / this.camera.zoom;

    let handleDefs: Record<string, Point>;
    if (rotation !== 0) {
      const corners = this.getRotatedCorners({ x: local.x - pad, y: local.y - pad, w: local.w + pad * 2, h: local.h + pad * 2 }, rotation);
      handleDefs = {
        'nw': corners[0],
        'ne': corners[1],
        'se': corners[2],
        'sw': corners[3],
        'n': { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
        'e': { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
        's': { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
        'w': { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 },
      };
    } else {
      handleDefs = {
        'nw': { x: bounds.x - pad, y: bounds.y - pad },
        'n':  { x: bounds.x + bounds.w / 2, y: bounds.y - pad },
        'ne': { x: bounds.x + bounds.w + pad, y: bounds.y - pad },
        'e':  { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h / 2 },
        'se': { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad },
        's':  { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h + pad },
        'sw': { x: bounds.x - pad, y: bounds.y + bounds.h + pad },
        'w':  { x: bounds.x - pad, y: bounds.y + bounds.h / 2 },
      };
    }
    for (const [name, pos] of Object.entries(handleDefs)) {
      if (Math.abs(worldPoint.x - pos.x) < handleSize && Math.abs(worldPoint.y - pos.y) < handleSize) {
        return name;
      }
    }
    const rotatePos = this.getRotateHandlePos();
    if (rotatePos && Math.abs(worldPoint.x - rotatePos.x) < handleSize * 1.5 && Math.abs(worldPoint.y - rotatePos.y) < handleSize * 1.5) {
      return 'rotate';
    }
    return null;
  }

getElementBounds(el: Element): { x: number; y: number; w: number; h: number } {
    const local = this.getLocalBounds(el);
    const rotation = el.rotation ?? 0;
    if (rotation === 0) return local;
    const corners = this.getRotatedCorners(local, rotation);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of corners) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

getLocalBounds(el: Element): { x: number; y: number; w: number; h: number } {
    if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'laser') {
      const stroke = el as Stroke;
      if (stroke.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (el.tool === 'text') {
      const t = el as TextElement;
      const ctx = this.staticCtx;
      ctx.font = `${t.fontSize}px ${t.fontFamily}`;
      const lines = t.content.split('\n');
      const lineHeight = t.fontSize * 1.4;
      let maxW = 0;
      for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
      return { x: t.position.x, y: t.position.y, w: Math.max(maxW, 20), h: Math.max(lines.length * lineHeight, t.fontSize) };
    }
    if (el.tool === 'image') {
      const img = el as ImageElement;
      return { x: img.position.x, y: img.position.y, w: img.width, h: img.height };
    }
    if (el.tool === 'katex') {
      const k = el as LaTeXElement;
      return { x: k.position.x, y: k.position.y, w: k.width ?? 200, h: k.height ?? 40 };
    }
    const s = el as Shape;
    const x = Math.min(s.start.x, s.end.x);
    const y = Math.min(s.start.y, s.end.y);
    return { x, y, w: Math.abs(s.end.x - s.start.x), h: Math.abs(s.end.y - s.start.y) };
  }

updateBoundArrows(): void {
    for (const el of this.elements) {
      if (el.tool !== 'arrow' && el.tool !== 'line') continue;
      const shape = el as Shape;
      if (!shape.boundTo) continue;
      const target = this.elements.find(e => e.id === shape.boundTo);
      if (!target) { shape.boundTo = undefined; continue; }
      const tb = this.getElementBounds(target);
      const cx = tb.x + tb.w / 2;
      const cy = tb.y + tb.h / 2;
      const arrowMid = Math.hypot(shape.start.x - cx, shape.start.y - cy);
      const arrowEnd = Math.hypot(shape.end.x - cx, shape.end.y - cy);
      if (arrowMid < arrowEnd) {
        const edge = this.findNearestEdgePoint(shape.start, shape.id) ?? shape.start;
        const targetEdge = this.findShapeEdgeForPoint(target, edge);
        if (targetEdge) shape.start = targetEdge;
      } else {
        const edge = this.findNearestEdgePoint(shape.end, shape.id) ?? shape.end;
        const targetEdge = this.findShapeEdgeForPoint(target, edge);
        if (targetEdge) shape.end = targetEdge;
      }
    }
  }

};
