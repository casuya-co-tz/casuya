import type { Point, Viewport, BoundingBox } from './types';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.1;

export function screenToCanvas(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.scrollX) / viewport.zoom,
    y: (point.y - viewport.scrollY) / viewport.zoom,
  };
}

export function canvasToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.scrollX,
    y: point.y * viewport.zoom + viewport.scrollY,
  };
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function boundsForStroke(points: Point[]): BoundingBox {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsForShape(start: Point, end: Point): BoundingBox {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function boundsForText(x: number, y: number, text: string, fontSize: number): BoundingBox {
  const approxWidth = text.length * fontSize * 0.6;
  const approxHeight = fontSize * 1.3;
  return { x, y, width: approxWidth, height: approxHeight };
}

export function pointInBounds(point: Point, bounds: BoundingBox, padding = 4): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

export function translateBounds(bounds: BoundingBox, dx: number, dy: number): BoundingBox {
  return { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height };
}
