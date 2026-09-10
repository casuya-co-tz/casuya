import type { Stroke, Shape, LaTeXElement, TextElement, ImageElement, Element } from '../../types';
import { IS_MOBILE } from '../../utils';
import { THEMES } from '../../theme';
import { BlackboardBase, Constructor } from '../base';
import { drawFreehandStroke } from './render-elements/freehand';
import { drawTextOnContext } from './render-elements/text';
import { drawSmoothShape } from './render-elements/smooth-shapes';
import { drawRoughShapeOnContext } from './render-elements/rough-shapes';

export const RenderElementsMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class RenderElementsTrait extends Base {
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
    drawFreehandStroke(ctx, stroke);
  }

drawText(ctx: CanvasRenderingContext2D, el: TextElement): void {
    drawTextOnContext(ctx, el);
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
    drawSmoothShape(ctx, shape, this.roundRect);
  }

drawRoughShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
    drawRoughShapeOnContext(ctx, shape, this.roughness, seed => this.seededRandom(seed));
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