import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const UndoRedoMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class UndoRedoTrait extends Base {
pushUndo(): void {
    const snapshot = this.elements.map(el => {
      if (el.tool === 'image') {
        const img = el as ImageElement;
        let idx = this.imageSrcToIdx.get(img.src);
        if (idx === undefined) {
          idx = this.imagePool.length;
          this.imagePool.push(img.src);
          this.imageSrcToIdx.set(img.src, idx);
        }
        return { ...img, src: `__img:${idx}` };
      }
      return JSON.parse(JSON.stringify(el));
    });
    this.undoStack.push(snapshot);
    if (this.undoStack.length > BlackboardBase.MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

downsampleStroke(points: Point[], minDist: number): Point[] {
    if (points.length < 2) return [...points];
    const result: Point[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = result[result.length - 1];
      const p = points[i];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) {
        result.push(p);
      }
    }
    if (result.length < 2 && points.length >= 2) {
      result.push(points[points.length - 1]);
    }
    return result;
  }

undo(): void {
    if (this.undoStack.length === 0) return;
    const currentSnapshot = this.elements.map(el => {
      if (el.tool === 'image') {
        const img = el as ImageElement;
        let idx = this.imageSrcToIdx.get(img.src);
        if (idx === undefined) { idx = this.imagePool.length; this.imagePool.push(img.src); this.imageSrcToIdx.set(img.src, idx); }
        return { ...img, src: `__img:${idx}` };
      }
      return JSON.parse(JSON.stringify(el));
    });
    this.redoStack.push(currentSnapshot);
    this.elements = this.resolveSnapshot(this.undoStack.pop()!);
    this.selectedIds.clear();
    this.renderAll();
    this.updateToolbar();
    this.emit('undo');
    this.emit('change');
  }

redo(): void {
    if (this.redoStack.length === 0) return;
    const currentSnapshot = this.elements.map(el => {
      if (el.tool === 'image') {
        const img = el as ImageElement;
        let idx = this.imageSrcToIdx.get(img.src);
        if (idx === undefined) { idx = this.imagePool.length; this.imagePool.push(img.src); this.imageSrcToIdx.set(img.src, idx); }
        return { ...img, src: `__img:${idx}` };
      }
      return JSON.parse(JSON.stringify(el));
    });
    this.undoStack.push(currentSnapshot);
    this.elements = this.resolveSnapshot(this.redoStack.pop()!);
    this.selectedIds.clear();
    this.renderAll();
    this.updateToolbar();
    this.emit('redo');
    this.emit('change');
  }

cleanImagePool(): void {
    const used = new Set<string>();
    const collectFromElements = (els: Element[]) => {
      for (const el of els) {
        if (el.tool === 'image') {
          const src = (el as ImageElement).src;
          if (src.startsWith('__img:')) used.add(src);
        }
      }
    };
    collectFromElements(this.elements);
    for (const snap of this.undoStack) collectFromElements(snap);
    for (const snap of this.redoStack) collectFromElements(snap);
    if (used.size === 0) {
      this.imagePool = [];
      this.imageSrcToIdx.clear();
      return;
    }
    const newPool: string[] = [];
    const newMap = new Map<string, number>();
    for (let i = 0; i < this.imagePool.length; i++) {
      const ref = `__img:${i}`;
      if (used.has(ref)) {
        const idx = newPool.length;
        newPool.push(this.imagePool[i]);
        newMap.set(this.imagePool[i], idx);
      }
    }
    const remap = (els: Element[]) => {
      for (const el of els) {
        if (el.tool === 'image') {
          const img = el as ImageElement;
          if (img.src.startsWith('__img:')) {
            const oldIdx = parseInt(img.src.slice(6));
            const realSrc = this.imagePool[oldIdx];
            if (realSrc !== undefined) {
              const newIdx = newMap.get(realSrc);
              if (newIdx !== undefined) img.src = `__img:${newIdx}`;
            }
          }
        }
      }
    };
    remap(this.elements);
    for (const snap of this.undoStack) remap(snap);
    for (const snap of this.redoStack) remap(snap);
    this.imagePool = newPool;
    this.imageSrcToIdx = newMap;
  }
};
