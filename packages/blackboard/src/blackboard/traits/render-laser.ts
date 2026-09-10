import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const RenderLaserMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class RenderLaserTrait extends Base {
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

animateLaser = (): void => {
    this.laserAnimFrame = null;
    const now = Date.now();
    const FADE_MS = 2000;
    this.laserStrokes = this.laserStrokes.filter(s => now - s.createdAt < FADE_MS);
    if (this.laserStrokes.length > 0) {
      this.laserAnimFrame = requestAnimationFrame(this.animateLaser);
    }
    this.flushLive();
  };
};
