import type { Point } from './types';

export const IS_MOBILE = (): boolean => window.innerWidth <= 640;

export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  }
}

export function isInInput(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.closest('input, textarea, [contenteditable="true"], select') !== null;
}

/** Reduce a stroke's point count by dropping points closer than minDist. */
export function downsampleStroke(points: Point[], minDist: number): Point[] {
  if (points.length < 2) return [...points];
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const p = points[i];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) {
      result.push(p);
    }
  }
  if (result.length < 2 && points.length >= 2) {
    result.push(points[points.length - 1]);
  }
  return result;
}
