import type { Point, Shape, Stroke, Tool } from '../../../types';
import { uid } from '../../../utils';

export function createLaserStroke(point: Point, width: number): Stroke {
  return {
    id: uid(),
    tool: 'laser',
    points: [point],
    color: '#ef4444',
    width,
    opacity: 1,
    createdAt: Date.now(),
  } as Stroke;
}

export function createEraserStroke(point: Point, width: number): Stroke {
  return {
    id: uid(),
    tool: 'eraser',
    points: [point],
    color: '#000000',
    width,
    opacity: 1,
  };
}

export function createPenStroke(point: Point, width: number, color: string, opacity: number): Stroke {
  return {
    id: uid(),
    tool: 'pen',
    points: [point],
    color,
    width,
    opacity,
  };
}

export function createHighlighterStroke(point: Point, width: number, color: string): Stroke {
  return {
    id: uid(),
    tool: 'highlighter',
    points: [point],
    color,
    width,
    opacity: 0.3,
  };
}

export interface ShapeCreationOptions {
  tool: Tool;
  color: string;
  width: number;
  opacity: number;
  filled?: boolean;
  roughness?: number;
  dashPattern?: number[];
  cornerRadius?: number;
}

export function createShapeElement(start: Point, options: ShapeCreationOptions): Shape {
  return {
    id: uid(),
    tool: options.tool as Shape['tool'],
    start,
    end: start,
    color: options.color,
    width: options.width,
    opacity: options.opacity,
    filled: options.filled,
    roughness: options.roughness,
    ...(options.dashPattern ? { dashPattern: options.dashPattern } : {}),
    ...(options.cornerRadius && options.cornerRadius > 0 ? { cornerRadius: options.cornerRadius } : {}),
  };
}