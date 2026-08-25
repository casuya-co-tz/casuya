import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const MiscMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class MiscTrait extends Base {
snapToGrid(point: Point): Point {
    if (!this.graph.enabled) return point;
    const s = this.graph.spacing;
    return { x: Math.round(point.x / s) * s, y: Math.round(point.y / s) * s };
  }

clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

moveSingleElement(el: Element, orig: Element, dx: number, dy: number): void {
    if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'laser') {
      const s = el as Stroke;
      const o = orig as Stroke;
      s.points = o.points.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
    } else if (el.tool === 'text') {
      const t = el as TextElement;
      const o = orig as TextElement;
      t.position = { x: o.position.x + dx, y: o.position.y + dy };
    } else if (el.tool === 'katex') {
      const k = el as LaTeXElement;
      const o = orig as LaTeXElement;
      k.position = { x: o.position.x + dx, y: o.position.y + dy };
    } else if (el.tool === 'image') {
      const img = el as ImageElement;
      const o = orig as ImageElement;
      img.position = { x: o.position.x + dx, y: o.position.y + dy };
    } else {
      const s = el as Shape;
      const o = orig as Shape;
      s.start = { x: o.start.x + dx, y: o.start.y + dy };
      s.end = { x: o.end.x + dx, y: o.end.y + dy };
    }
  }

getRotationCenter(el: Element): Point {
    const bounds = this.getLocalBounds(el);
    return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  }

flushLive(): void {
    const ctx = this.liveCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    if (this.currentElement) this.drawElement(ctx, this.currentElement);
    this.drawSelectionIndicators(ctx);
    this.drawAlignmentGuides(ctx);
    this.drawLaserStrokes(ctx);
    this.drawRemoteCursors(ctx);
    if (this.marqueeStart && this.marqueeEnd) {
      const t = THEMES[this.theme];
      const x = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
      const y = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
      const w = Math.abs(this.marqueeEnd.x - this.marqueeStart.x);
      const h = Math.abs(this.marqueeEnd.y - this.marqueeStart.y);
      ctx.fillStyle = t.selectionFill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = t.selectionColor;
      ctx.lineWidth = 1 / this.camera.zoom;
      ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    
    if (this.activeTool === 'eraser' && this.lastPointerWorld) {
      const eraserRadius = (IS_MOBILE() ? this.strokeWidth * 3.5 : this.strokeWidth * 2.5);
      ctx.beginPath();
      ctx.arc(this.lastPointerWorld.x, this.lastPointerWorld.y, eraserRadius, 0, Math.PI * 2);
      ctx.strokeStyle = THEMES[this.theme].selectionColor;
      ctx.lineWidth = 1 / this.camera.zoom;
      ctx.stroke();
    }
    ctx.restore();
  }

roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

setWidth(width: number): void {
    this.strokeWidth = Math.max(1, Math.min(50, width));
    this.updateToolbar();
  }

getWidth(): number { return this.strokeWidth; }

getFontSize(): number { return this.fontSize; }

setFontSize(size: number): void {
    this.fontSize = Math.max(8, Math.min(72, size));
    this.updateToolbar();
  }

getRoughness(): number { return this.roughness; }

setRoughness(level: number): void {
    this.roughness = Math.max(0, Math.min(3, level));
    this.renderAll();
  }

getDashEnabled(): boolean { return this.dashEnabled; }

setDashEnabled(enabled: boolean): void {
    this.dashEnabled = enabled;
    this.updateToolbar();
  }

getOpacity(): number { return this.strokeOpacity; }

setOpacity(opacity: number): void {
    this.strokeOpacity = Math.max(0.05, Math.min(1, opacity));
    this.updateToolbar();
  }

getFontFamily(): string { return this.fontFamily; }

setFontFamily(family: string): void { this.fontFamily = family; this.updateToolbar(); }

getCornerRadius(): number { return this.cornerRadius; }

setCornerRadius(r: number): void { this.cornerRadius = Math.max(0, Math.min(50, r)); this.updateToolbar(); }

resetView(): void {
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.graphDirty = true;
    this.renderAll();
    this.updateToolbar();
  }

clear(): void {
    if (this.elements.length === 0) {
      this.emit('clear');
      return;
    }
    if (!confirm('Clear all elements?')) return;
    this.pushUndo();
    this.elements = [];
    this.selectedIds.clear();
    this.currentElement = null;
    this.imageCache.clear();
    this.renderAll();
    this.updateToolbar();
    this.emit('clear');
    this.emit('change');
  }

getElements(): readonly Element[] { return this.elements; }

on(event: BlackboardEvent, callback: BlackboardEventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

off(event: BlackboardEvent, callback: BlackboardEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

emit(event: BlackboardEvent): void {
    const set = this.listeners.get(event);
    if (!set) return;
    if (event === 'change') this.dirtySinceSave = true;
    const payload = { elements: this.elements, tool: this.activeTool };
    set.forEach((cb) => cb(payload));
  }

bringForward(): void {
    if (this.selectedIds.size !== 1) return;
    const id = this.selectedIds.values().next().value!;
    const idx = this.elements.findIndex(e => e.id === id);
    if (idx < 0 || idx >= this.elements.length - 1) return;
    this.pushUndo();
    [this.elements[idx], this.elements[idx + 1]] = [this.elements[idx + 1], this.elements[idx]];
    this.renderAll();
    this.emit('change');
  }

sendBackward(): void {
    if (this.selectedIds.size !== 1) return;
    const id = this.selectedIds.values().next().value!;
    const idx = this.elements.findIndex(e => e.id === id);
    if (idx <= 0) return;
    this.pushUndo();
    [this.elements[idx], this.elements[idx - 1]] = [this.elements[idx - 1], this.elements[idx]];
    this.renderAll();
    this.emit('change');
  }

bringToFront(): void {
    if (this.selectedIds.size !== 1) return;
    const id = this.selectedIds.values().next().value!;
    const idx = this.elements.findIndex(e => e.id === id);
    if (idx < 0 || idx >= this.elements.length - 1) return;
    this.pushUndo();
    const [el] = this.elements.splice(idx, 1);
    this.elements.push(el);
    this.renderAll();
    this.emit('change');
  }

sendToBack(): void {
    if (this.selectedIds.size !== 1) return;
    const id = this.selectedIds.values().next().value!;
    const idx = this.elements.findIndex(e => e.id === id);
    if (idx <= 0) return;
    this.pushUndo();
    const [el] = this.elements.splice(idx, 1);
    this.elements.unshift(el);
    this.renderAll();
    this.emit('change');
  }

toBlob(type = 'image/png', quality = 1): Promise<Blob | null> {
    return new Promise(resolve => {
      const c = document.createElement('canvas');
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(this.staticCanvas, 0, 0);
      c.toBlob(resolve, type, quality);
    });
  }

startPresentation(): void {
    if (this.elements.length === 0) return;
    this.presenterMode = true;
    this.presenterStep = 0;
    this.showPresenterView();
    this.showToast('Presentation mode — use arrow keys or click to advance');
  }

stopPresentation(): void {
    this.presenterMode = false;
    this.presenterStep = 0;
    if (this.presenterOverlay) { this.presenterOverlay.remove(); this.presenterOverlay = null; }
    this.renderAll();
  }

isPresenting(): boolean { return this.presenterMode; }

presentNext(): void {
    if (!this.presenterMode) return;
    if (this.presenterStep < this.elements.length - 1) {
      this.presenterStep++;
      this.showPresenterView();
    } else {
      this.showToast('End of presentation');
    }
  }

presentPrev(): void {
    if (!this.presenterMode) return;
    if (this.presenterStep > 0) {
      this.presenterStep--;
      this.showPresenterView();
    }
  }

showPresenterView(): void {
    if (!this.presenterOverlay) {
      this.presenterOverlay = document.createElement('div');
      this.presenterOverlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#000;display:flex;align-items:center;justify-content:center;';
      this.presenterOverlay.addEventListener('click', (e) => {
        if (e.target === this.presenterOverlay) this.presentNext();
      });
      this.presenterOverlay.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') this.presentNext();
        else if (e.key === 'ArrowLeft') this.presentPrev();
        else if (e.key === 'Escape') this.stopPresentation();
      });
      document.body.appendChild(this.presenterOverlay);
      this.presenterOverlay.tabIndex = 0;
      this.presenterOverlay.focus();
    }
    const visible = this.elements.slice(0, this.presenterStep + 1);
    const c = document.createElement('canvas');
    c.width = this.width * this.dpr;
    c.height = this.height * this.dpr;
    c.style.cssText = 'max-width:95vw;max-height:90vh;object-fit:contain;';
    const ctx = c.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, this.width, this.height);
    for (const el of visible) this.drawElement(ctx, el);
    this.presenterOverlay.innerHTML = '';
    this.presenterOverlay.appendChild(c);
    const counter = document.createElement('div');
    counter.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#888;font:14px system-ui;background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:8px;';
    counter.textContent = `${this.presenterStep + 1} / ${this.elements.length}`;
    this.presenterOverlay.appendChild(counter);
  }

destroy(): void {
    this.detachEvents();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
    if (this.autosaveTimer) { clearInterval(this.autosaveTimer); this.autosaveTimer = null; }
    if (this.boundBeforeUnload) { window.removeEventListener('beforeunload', this.boundBeforeUnload); this.boundBeforeUnload = null; }
    if (this.toastTimeout) { clearTimeout(this.toastTimeout); this.toastTimeout = null; }
    this.dismissContextMenu();
    this.imageCache.clear();
    this.root.remove();
  }

};
