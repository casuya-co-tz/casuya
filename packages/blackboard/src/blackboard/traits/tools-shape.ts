import type { Point, Stroke, Shape, TextElement, ImageElement, Element } from '../../types';
import { uid } from '../../utils';
import { BlackboardBase, Constructor } from '../base';
import { getRotatedCornersOf, rotatePointAbout } from './tools-shape/geometry';
import { resizeSelected as applyResizeSelected } from './tools-shape/resize';
import { duplicateSelected as runDuplicateSelected, nudgeSelected as runNudgeSelected, rotateSelected as runRotateSelected } from './tools-shape/selection-ops';

export const ToolsShapeMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class ToolsShapeTrait extends Base {
getRotateHandlePos(): Point | null {
    if (this.selectedIds.size !== 1) return null;
    const id = this.selectedIds.values().next().value!;
    const el = this.elements.find(e => e.id === id);
    if (!el) return null;
    const bounds = this.getElementBounds(el);
    const rotation = el.rotation ?? 0;
    const pad = 6 / this.camera.zoom;
    const topCenter = { x: bounds.x + bounds.w / 2, y: bounds.y - pad };
    if (rotation !== 0) {
      const center = this.getRotationCenter(el);
      return this.rotatePoint(topCenter, center, rotation);
    }
    return topCenter;
  }

rotatePoint(point: Point, center: Point, angle: number): Point {
    return rotatePointAbout(point, center, angle);
  }

getRotatedCorners(bounds: { x: number; y: number; w: number; h: number }, rotation: number): Point[] {
    return getRotatedCornersOf(bounds, rotation);
  }

moveSelectedElements(dx: number, dy: number): void {
    if (!this.dragState) return;
    const origMap = new Map(this.dragState.origElements.map(e => [e.id, e]));
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      const orig = origMap.get(id);
      if (!el || !orig) continue;
      this.moveSingleElement(el, orig, dx, dy);
    }
    this.updateBoundArrows();
  }

findShapeEdgeForPoint(el: Element, point: Point): Point | null {
    const b = this.getElementBounds(el);
    if (b.w <= 0 && b.h <= 0) return null;
    const candidates: Point[] = [];
    if (b.w > 0) {
      candidates.push({ x: b.x, y: this.clamp(point.y, b.y, b.y + b.h) });
      candidates.push({ x: b.x + b.w, y: this.clamp(point.y, b.y, b.y + b.h) });
    }
    if (b.h > 0) {
      candidates.push({ x: this.clamp(point.x, b.x, b.x + b.w), y: b.y });
      candidates.push({ x: this.clamp(point.x, b.x, b.x + b.w), y: b.y + b.h });
    }
    let best = candidates[0], bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(point.x - c.x, point.y - c.y);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  }

resizeSelected(handle: string, currentWorld: Point): void {
    applyResizeSelected(this, handle, currentWorld);
  }

nudgeSelected(dx: number, dy: number): void {
    runNudgeSelected(this, dx, dy);
  }

duplicateSelected(): void {
    runDuplicateSelected(this);
  }

rotateSelected(angle: number): void {
    runRotateSelected(this, angle);
  }

getSelectedRotation(): number {
    if (this.selectedIds.size !== 1) return 0;
    const id = this.selectedIds.values().next().value!;
    const el = this.elements.find(e => e.id === id);
    return el ? (el.rotation ?? 0) : 0;
  }

applyStyleToSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (!el) continue;
      if (el.tool !== 'image') (el as any).color = this.strokeColor;
      el.opacity = this.strokeOpacity;
      if ('width' in el && el.tool !== 'text') (el as any).width = this.strokeWidth;
      if ('filled' in el) (el as any).filled = this.fillEnabled;
      if ('roughness' in el) (el as any).roughness = this.roughness;
    }
    this.renderAll();
    this.emit('change');
  }

groupSelected(): void {
    if (this.selectedIds.size < 2) return;
    this.pushUndo();
    const groupId = uid();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (el) el.groupId = groupId;
    }
    this.renderAll();
    this.emit('change');
  }

ungroupSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (el) el.groupId = undefined;
    }
    this.renderAll();
    this.emit('change');
  }

selectAll(): void {
    this.selectedIds = new Set(this.elements.map(el => el.id));
    this.renderAll();
    this.emit('change');
  }
};