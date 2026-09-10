import { IS_MOBILE } from '../../utils';
import { THEMES } from '../../theme';
import { BlackboardBase, Constructor } from '../base';

export const RenderCanvasMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class RenderCanvasTrait extends Base {
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
      ctx.drawImage(this.graphCanvas!, 0, 0, this.width * this.dpr, this.height * this.dpr, 0, 0, this.width, this.height);
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
};