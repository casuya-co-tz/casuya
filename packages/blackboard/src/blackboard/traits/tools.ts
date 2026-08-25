import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const ToolsMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class ToolsTrait extends Base {
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
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
  }

getRotatedCorners(bounds: { x: number; y: number; w: number; h: number }, rotation: number): Point[] {
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      { x: bounds.x, y: bounds.y + bounds.h },
    ];
    return corners.map(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    });
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
    if (!this.dragState) return;
    const origMap = new Map(this.dragState.origElements.map(e => [e.id, e]));
    const rawDx = currentWorld.x - this.dragState.startWorld.x;
    const rawDy = currentWorld.y - this.dragState.startWorld.y;

    if (this.selectedIds.size === 1) {
      const id = this.selectedIds.values().next().value!;
      const el = this.elements.find(e => e.id === id);
      const orig = origMap.get(id);
      if (!el || !orig) return;
      const rotation = el.rotation ?? 0;
      let dx = rawDx, dy = rawDy;
      if (rotation !== 0) {
        const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
        dx = rawDx * cos - rawDy * sin; dy = rawDx * sin + rawDy * cos;
      }
      if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'text') {
        this.moveSingleElement(el, orig, dx, dy);
        return;
      }
      if (el.tool === 'image') {
        const img = el as ImageElement, o = orig as ImageElement;
        let newX = o.position.x, newY = o.position.y, newW = o.width, newH = o.height;
        if (handle === 'nw') { newX = o.position.x + dx; newY = o.position.y + dy; newW = o.width - dx; newH = o.height - dy; }
        else if (handle === 'ne') { newY = o.position.y + dy; newW = o.width + dx; newH = o.height - dy; }
        else if (handle === 'sw') { newX = o.position.x + dx; newW = o.width - dx; newH = o.height + dy; }
        else if (handle === 'se') { newW = o.width + dx; newH = o.height + dy; }
        else if (handle === 'n') { newY = o.position.y + dy; newH = o.height - dy; }
        else if (handle === 's') { newH = o.height + dy; }
        else if (handle === 'e') { newW = o.width + dx; }
        else if (handle === 'w') { newX = o.position.x + dx; newW = o.width - dx; }
        if (newW > 0 && newH > 0) { img.position = { x: newX, y: newY }; img.width = newW; img.height = newH; }
        return;
      }
      const s = el as Shape, o = orig as Shape;
      let ns = { x: o.start.x, y: o.start.y }, ne = { x: o.end.x, y: o.end.y };
      if (handle === 'nw') { ns.x = o.start.x + dx; ns.y = o.start.y + dy; }
      if (handle === 'ne') { ne.x = o.end.x + dx; ns.y = o.start.y + dy; }
      if (handle === 'sw') { ns.x = o.start.x + dx; ne.y = o.end.y + dy; }
      if (handle === 'se') { ne.x = o.end.x + dx; ne.y = o.end.y + dy; }
      if (handle === 'n') { ns.y = o.start.y + dy; }
      if (handle === 's') { ne.y = o.end.y + dy; }
      if (handle === 'e') { ne.x = o.end.x + dx; }
      if (handle === 'w') { ns.x = o.start.x + dx; }
      if (ns.x > ne.x) { const t = ns.x; ns.x = ne.x; ne.x = t; }
      if (ns.y > ne.y) { const t = ns.y; ns.y = ne.y; ne.y = t; }
      if (Math.abs(ne.x - ns.x) < 5 || Math.abs(ne.y - ns.y) < 5) return;
      s.start = ns; s.end = ne;
      return;
    }

    let origMinX = Infinity, origMinY = Infinity, origMaxX = -Infinity, origMaxY = -Infinity;
    for (const id of this.selectedIds) {
      const orig = origMap.get(id);
      if (!orig) continue;
      const b = this.getLocalBounds(orig);
      if (b.x < origMinX) origMinX = b.x;
      if (b.y < origMinY) origMinY = b.y;
      if (b.x + b.w > origMaxX) origMaxX = b.x + b.w;
      if (b.y + b.h > origMaxY) origMaxY = b.y + b.h;
    }
    if (origMinX === Infinity) return;
    const origW = origMaxX - origMinX, origH = origMaxY - origMinY;
    const origCX = origMinX + origW / 2, origCY = origMinY + origH / 2;
    let scaleX = 1, scaleY = 1;
    if (handle.includes('e') || handle === 'ne' || handle === 'se') scaleX = Math.max(0.1, (origW + rawDx) / origW);
    if (handle.includes('w') || handle === 'nw' || handle === 'sw') scaleX = Math.max(0.1, (origW - rawDx) / origW);
    if (handle === 'n' || handle === 'nw' || handle === 'ne') scaleY = Math.max(0.1, (origH - rawDy) / origH);
    if (handle === 's' || handle === 'sw' || handle === 'se') scaleY = Math.max(0.1, (origH + rawDy) / origH);

    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      const orig = origMap.get(id);
      if (!el || !orig) continue;
      const ob = this.getLocalBounds(orig);
      const newCX = origCX + (ob.x + ob.w / 2 - origCX) * scaleX;
      const newCY = origCY + (ob.y + ob.h / 2 - origCY) * scaleY;
      const newW = ob.w * scaleX;
      const newH = ob.h * scaleY;
      const dx = newCX - (ob.x + ob.w / 2);
      const dy = newCY - (ob.y + ob.h / 2);
      if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'text') {
        this.moveSingleElement(el, orig, dx, dy);
        continue;
      }
      if (el.tool === 'image') {
        const img = el as ImageElement, o = orig as ImageElement;
        const nw = o.width * scaleX, nh = o.height * scaleY;
        if (nw > 0 && nh > 0) { img.position = { x: o.position.x + dx, y: o.position.y + dy }; img.width = nw; img.height = nh; }
        continue;
      }
      const s = el as Shape, o = orig as Shape;
      const ns = { x: o.start.x + dx, y: o.start.y + dy };
      const ne = { x: o.end.x + dx, y: o.end.y + dy };
      s.start = ns; s.end = ne;
    }
  }

deleteSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (el && el.tool === 'image') this.imageCache.delete((el as ImageElement).src);
    }
    this.elements = this.elements.filter(e => !this.selectedIds.has(e.id));
    this.selectedIds.clear();
    this.renderAll();
    this.emit('change');
  }

startTextEdit(worldX: number, worldY: number, existing?: TextElement): void {
    this.commitText();
    this.editingTextOriginal = existing ? JSON.parse(JSON.stringify(existing)) : null;
    const screen = this.worldToScreen(worldX, worldY);
    const ta = document.createElement('textarea');
    const mobile = IS_MOBILE();
    const fontSize = existing?.fontSize ?? this.fontSize;
    const taFontSize = Math.max(mobile ? 16 : 0, fontSize * this.camera.zoom);
    ta.style.cssText = `
      position: absolute; left: ${screen.x}px; top: ${screen.y}px;
      min-width: ${mobile ? 80 : 60}px; min-height: 28px;
      background: transparent; border: 2px solid ${THEMES[this.theme].selectionColor};
      border-radius: 4px; padding: 4px 6px;
      font-size: ${taFontSize}px;
      font-family: ${existing?.fontFamily ?? this.fontFamily};
      color: ${existing?.color ?? this.strokeColor};
      outline: none; resize: none; overflow: hidden;
      z-index: 10; box-sizing: border-box;
      line-height: 1.4; white-space: pre-wrap;
    `;
    ta.value = existing?.content ?? '';
    ta.addEventListener('blur', () => this.commitText());
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        this.cancelText();
        return;
      }
      ev.stopPropagation();
    });
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      ta.style.width = Math.max(60, ta.scrollWidth + 10) + 'px';
      this.renderTextPreview(ta.value, worldX, worldY, fontSize, existing?.fontFamily ?? this.fontFamily, existing?.color ?? this.strokeColor);
    });
    this.canvasWrapper.appendChild(ta);
    this.textInput = ta;
    this.editingTextId = existing?.id ?? null;
    if (existing) {
      this.pushUndo();
      this.elements = this.elements.filter(e => e.id !== existing.id);
      this.renderStatic();
    }
    setTimeout(() => { ta.focus(); ta.style.height = ta.scrollHeight + 'px'; this.renderTextPreview(ta.value, worldX, worldY, fontSize, existing?.fontFamily ?? this.fontFamily, existing?.color ?? this.strokeColor); }, 0);
  }

cancelText(): void {
    if (!this.textInput) return;
    const ta = this.textInput;
    this.textInput = null;
    ta.remove();
    this.flushLive();
    if (this.editingTextOriginal) {
      this.elements.push(this.editingTextOriginal);
      this.renderStatic();
      this.emit('change');
    }
    this.editingTextId = null;
    this.editingTextOriginal = null;
    this.editingShapeId = null;
  }

commitText(): void {
    if (!this.textInput) return;
    const ta = this.textInput;
    const content = ta.value.trim();
    const orig = this.editingTextOriginal;
    const shapeId = this.editingShapeId;
    this.textInput = null;
    ta.remove();
    this.editingTextOriginal = null;
    this.editingShapeId = null;
    this.flushLive();
    if (content) {
      const screenX = parseFloat(ta.style.left);
      const screenY = parseFloat(ta.style.top);
      const world = this.screenToWorld(screenX, screenY);
      const el: TextElement = {
        id: this.editingTextId ?? uid(),
        tool: 'text',
        position: world,
        content,
        fontSize: orig?.fontSize ?? this.fontSize,
        fontFamily: orig?.fontFamily ?? this.fontFamily,
        color: orig?.color ?? ta.style.color,
        width: orig?.width ?? 1,
        opacity: orig?.opacity ?? this.strokeOpacity,
      };
      this.pushUndo();
      this.elements.push(el);
      if (shapeId) {
        const shape = this.elements.find(e => e.id === shapeId) as Shape | undefined;
        if (shape) shape.label = content;
      }
      this.renderStatic();
      this.emit('change');
    }
    this.editingTextId = null;
  }

setTool(tool: Tool): void {
    this.commitText();
    this.activeTool = tool;
    let cursor = 'crosshair';
    if (tool === 'select') cursor = 'default';
    else if (tool === 'hand') cursor = 'grab';
    else if (tool === 'text') cursor = 'text';
    else if (tool === 'eraser') cursor = 'cell';
    else if (tool === 'highlighter') cursor = 'crosshair';
    else if (tool === 'laser') cursor = 'none';
    else if (tool === 'diamond') cursor = 'crosshair';
    this.liveCanvas.style.cursor = cursor;
    this.updateToolbar();
    this.emit('toolchange');
  }

getTool(): Tool { return this.activeTool; }

setColor(color: string): void {
    this.strokeColor = color;
    this.updateToolbar();
  }

getColor(): string { return this.strokeColor; }

setFill(enabled: boolean): void {
    this.fillEnabled = enabled;
    this.updateToolbar();
  }

getFill(): boolean { return this.fillEnabled; }

getPixelEraser(): boolean { return this.pixelEraser; }

setPixelEraser(enabled: boolean): void { this.pixelEraser = enabled; this.updateToolbar(); }

getClipboard(): string { return this.clipboardData; }

setClipboard(data: string): void { this.clipboardData = data; }

isGraphEnabled(): boolean { return this.graph.enabled; }

enableGraph(options?: Partial<GraphConfig>): void {
    this.graph = { ...this.graph, ...options, enabled: true };
    this.graphDirty = true;
    this.renderStatic();
  }

disableGraph(): void {
    this.graph.enabled = false;
    this.renderStatic();
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

nudgeSelected(dx: number, dy: number): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (!el) continue;
    if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
        const s = el as Stroke;
        s.points = s.points.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
      } else if (el.tool === 'text') {
        (el as TextElement).position = { x: (el as TextElement).position.x + dx, y: (el as TextElement).position.y + dy };
      } else if (el.tool === 'image') {
        (el as ImageElement).position = { x: (el as ImageElement).position.x + dx, y: (el as ImageElement).position.y + dy };
      } else {
        const s = el as Shape;
        s.start = { x: s.start.x + dx, y: s.start.y + dy };
        s.end = { x: s.end.x + dx, y: s.end.y + dy };
      }
    }
    this.renderAll();
    this.emit('change');
  }

duplicateSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    const newIds = new Set<string>();
    const groupMap = new Map<string, string>();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (!el) continue;
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = uid();
      if (el.groupId) {
        if (!groupMap.has(el.groupId)) groupMap.set(el.groupId, uid());
        clone.groupId = groupMap.get(el.groupId);
      } else {
        clone.groupId = undefined;
      }
      if ('start' in clone) { clone.start = { x: clone.start.x + 20, y: clone.start.y + 20 }; clone.end = { x: clone.end.x + 20, y: clone.end.y + 20 }; }
      if ('position' in clone) { clone.position = { x: clone.position.x + 20, y: clone.position.y + 20 }; }
      if ('points' in clone) { clone.points = clone.points.map((p: any) => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure })); }
      this.elements.push(clone);
      newIds.add(clone.id);
    }
    this.selectedIds = newIds;
    this.renderAll();
    this.emit('change');
  }

rotateSelected(angle: number): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    const ids = [...this.selectedIds];
    if (ids.length === 1) {
      const el = this.elements.find(e => e.id === ids[0]);
      if (el) el.rotation = ((el.rotation ?? 0) + angle) % (Math.PI * 2);
    } else {
      let cx = 0, cy = 0, count = 0;
      for (const id of ids) {
        const el = this.elements.find(e => e.id === id);
        if (!el) continue;
        const b = this.getLocalBounds(el);
        cx += b.x + b.w / 2;
        cy += b.y + b.h / 2;
        count++;
      }
      if (count > 0) { cx /= count; cy /= count; }
      const center: Point = { x: cx, y: cy };
      for (const id of ids) {
        const el = this.elements.find(e => e.id === id);
        if (!el) continue;
        if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
          const s = el as Stroke;
          s.points = s.points.map(p => this.rotatePoint(p, center, angle));
        } else if (el.tool === 'text') {
          (el as TextElement).position = this.rotatePoint((el as TextElement).position, center, angle);
        } else if (el.tool === 'image') {
          (el as ImageElement).position = this.rotatePoint((el as ImageElement).position, center, angle);
        } else {
          const s = el as Shape;
          s.start = this.rotatePoint(s.start, center, angle);
          s.end = this.rotatePoint(s.end, center, angle);
        }
      }
    }
    this.renderAll();
    this.emit('change');
  }

getSelectedRotation(): number {
    if (this.selectedIds.size !== 1) return 0;
    const id = this.selectedIds.values().next().value!;
    const el = this.elements.find(e => e.id === id);
    return el ? (el.rotation ?? 0) : 0;
  }

copySelected(): void {
    if (this.selectedIds.size === 0) return;
    this.clipboard = [];
    const data: any[] = [];
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (!el) continue;
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = uid();
      this.clipboard.push(clone);
      data.push(clone);
    }
    this.clipboardData = JSON.stringify(data);
    try { navigator.clipboard.writeText(this.clipboardData); } catch {}
  }

pasteClipboard(): void {
    if (this.clipboard.length === 0 && this.clipboardData) {
      try {
        const parsed = JSON.parse(this.clipboardData);
        if (Array.isArray(parsed)) {
          this.clipboard = parsed;
        }
      } catch {}
    }
    if (this.clipboard.length === 0) {
      try {
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].tool) {
              this.clipboard = parsed;
              this.pasteClipboard();
            }
          } catch {}
        }).catch(() => {});
      } catch {}
      return;
    }
    this.pushUndo();
    const newIds = new Set<string>();
    const groupMap = new Map<string, string>();
    for (const el of this.clipboard) {
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = uid();
      if (clone.groupId) {
        if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, uid());
        clone.groupId = groupMap.get(clone.groupId);
      }
      if ('start' in clone) { clone.start = { x: clone.start.x + 20, y: clone.start.y + 20 }; clone.end = { x: clone.end.x + 20, y: clone.end.y + 20 }; }
      if ('position' in clone) { clone.position = { x: clone.position.x + 20, y: clone.position.y + 20 }; }
      if ('points' in clone) { clone.points = clone.points.map((p: any) => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure })); }
      this.elements.push(clone);
      newIds.add(clone.id);
    }
    this.selectedIds = newIds;
    this.clipboard = this.clipboard.map(c => JSON.parse(JSON.stringify(c)));
    this.renderAll();
    this.emit('change');
  }

selectAll(): void {
    this.selectedIds = new Set(this.elements.map(el => el.id));
    this.renderAll();
    this.emit('change');
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

resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = window.devicePixelRatio || 1;
    this.graphDirty = true;
    this.setupCanvases();
    this.renderAll();
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

handleImagePaste(e: ClipboardEvent): void {
    if (this.textInput) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const world = this.screenToWorld(centerX, centerY);
            const el: ImageElement = {
              id: uid(),
              tool: 'image',
              position: { x: world.x - img.width / 2, y: world.y - img.height / 2 },
              width: img.width,
              height: img.height,
              src,
              opacity: 1,
            };
            this.pushUndo();
            this.elements.push(el);
            this.renderAll();
            this.emit('change');
          };
          img.src = src;
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
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

wordWrapTextForSVG(text: string, fontSize: number, maxWidth: number, fontFamily = 'system-ui, -apple-system, sans-serif'): string[] {
    const rawLines = text.split('\n');
    const wrappedLines: string[] = [];
    const ctx = this.staticCtx;
    ctx.font = `${fontSize}px ${fontFamily}`;
    for (const rawLine of rawLines) {
      if (rawLine === '') { wrappedLines.push(''); continue; }
      const words = rawLine.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      wrappedLines.push(currentLine);
    }
    return wrappedLines;
  }

insertLaTeX(latex: string): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const world = this.screenToWorld(centerX, centerY);
    const el: LaTeXElement = {
      id: uid(),
      tool: 'katex',
      position: world,
      latex,
      fontSize: 24,
      color: this.strokeColor,
      opacity: this.strokeOpacity,
      createdAt: Date.now(),
    };
    this.pushUndo();
    this.elements.push(el);
    this.katexImageCache.clear();
    this.renderAll();
    this.emit('change');
    this.showToast('LaTeX inserted — double-click to edit');
  }

};
