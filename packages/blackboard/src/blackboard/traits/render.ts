import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const RenderMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class RenderTrait extends Base {
drawLaserStrokes(ctx: CanvasRenderingContext2D): void {
    const allStrokes = [...this.laserStrokes];
    if (this.isDrawing && this.currentElement && this.currentElement.tool === 'laser') {
      const cur = this.currentElement as Stroke;
      allStrokes.push({ id: cur.id, points: cur.points, color: cur.color, width: cur.width, opacity: 1, createdAt: Date.now() });
    }
    if (allStrokes.length === 0) return;
    const now = Date.now();
    const FADE_MS = 2000;
    for (const s of allStrokes) {
      const age = now - s.createdAt;
      const alpha = Math.max(0, 1 - age / FADE_MS);
      if (alpha <= 0 || s.points.length < 2) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
      ctx.stroke();
      ctx.restore();
    }
  }

setupCanvases(): void {
    [this.staticCanvas, this.liveCanvas].forEach(c => {
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      c.getContext('2d')!.scale(this.dpr, this.dpr);
    });
  }

renderAll(): void {
    this.renderStatic();
    this.flushLive();
  }

renderStatic(): void {
    const ctx = this.staticCtx;
    const t = THEMES[this.theme];
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = t.canvasBg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    if (this.graph.enabled) {
      if (this.graphDirty || !this.graphCanvas) {
        this.ensureGraphCanvas();
        this.renderGraphToOffscreen();
      }
      ctx.drawImage(this.graphCanvas!, this.camera.x * this.camera.zoom, this.camera.y * this.camera.zoom, this.width, this.height, 0, 0, this.width, this.height);
    }
    for (const el of this.elements) this.drawElement(ctx, el);
    ctx.restore();
    if (this.elements.length === 0 && !this.currentElement) {
      if (!this.hintEl) {
        this.hintEl = document.createElement('div');
        this.hintEl.className = 'casuya-hint';
        this.hintEl.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none;font-family:system-ui,sans-serif;`;
        this.canvasWrapper.appendChild(this.hintEl);
      }
      const hintSize = IS_MOBILE() ? 11 : 14;
      this.hintEl.textContent = IS_MOBILE() ? 'Tap a tool to start' : 'Choose a tool and start drawing';
      this.hintEl.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none;font-family:system-ui,sans-serif;font-size:${hintSize}px;color:${t.hintColor};`;
      this.hintEl.style.display = '';
    } else if (this.hintEl) {
      this.hintEl.style.display = 'none';
    }
  }

ensureGraphCanvas(): void {
    if (!this.graphCanvas) {
      this.graphCanvas = document.createElement('canvas');
      this.graphCtx = this.graphCanvas.getContext('2d')!;
    }
    if (this.graphCanvas.width !== this.width * this.dpr || this.graphCanvas.height !== this.height * this.dpr) {
      this.graphCanvas.width = this.width * this.dpr;
      this.graphCanvas.height = this.height * this.dpr;
      this.graphCtx!.scale(this.dpr, this.dpr);
      this.graphDirty = true;
    }
  }

renderGraphToOffscreen(): void {
    const ctx = this.graphCtx!;
    const t = THEMES[this.theme];
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawGraph(ctx);
    this.graphDirty = false;
  }

drawGraph(ctx: CanvasRenderingContext2D): void {
    const { spacing, showAxes, showLabels } = this.graph;
    const t = THEMES[this.theme];
    const vl = this.camera.x;
    const vt = this.camera.y;
    const vr = this.camera.x + this.width / this.camera.zoom;
    const vb = this.camera.y + this.height / this.camera.zoom;
    const startX = Math.floor(vl / spacing) * spacing;
    const endX = Math.ceil(vr / spacing) * spacing;
    const startY = Math.floor(vt / spacing) * spacing;
    const endY = Math.ceil(vb / spacing) * spacing;

    ctx.strokeStyle = this.graph.color || t.gridColor;
    ctx.lineWidth = 0.5 / this.camera.zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += spacing) {
      ctx.moveTo(x, vt);
      ctx.lineTo(x, vb);
    }
    for (let y = startY; y <= endY; y += spacing) {
      ctx.moveTo(vl, y);
      ctx.lineTo(vr, y);
    }
    ctx.stroke();

    if (showAxes) {
      ctx.strokeStyle = t.gridAxisColor;
      ctx.lineWidth = 1.5 / this.camera.zoom;
      ctx.beginPath();
      if (0 >= vt && 0 <= vb) { ctx.moveTo(vl, 0); ctx.lineTo(vr, 0); }
      if (0 >= vl && 0 <= vr) { ctx.moveTo(0, vt); ctx.lineTo(0, vb); }
      ctx.stroke();

      if (showLabels) {
        ctx.fillStyle = t.gridLabelColor;
        ctx.font = `${10 / this.camera.zoom}px system-ui, sans-serif`;
        const labelOffset = spacing;
        ctx.textAlign = 'center';
        if (0 >= vt && 0 <= vb) {
          for (let x = startX; x <= endX; x += spacing * 2) {
            if (Math.abs(x) < labelOffset) continue;
            ctx.fillText(String(x / spacing), x, 14 / this.camera.zoom);
          }
        }
        ctx.textAlign = 'right';
        if (0 >= vl && 0 <= vr) {
          for (let y = startY; y <= endY; y += spacing * 2) {
            if (Math.abs(y) < labelOffset) continue;
            ctx.fillText(String(-y / spacing), -6 / this.camera.zoom, y + 4 / this.camera.zoom);
          }
        }
      }
    }
  }

drawElement(ctx: CanvasRenderingContext2D, el: Element): void {
    ctx.save();
    ctx.globalAlpha = el.opacity;
    const rotation = el.rotation ?? 0;
    if (rotation !== 0) {
      const center = this.getRotationCenter(el);
      ctx.translate(center.x, center.y);
      ctx.rotate(rotation);
      ctx.translate(-center.x, -center.y);
    }
    if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
      this.drawFreehand(ctx, el as Stroke);
    } else if (el.tool === 'laser') {
    } else if (el.tool === 'text') {
      this.drawText(ctx, el as TextElement);
    } else if (el.tool === 'image') {
      this.drawImage(ctx, el as ImageElement);
    } else if (el.tool === 'katex') {
      this.drawLaTeX(ctx, el as LaTeXElement);
    } else {
      this.drawShape(ctx, el as Shape);
    }
    ctx.restore();
  }

drawFreehand(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    const { points, color, width, tool } = stroke;
    if (points.length < 2) return;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const hasPressure = points.some(p => p.pressure !== undefined && p.pressure !== 0.5);
    if (hasPressure && tool === 'pen') {
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const pressure = curr.pressure ?? 0.5;
        ctx.lineWidth = width * (0.3 + pressure * 1.4);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

drawText(ctx: CanvasRenderingContext2D, el: TextElement): void {
    ctx.fillStyle = el.color;
    ctx.font = `${el.fontSize}px ${el.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const maxWidth = el.width > 1 ? el.width : 300;
    const rawLines = el.content.split('\n');
    const wrappedLines: string[] = [];
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
    const lineHeight = el.fontSize * 1.4;
    for (let i = 0; i < wrappedLines.length; i++) {
      ctx.fillText(wrappedLines[i], el.position.x, el.position.y + i * lineHeight);
    }
  }

drawLaTeX(ctx: CanvasRenderingContext2D, el: LaTeXElement): void {
    const cacheKey = `${el.latex}|${el.fontSize}|${el.color}`;
    let img = this.katexImageCache.get(cacheKey);
    if (!img) {
      const rendered = this.renderKaTeXToImage(el.latex, el.fontSize, el.color);
      if (rendered) { img = rendered; this.katexImageCache.set(cacheKey, img); }
    }
    if (img && img.complete && img.naturalWidth > 0) {
      const w = el.width ?? img.naturalWidth;
      const h = el.height ?? img.naturalHeight;
      ctx.drawImage(img, el.position.x, el.position.y, w, h);
    } else {
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontSize}px "Courier New", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(el.latex, el.position.x, el.position.y);
    }
  }

drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
    const effectiveRoughness = shape.roughness !== undefined ? shape.roughness : this.roughness;
    if (effectiveRoughness > 0) {
      this.drawRoughShape(ctx, shape);
      return;
    }
    const { start, end, color, width } = shape;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (shape.tool) {
      case 'line':
        if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        if (shape.dashPattern) ctx.setLineDash([]);
        break;
      case 'rect': {
        const rx = Math.min(start.x, end.x);
        const ry = Math.min(start.y, end.y);
        const rw = Math.abs(end.x - start.x);
        const rh = Math.abs(end.y - start.y);
        const cr = (shape as Shape).cornerRadius ?? 0;
        if (shape.filled) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.25 * shape.opacity;
          if (cr > 0) { this.roundRect(ctx, rx, ry, rw, rh, cr); ctx.fill(); }
          else ctx.fillRect(rx, ry, rw, rh);
          ctx.globalAlpha = shape.opacity;
        }
        if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
        if (cr > 0) { this.roundRect(ctx, rx, ry, rw, rh, cr); ctx.stroke(); }
        else ctx.strokeRect(rx, ry, rw, rh);
        if (shape.dashPattern) ctx.setLineDash([]);
        break;
      }
      case 'circle': {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rrx = Math.abs(end.x - start.x) / 2;
        const rry = Math.abs(end.y - start.y) / 2;
        if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rrx, rry, 0, 0, Math.PI * 2);
        if (shape.filled) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.25 * shape.opacity;
          ctx.fill();
          ctx.globalAlpha = shape.opacity;
        }
        ctx.stroke();
        if (shape.dashPattern) ctx.setLineDash([]);
        break;
      }
      case 'arrow': {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) break;
        if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        if (shape.dashPattern) ctx.setLineDash([]);
        const headLen = Math.min(15, len * 0.3);
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        if (shape.label) {
          const mx = (start.x + end.x) / 2;
          const my = (start.y + end.y) / 2;
          ctx.font = `${Math.max(12, width * 4)}px system-ui, sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(shape.label, mx, my - 4);
        }
        break;
      }
      case 'diamond': {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const hw = Math.abs(end.x - start.x) / 2;
        const hh = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hh);
        ctx.lineTo(cx + hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx - hw, cy);
        ctx.closePath();
        if (shape.filled) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.25 * shape.opacity;
          ctx.fill();
          ctx.globalAlpha = shape.opacity;
        }
        if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
        ctx.stroke();
        if (shape.dashPattern) ctx.setLineDash([]);
        break;
      }
    }
  }

drawRoughShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
    const roughLevel = shape.roughness ?? this.roughness;
    const maxOffset = roughLevel * 1.5;
    const passes = roughLevel + 1;
    const seedVal = shape.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = this.seededRandom(seedVal);
    const { start, end, color, width } = shape;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let pass = 0; pass < passes; pass++) {
      const off = () => (rand() - 0.5) * maxOffset;
      ctx.globalAlpha = Math.max(0.3, 1 - pass * 0.15);
      ctx.beginPath();

      switch (shape.tool) {
        case 'line': {
          ctx.moveTo(start.x + off(), start.y + off());
          ctx.lineTo(end.x + off(), end.y + off());
          ctx.stroke();
          break;
        }
        case 'rect': {
          const rx = Math.min(start.x, end.x);
          const ry = Math.min(start.y, end.y);
          const rw = Math.abs(end.x - start.x);
          const rh = Math.abs(end.y - start.y);
          const pts = [
            { x: rx, y: ry }, { x: rx + rw, y: ry },
            { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh },
          ];
          for (let i = 0; i < 4; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % 4];
            ctx.moveTo(a.x + off(), a.y + off());
            const segs = 4;
            for (let s = 1; s <= segs; s++) {
              const t = s / segs;
              ctx.lineTo(
                a.x + (b.x - a.x) * t + off(),
                a.y + (b.y - a.y) * t + off()
              );
            }
          }
          ctx.closePath();
          if (shape.filled) {
            ctx.fillStyle = color;
            const savedAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.25 * shape.opacity;
            ctx.fill();
            ctx.globalAlpha = savedAlpha;
          }
          ctx.stroke();
          break;
        }
        case 'circle': {
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          const rrx = Math.abs(end.x - start.x) / 2;
          const rry = Math.abs(end.y - start.y) / 2;
          const segs = 36;
          for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const px = cx + Math.cos(a) * rrx + off();
            const py = cy + Math.sin(a) * rry + off();
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          if (shape.filled) {
            ctx.fillStyle = color;
            const savedAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.25 * shape.opacity;
            ctx.fill();
            ctx.globalAlpha = savedAlpha;
          }
          ctx.stroke();
          break;
        }
        case 'arrow': {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const len = Math.hypot(dx, dy);
          if (len < 1) break;
          ctx.moveTo(start.x + off(), start.y + off());
          ctx.lineTo(end.x + off(), end.y + off());
          ctx.stroke();
          const headLen = Math.min(15, len * 0.3);
          const angle = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(end.x + off(), end.y + off());
          ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6) + off(), end.y - headLen * Math.sin(angle - Math.PI / 6) + off());
          ctx.moveTo(end.x + off(), end.y + off());
          ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6) + off(), end.y - headLen * Math.sin(angle + Math.PI / 6) + off());
          ctx.stroke();
          break;
        }
        case 'diamond': {
          const dcx = (start.x + end.x) / 2;
          const dcy = (start.y + end.y) / 2;
          const hw = Math.abs(end.x - start.x) / 2;
          const hh = Math.abs(end.y - start.y) / 2;
          const dpts = [
            { x: dcx, y: dcy - hh }, { x: dcx + hw, y: dcy },
            { x: dcx, y: dcy + hh }, { x: dcx - hw, y: dcy },
          ];
          for (let i = 0; i < 4; i++) {
            const a = dpts[i]; const b = dpts[(i + 1) % 4];
            ctx.moveTo(a.x + off(), a.y + off());
            for (let s = 1; s <= 4; s++) {
              const t = s / 4;
              ctx.lineTo(a.x + (b.x - a.x) * t + off(), a.y + (b.y - a.y) * t + off());
            }
          }
          ctx.closePath();
          if (shape.filled) {
            ctx.fillStyle = color;
            const savedAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.25 * shape.opacity;
            ctx.fill();
            ctx.globalAlpha = savedAlpha;
          }
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

drawSelectionIndicators(ctx: CanvasRenderingContext2D): void {
    if (this.selectedIds.size === 0) return;
    const t = THEMES[this.theme];
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (!el) continue;
      const bounds = this.getElementBounds(el);
      const local = this.getLocalBounds(el);
      const rotation = el.rotation ?? 0;
      const pad = 6 / this.camera.zoom;
      ctx.save();
      ctx.strokeStyle = t.selectionColor;
      ctx.lineWidth = 1.5 / this.camera.zoom;
      ctx.fillStyle = t.selectionFill;

      if (rotation !== 0) {
        const corners = this.getRotatedCorners({ x: local.x - pad, y: local.y - pad, w: local.w + pad * 2, h: local.h + pad * 2 }, rotation);
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        ctx.lineTo(corners[1].x, corners[1].y);
        ctx.lineTo(corners[2].x, corners[2].y);
        ctx.lineTo(corners[3].x, corners[3].y);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        const handles = [
          corners[0],
          { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
          corners[1],
          { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
          corners[2],
          { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
          corners[3],
          { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 },
        ];
        const handleSize = (IS_MOBILE() ? 12 : 8) / this.camera.zoom;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = t.selectionColor;
        ctx.lineWidth = 1.5 / this.camera.zoom;
        for (const c of handles) {
          ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        }
      } else {
        ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
        ctx.fillRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
        ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
        ctx.setLineDash([]);

        const handleSize = (IS_MOBILE() ? 12 : 8) / this.camera.zoom;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = t.selectionColor;
        ctx.lineWidth = 1.5 / this.camera.zoom;
        const handles = [
          { x: bounds.x - pad, y: bounds.y - pad },
          { x: bounds.x + bounds.w / 2, y: bounds.y - pad },
          { x: bounds.x + bounds.w + pad, y: bounds.y - pad },
          { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h / 2 },
          { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad },
          { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h + pad },
          { x: bounds.x - pad, y: bounds.y + bounds.h + pad },
          { x: bounds.x - pad, y: bounds.y + bounds.h / 2 },
        ];
        for (const c of handles) {
          ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        }
      }
      const rotateHandleDist = 28 / this.camera.zoom;
      const rc = this.getRotateHandlePos();
      if (rc) {
        ctx.save();
        ctx.strokeStyle = t.selectionColor;
        ctx.lineWidth = 1.5 / this.camera.zoom;
        const topCenter = { x: bounds.x + bounds.w / 2, y: bounds.y - pad };
        const from = (el.rotation ?? 0) !== 0 ? this.rotatePoint(topCenter, this.getRotationCenter(el), el.rotation ?? 0) : topCenter;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(rc.x, rc.y);
        ctx.stroke();
        const circleR = 5 / this.camera.zoom;
        ctx.beginPath();
        ctx.arc(rc.x, rc.y, circleR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    ctx.restore();
  }
  }

renderTextPreview(content: string, worldX: number, worldY: number, fontSize: number, fontFamily: string, color: string): void {
    const ctx = this.liveCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = content.split('\n');
    const lineHeight = fontSize * 1.4;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], worldX, worldY + i * lineHeight);
    }
    ctx.restore();
  }

drawImage(ctx: CanvasRenderingContext2D, el: ImageElement): void {
    let cached = this.imageCache.get(el.src);
    if (!cached) {
      cached = new Image();
      cached.src = el.src;
      this.imageCache.set(el.src, cached);
      if (!cached.complete) {
        cached.onload = () => this.renderAll();
      }
    }
    if (cached.complete && cached.naturalWidth > 0) {
      ctx.drawImage(cached, el.position.x, el.position.y, el.width, el.height);
    }
  }

};
