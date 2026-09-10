import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';
import { computeContentBounds } from './persistence/content-bounds';
import { buildSVG, elementToSVG as renderElementToSVG } from './persistence/svg';
import { buildPdfBlob } from './persistence/pdf';
import { filterValidSnapshotElements } from './persistence/snapshot';

export const PersistenceMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class PersistenceTrait extends Base {
resolveSnapshot(elements: Element[]): Element[] {
    return elements.map(el => {
      if (el.tool === 'image') {
        const img = { ...el } as ImageElement;
        if (img.src.startsWith('__img:')) {
          const idx = parseInt(img.src.slice(6));
          img.src = this.imagePool[idx] ?? '';
        }
        return img;
      }
      return el;
    });
  }

renderKaTeXToImage(latex: string, fontSize: number, color: string): HTMLImageElement | null {
    try {
      const katex = (window as any).katex;
      if (!katex) return null;
      const html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${fontSize * latex.length * 0.6}" height="${fontSize * 1.8}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSize}px;color:${color};white-space:nowrap;">${html}</div></foreignObject></svg>`;
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        this.renderAll();
      };
      return img;
    } catch { return null; }
  }

exportPNG(): void {
    this.toBlob('image/png').then(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'blackboard.png'; a.click();
      URL.revokeObjectURL(url);
    });
  }

toDataURL(type = 'image/png', quality = 1): string {
    const c = document.createElement('canvas');
    c.width = this.width * this.dpr;
    c.height = this.height * this.dpr;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(this.staticCanvas, 0, 0);
    return c.toDataURL(type, quality);
  }

exportJSON(): Snapshot {
    return { elements: JSON.parse(JSON.stringify(this.elements)), width: this.width, height: this.height, camera: { ...this.camera }, graph: { ...this.graph }, theme: this.theme, imagePool: [...this.imagePool] };
  }

importJSON(snapshot: Snapshot): void {
    if (!snapshot || !Array.isArray(snapshot.elements)) {
      this.showToast('Invalid snapshot data');
      return;
    }
    const valid = filterValidSnapshotElements(snapshot.elements);
    this.elements = valid;
    this.undoStack = [];
    this.redoStack = [];
    this.imageCache.clear();
    if (snapshot.camera) this.camera = snapshot.camera;
    if (snapshot.graph) this.graph = { ...this.graph, ...snapshot.graph };
    if (snapshot.theme) this.setTheme(snapshot.theme);
    if (snapshot.imagePool && Array.isArray(snapshot.imagePool)) {
      this.imagePool = snapshot.imagePool;
    }
    this.selectedIds.clear();
    this.renderAll();
    this.emit('load');
    this.emit('change');
    if (valid.length < snapshot.elements.length) {
      this.showToast(`Loaded ${valid.length} of ${snapshot.elements.length} elements`);
    }
  }

saveToStorage(key = 'casuya-blackboard'): void {
    this.cleanImagePool();
    const data = JSON.stringify(this.exportJSON());
    if (data.length > 4 * 1024 * 1024) {
      this.showToast('⚠️ Large data — some images may not persist');
    }
    try {
      localStorage.setItem(key, data);
      this.emit('save');
    } catch {
      this.showToast('⚠️ Storage full — clear browser data');
    }
  }

loadFromStorage(key = 'casuya-blackboard'): boolean {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      this.importJSON(JSON.parse(raw));
      return true;
    } catch { return false; }
  }

handleFileDrop(e: DragEvent): void {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    const rect = this.liveCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.screenToWorld(sx, sy);
    this.pushUndo();
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const el: ImageElement = {
            id: uid(),
            tool: 'image',
            position: { x: world.x - img.width / 2, y: world.y - img.height / 2 },
            width: img.width,
            height: img.height,
            src,
            opacity: 1,
          };
          this.elements.push(el);
          this.renderAll();
          this.emit('change');
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  }

exportSVG(): string {
    const bounds = computeContentBounds(this.elements, el => this.getElementBounds(el));
    const parts = this.elements.map(el => this.elementToSVG(el));
    return buildSVG(parts, bounds, this.width, this.height);
  }

exportSelectedSVG(): string {
    if (this.selectedIds.size === 0) return this.exportSVG();
    const selected = this.elements.filter(e => this.selectedIds.has(e.id));
    const bounds = computeContentBounds(selected, el => this.getElementBounds(el));
    if (!bounds) return '';
    const parts = selected.map(el => this.elementToSVG(el));
    return buildSVG(parts, bounds, this.width, this.height);
  }

exportSelectedPNG(): void {
    if (this.selectedIds.size === 0) { this.exportPNG(); return; }
    const selected = this.elements.filter(e => this.selectedIds.has(e.id));
    const bounds = computeContentBounds(selected, el => this.getElementBounds(el));
    if (!bounds) return;
    const pad = 10;
    const vx = bounds.x - pad, vy = bounds.y - pad;
    const vw = bounds.w + pad * 2, vh = bounds.h + pad * 2;
    const c = document.createElement('canvas');
    c.width = vw * this.dpr;
    c.height = vh * this.dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = THEMES[this.theme].canvasBg;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(-vx, -vy);
    for (const el of selected) this.drawElement(ctx, el);
    ctx.restore();
    c.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'selection.png'; a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

elementToSVG(el: Element): string {
    return renderElementToSVG(el, {
      getRotationCenter: e => this.getRotationCenter(e),
      wordWrapTextForSVG: (text, fontSize, maxWidth, fontFamily) => this.wordWrapTextForSVG(text, fontSize, maxWidth, fontFamily),
    });
  }

exportPDF(): void {
    const c = document.createElement('canvas');
    c.width = this.width * this.dpr;
    c.height = this.height * this.dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = THEMES[this.theme].canvasBg;
    ctx.fillRect(0, 0, this.width, this.height);
    for (const el of this.elements) this.drawElement(ctx, el);
    c.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const pdfW = this.width * 0.75;
        const pdfH = this.height * 0.75;
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        const pdfBlob = buildPdfBlob(dataUrl, pdfW, pdfH, c.width, c.height);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = pdfUrl; a.download = 'blackboard.pdf'; a.click();
        URL.revokeObjectURL(pdfUrl);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }, 'image/png');
  }

};