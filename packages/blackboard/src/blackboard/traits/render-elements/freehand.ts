import type { Stroke } from '../../../types';

export function drawFreehandStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
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