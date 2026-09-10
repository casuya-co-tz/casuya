import type { Shape } from '../../../types';

export function drawSmoothShape(ctx: CanvasRenderingContext2D, shape: Shape, roundRect: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => void): void {
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
        if (cr > 0) { roundRect(ctx, rx, ry, rw, rh, cr); ctx.fill(); }
        else ctx.fillRect(rx, ry, rw, rh);
        ctx.globalAlpha = shape.opacity;
      }
      if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
      if (cr > 0) { roundRect(ctx, rx, ry, rw, rh, cr); ctx.stroke(); }
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