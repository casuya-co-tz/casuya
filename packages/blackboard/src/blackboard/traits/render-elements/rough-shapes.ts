import type { Shape } from '../../../types';

export function drawRoughShapeOnContext(ctx: CanvasRenderingContext2D, shape: Shape, defaultRoughness: number, seededRandom: (seed: number) => () => number): void {
  const roughLevel = shape.roughness ?? defaultRoughness;
  const maxOffset = roughLevel * 1.5;
  const passes = roughLevel + 1;
  const seedVal = shape.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seedVal);
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