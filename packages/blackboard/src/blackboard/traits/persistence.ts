import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

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
    return { elements: JSON.parse(JSON.stringify(this.elements)), width: this.width, height: this.height, camera: { ...this.camera }, graph: { ...this.graph }, theme: this.theme };
  }

importJSON(snapshot: Snapshot): void {
    if (!snapshot || !Array.isArray(snapshot.elements)) {
      this.showToast('Invalid snapshot data');
      return;
    }
    const validTools = new Set(['pen', 'eraser', 'highlighter', 'laser', 'line', 'rect', 'circle', 'arrow', 'diamond', 'text', 'image', 'katex']);
    const valid = snapshot.elements.filter((el: any) => {
      if (!el || typeof el.id !== 'string' || !validTools.has(el.tool)) return false;
      if ((el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'laser') && !Array.isArray(el.points)) return false;
      if ((el.tool === 'line' || el.tool === 'rect' || el.tool === 'circle' || el.tool === 'arrow' || el.tool === 'diamond') && (!el.start || !el.end)) return false;
      if (el.tool === 'text' && (!el.position || typeof el.content !== 'string')) return false;
      if (el.tool === 'image' && (!el.position || typeof el.src !== 'string')) return false;
      if (el.tool === 'katex' && (!el.position || typeof el.latex !== 'string')) return false;
      return true;
    });
    this.elements = valid;
    this.undoStack = [];
    this.redoStack = [];
    this.imageCache.clear();
    if (snapshot.camera) this.camera = snapshot.camera;
    if (snapshot.graph) this.graph = { ...this.graph, ...snapshot.graph };
    if (snapshot.theme) this.setTheme(snapshot.theme);
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of this.elements) {
      const b = this.getElementBounds(el);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    if (minX === Infinity) { minX = 0; minY = 0; maxX = this.width; maxY = this.height; }
    const pad = 10;
    const vx = minX - pad;
    const vy = minY - pad;
    const vw = maxX - minX + pad * 2;
    const vh = maxY - minY + pad * 2;
    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`);
    for (const el of this.elements) {
      parts.push(this.elementToSVG(el));
    }
    parts.push('</svg>');
    return parts.join('\n');
  }

exportSelectedSVG(): string {
    if (this.selectedIds.size === 0) return this.exportSVG();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const selected = this.elements.filter(e => this.selectedIds.has(e.id));
    for (const el of selected) {
      const b = this.getElementBounds(el);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    if (minX === Infinity) return '';
    const pad = 10;
    const vx = minX - pad, vy = minY - pad;
    const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`);
    for (const el of selected) parts.push(this.elementToSVG(el));
    parts.push('</svg>');
    return parts.join('\n');
  }

exportSelectedPNG(): void {
    if (this.selectedIds.size === 0) { this.exportPNG(); return; }
    const selected = this.elements.filter(e => this.selectedIds.has(e.id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of selected) {
      const b = this.getElementBounds(el);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    if (minX === Infinity) return;
    const pad = 10;
    const vx = minX - pad, vy = minY - pad;
    const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
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
    const rotation = el.rotation ?? 0;
    const op = el.opacity !== undefined ? ` opacity="${el.opacity}"` : '';
    if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
      const stroke = el as Stroke;
      if (stroke.points.length < 2) return '';
      const pts = stroke.points;
      let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const mx = ((prev.x + curr.x) / 2).toFixed(2);
        const my = ((prev.y + curr.y) / 2).toFixed(2);
        d += ` Q${prev.x.toFixed(2)},${prev.y.toFixed(2)} ${mx},${my}`;
      }
      d += ` L${pts[pts.length - 1].x.toFixed(2)},${pts[pts.length - 1].y.toFixed(2)}`;
      const strokeColor = stroke.tool === 'eraser' ? 'none' : stroke.color;
      const fillColor = stroke.tool === 'eraser' ? 'none' : stroke.color;
      const opAttr = stroke.tool === 'highlighter' ? ` opacity="0.3"` : op;
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"${rot}${opAttr}/>`;
    }
    if (el.tool === 'line') {
      const s = el as Shape;
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      const dash = (s as Shape).dashPattern ? ` stroke-dasharray="${(s as Shape).dashPattern!.join(',')}"` : '';
      return `<line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}${rot}${op}/>`;
    }
    if (el.tool === 'rect') {
      const s = el as Shape;
      const rx = Math.min(s.start.x, s.end.x);
      const ry = Math.min(s.start.y, s.end.y);
      const rw = Math.abs(s.end.x - s.start.x);
      const rh = Math.abs(s.end.y - s.start.y);
      const cr = s.cornerRadius ? ` rx="${s.cornerRadius}" ry="${s.cornerRadius}"` : '';
      const fill = s.filled ? ` fill="${s.color}" fill-opacity="0.25"` : ' fill="none"';
      const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(',')}"` : '';
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"${cr} stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
    }
    if (el.tool === 'circle') {
      const s = el as Shape;
      const cx = (s.start.x + s.end.x) / 2;
      const cy = (s.start.y + s.end.y) / 2;
      const rrx = Math.abs(s.end.x - s.start.x) / 2;
      const rry = Math.abs(s.end.y - s.start.y) / 2;
      const fill = s.filled ? ` fill="${s.color}" fill-opacity="0.25"` : ' fill="none"';
      const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(',')}"` : '';
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rrx}" ry="${rry}" stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
    }
    if (el.tool === 'arrow') {
      const s = el as Shape;
      const dx = s.end.x - s.start.x;
      const dy = s.end.y - s.start.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return '';
      const headLen = Math.min(15, len * 0.3);
      const angle = Math.atan2(dy, dx);
      const ax1 = s.end.x - headLen * Math.cos(angle - Math.PI / 6);
      const ay1 = s.end.y - headLen * Math.sin(angle - Math.PI / 6);
      const ax2 = s.end.x - headLen * Math.cos(angle + Math.PI / 6);
      const ay2 = s.end.y - headLen * Math.sin(angle + Math.PI / 6);
      const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(',')}"` : '';
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<g${rot}${op}><line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}/><line x1="${s.end.x}" y1="${s.end.y}" x2="${ax1}" y2="${ay1}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}/><line x1="${s.end.x}" y1="${s.end.y}" x2="${ax2}" y2="${ay2}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}/></g>`;
    }
    if (el.tool === 'diamond') {
      const s = el as Shape;
      const dcx = (s.start.x + s.end.x) / 2;
      const dcy = (s.start.y + s.end.y) / 2;
      const hw = Math.abs(s.end.x - s.start.x) / 2;
      const hh = Math.abs(s.end.y - s.start.y) / 2;
      const fill = s.filled ? ` fill="${s.color}" fill-opacity="0.25"` : ' fill="none"';
      const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(',')}"` : '';
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<polygon points="${dcx},${dcy - hh} ${dcx + hw},${dcy} ${dcx},${dcy + hh} ${dcx - hw},${dcy}" stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
    }
    if (el.tool === 'katex') {
      const k = el as LaTeXElement;
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<text x="${k.position.x}" y="${k.position.y}" font-size="${k.fontSize}" font-family="'Courier New', monospace" fill="${k.color}" dominant-baseline="hanging"${rot}${op}>${k.latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
    }
    if (el.tool === 'text') {
      const t = el as TextElement;
      const lines = this.wordWrapTextForSVG(t.content, t.fontSize, t.width > 1 ? t.width : 300, t.fontFamily);
      const lineHeight = t.fontSize * 1.4;
      const tspans = lines.map((line, i) =>
        `<tspan x="${t.position.x}" dy="${i === 0 ? 0 : lineHeight}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`
      ).join('');
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<text x="${t.position.x}" y="${t.position.y}" font-size="${t.fontSize}" font-family="${t.fontFamily}" fill="${t.color}" dominant-baseline="hanging"${rot}${op}>${tspans}</text>`;
    }
    if (el.tool === 'image') {
      const img = el as ImageElement;
      const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : '';
      return `<image href="${img.src}" x="${img.position.x}" y="${img.position.y}" width="${img.width}" height="${img.height}"${rot}${op}/>`;
    }
    return '';
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
        const pdfParts: string[] = [];
        pdfParts.push('%PDF-1.4');
        const obj: string[] = [];
        obj.push('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj');
        obj.push('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj');
        obj.push(`3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pdfW} ${pdfH}]/Contents 4 0 R/Resources<</XObject<</Img 5 0 R>>>>>>endobj`);
        const contentStream = `q ${pdfW} 0 0 ${pdfH} 0 0 cm /Img Do Q`;
        obj.push(`4 0 obj<</Length ${contentStream.length}>>\nstream\n${contentStream}\nendstream\nendobj`);
        const dataUrl = c.toDataURL('image/jpeg', 0.92);
        const base64 = dataUrl.split(',')[1];
        obj.push(`5 0 obj<</Type/XObject/Subtype/Image/Width ${c.width}/Height ${c.height}/ColorSpace/DeviceRGB/Length ${base64.length}/Filter/DCTDecode>>\nstream\n${base64}\nendstream\nendobj`);
        let offset = 0;
        const offsets: number[] = [];
        for (const o of obj) {
          offsets.push(offset);
          offset += o.length + 1;
        }
        let pdf = obj.join('\n') + '\n';
        const xrefOffset = pdf.length;
        pdf += 'xref\n';
        pdf += `0 ${obj.length + 1}\n`;
        pdf += '0000000000 65535 f \n';
        for (const off of offsets) {
          pdf += String(off).padStart(10, '0') + ' 00000 n \n';
        }
        pdf += 'trailer\n';
        pdf += `<</Size ${obj.length + 1}/Root 1 0 R>>\n`;
        pdf += 'startxref\n';
        pdf += `${xrefOffset}\n`;
        pdf += '%%EOF';
        const pdfBlob = new Blob([pdf], { type: 'application/pdf' });
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
