import type { Element, ImageElement, LaTeXElement, Point, Shape, Stroke, TextElement } from '../../../types';
import type { Bounds } from './content-bounds';

export interface SVGHelpers {
  getRotationCenter: (el: Element) => Point;
  wordWrapTextForSVG: (text: string, fontSize: number, maxWidth: number, fontFamily?: string) => string[];
}

const rotateAttr = (el: Element, rotation: number, helpers: SVGHelpers): string =>
  rotation !== 0
    ? ` transform="rotate(${rotation * 180 / Math.PI}, ${helpers.getRotationCenter(el).x}, ${helpers.getRotationCenter(el).y})"`
    : '';

export function elementToSVG(el: Element, helpers: SVGHelpers): string {
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
    const rot = rotateAttr(el, rotation, helpers);
    return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"${rot}${opAttr}/>`;
  }
  if (el.tool === 'line') {
    const s = el as Shape;
    const rot = rotateAttr(el, rotation, helpers);
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
    const rot = rotateAttr(el, rotation, helpers);
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
    const rot = rotateAttr(el, rotation, helpers);
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
    const rot = rotateAttr(el, rotation, helpers);
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
    const rot = rotateAttr(el, rotation, helpers);
    return `<polygon points="${dcx},${dcy - hh} ${dcx + hw},${dcy} ${dcx},${dcy + hh} ${dcx - hw},${dcy}" stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
  }
  if (el.tool === 'katex') {
    const k = el as LaTeXElement;
    const rot = rotateAttr(el, rotation, helpers);
    return `<text x="${k.position.x}" y="${k.position.y}" font-size="${k.fontSize}" font-family="'Courier New', monospace" fill="${k.color}" dominant-baseline="hanging"${rot}${op}>${k.latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
  }
  if (el.tool === 'text') {
    const t = el as TextElement;
    const lines = helpers.wordWrapTextForSVG(t.content, t.fontSize, t.width > 1 ? t.width : 300, t.fontFamily);
    const lineHeight = t.fontSize * 1.4;
    const tspans = lines.map((line, i) =>
      `<tspan x="${t.position.x}" dy="${i === 0 ? 0 : lineHeight}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`
    ).join('');
    const rot = rotateAttr(el, rotation, helpers);
    return `<text x="${t.position.x}" y="${t.position.y}" font-size="${t.fontSize}" font-family="${t.fontFamily}" fill="${t.color}" dominant-baseline="hanging"${rot}${op}>${tspans}</text>`;
  }
  if (el.tool === 'image') {
    const img = el as ImageElement;
    const rot = rotateAttr(el, rotation, helpers);
    return `<image href="${img.src}" x="${img.position.x}" y="${img.position.y}" width="${img.width}" height="${img.height}"${rot}${op}/>`;
  }
  return '';
}

export function buildSVG(parts: string[], bounds: Bounds | null, fallbackWidth: number, fallbackHeight: number): string {
  let vx = 0, vy = 0, vw = fallbackWidth, vh = fallbackHeight;
  if (bounds) {
    const pad = 10;
    vx = bounds.x - pad;
    vy = bounds.y - pad;
    vw = bounds.w + pad * 2;
    vh = bounds.h + pad * 2;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">${parts.join('\n')}</svg>`;
}