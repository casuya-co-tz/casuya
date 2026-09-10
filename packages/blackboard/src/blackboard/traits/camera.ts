import type { Camera, Point } from '../../types';
import { BlackboardBase, Constructor } from '../base';

export const CameraMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class CameraTrait extends Base {
camera: Camera = { x: 0, y: 0, zoom: 1 };

isSpaceDown = false;

isPanning = false;

panStart = { x: 0, y: 0 };

panCameraStart = { x: 0, y: 0 };

pinchStartDist = 0;

pinchStartZoom = 1;

pinchCenter: Point = { x: 0, y: 0 };

pinchStartCamera: Point = { x: 0, y: 0 };

activePointerId: number | null = null;

activePointerType: string = 'mouse';

activePointers: Map<number, { x: number; y: number; type: string }> = new Map();

getPoint = (e: PointerEvent): Point => {
    const rect = this.liveCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { ...this.screenToWorld(sx, sy), pressure: e.pressure };
  };

onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.liveCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldBefore = this.screenToWorld(sx, sy);
    const delta = -e.deltaY;
    const factor = Math.pow(1.001, delta);
    this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom * factor));
    const worldAfter = this.screenToWorld(sx, sy);
    this.camera.x += worldBefore.x - worldAfter.x;
    this.camera.y += worldBefore.y - worldAfter.y;
    this.graphDirty = true;
    this.renderAll();
    this.updateToolbar();
  };
};