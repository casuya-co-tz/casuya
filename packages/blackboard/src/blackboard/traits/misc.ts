import type { Point, Stroke, Shape, LaTeXElement, TextElement, ImageElement, Element, BlackboardEvent, BlackboardEventCallback } from '../../types';
import { BlackboardBase, Constructor } from '../base';
import { flushLive as flushLiveOverlay } from './misc/flush-live';
import { bringForward, sendBackward, bringToFront, sendToBack } from './misc/z-order';
import { startPresentation, stopPresentation, isPresenting, presentNext, presentPrev, showPresenterView } from './misc/presentation';

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
    flushLiveOverlay(this);
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
    bringForward(this);
  }

sendBackward(): void {
    sendBackward(this);
  }

bringToFront(): void {
    bringToFront(this);
  }

sendToBack(): void {
    sendToBack(this);
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
    startPresentation(this);
  }

stopPresentation(): void {
    stopPresentation(this);
  }

isPresenting(): boolean { return isPresenting(this); }

presentNext(): void {
    presentNext(this);
  }

presentPrev(): void {
    presentPrev(this);
  }

showPresenterView(): void {
    showPresenterView(this);
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