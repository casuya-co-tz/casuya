import { IS_MOBILE } from '../../utils';
import { THEMES } from '../../theme';
import { BlackboardBase, Constructor } from '../base';

export const RenderSelectionMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class RenderSelectionTrait extends Base {
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
};