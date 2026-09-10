import type { BlackboardBase } from '../../base';
import { IS_MOBILE } from '../../../utils';
import { THEMES } from '../../../theme';

export function flushLive(bb: BlackboardBase): void {
    const ctx = bb.liveCtx;
    ctx.clearRect(0, 0, bb.width, bb.height);
    ctx.save();
    ctx.scale(bb.camera.zoom, bb.camera.zoom);
    ctx.translate(-bb.camera.x, -bb.camera.y);
    if (bb.currentElement) bb.drawElement(ctx, bb.currentElement);
    bb.drawSelectionIndicators(ctx);
    bb.drawAlignmentGuides(ctx);
    bb.drawLaserStrokes(ctx);
    bb.drawRemoteCursors(ctx);
    if (bb.marqueeStart && bb.marqueeEnd) {
      const t = THEMES[bb.theme];
      const x = Math.min(bb.marqueeStart.x, bb.marqueeEnd.x);
      const y = Math.min(bb.marqueeStart.y, bb.marqueeEnd.y);
      const w = Math.abs(bb.marqueeEnd.x - bb.marqueeStart.x);
      const h = Math.abs(bb.marqueeEnd.y - bb.marqueeStart.y);
      ctx.fillStyle = t.selectionFill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = t.selectionColor;
      ctx.lineWidth = 1 / bb.camera.zoom;
      ctx.setLineDash([4 / bb.camera.zoom, 4 / bb.camera.zoom]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    
    if (bb.activeTool === 'eraser' && bb.lastPointerWorld) {
      const eraserRadius = (IS_MOBILE() ? bb.strokeWidth * 3.5 : bb.strokeWidth * 2.5);
      ctx.beginPath();
      ctx.arc(bb.lastPointerWorld.x, bb.lastPointerWorld.y, eraserRadius, 0, Math.PI * 2);
      ctx.strokeStyle = THEMES[bb.theme].selectionColor;
      ctx.lineWidth = 1 / bb.camera.zoom;
      ctx.stroke();
    }
    ctx.restore();
  }