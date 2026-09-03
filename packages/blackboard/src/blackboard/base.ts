import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../types';
import { IS_MOBILE, uid, isInInput } from '../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../theme';
import { createToolbar, updateToolbarState } from '../toolbar';
export type Constructor<T = {}> = new (...args: any[]) => T;

export class BlackboardBase {
container: HTMLElement;

root: HTMLDivElement;

canvasWrapper: HTMLDivElement;

staticCanvas: HTMLCanvasElement;

liveCanvas: HTMLCanvasElement;

staticCtx: CanvasRenderingContext2D;

liveCtx: CanvasRenderingContext2D;

width: number;

height: number;

dpr: number;

activeTool: Tool = 'pen';

strokeColor = '#1e293b';

strokeWidth = 2;

strokeOpacity = 1;

fillEnabled = false;

dashEnabled = false;

pixelEraser = false;

fontFamily = 'system-ui, -apple-system, sans-serif';

cornerRadius = 0;

clipboardData = '';

static instanceCount = 0;

imagePool: string[] = [];

imageSrcToIdx = new Map<string, number>();

elements: Element[] = [];

undoStack: Element[][] = [];

redoStack: Element[][] = [];

static readonly MAX_UNDO = 50;

currentElement: Element | null = null;

isDrawing = false;

graph: GraphConfig;

animFrameId: number | null = null;

dirty = false;

toolbar: ToolbarElements;

listeners: Map<string, Set<BlackboardEventCallback>> = new Map();

theme: 'light' | 'dark' = 'light';

camera: Camera = { x: 0, y: 0, zoom: 1 };

selectedIds: Set<string> = new Set();

dragState: { type: 'move' | 'resize' | 'rotate'; startWorld: Point; origElements: Element[]; handle?: string } | null = null;

isSpaceDown = false;

isPanning = false;

panStart = { x: 0, y: 0 };

panCameraStart = { x: 0, y: 0 };

textInput: HTMLTextAreaElement | null = null;

editingTextId: string | null = null;

editingTextOriginal: TextElement | null = null;

editingShapeId: string | null = null;

activePointerId: number | null = null;

activePointerType: string = 'mouse';

lastPointerWorld: Point | null = null;

activePointers: Map<number, { x: number; y: number; type: string }> = new Map();

pinchStartDist = 0;

pinchStartZoom = 1;

pinchCenter: Point = { x: 0, y: 0 };

pinchStartCamera: Point = { x: 0, y: 0 };

contextMenu: HTMLDivElement | null = null;

helpOverlay: HTMLDivElement | null = null;

longPressTimer: ReturnType<typeof setTimeout> | null = null;

longPressStart: Point | null = null;

boundHandleImagePaste: (e: ClipboardEvent) => void;

boundHandleDragOver: (e: DragEvent) => void;

boundHandleFileDrop: (e: DragEvent) => void;

fontSize = 18;

clipboard: Element[] = [];

roughness = 0;

alignmentGuides: { x?: number; y?: number } = {};

imageCache = new Map<string, HTMLImageElement>();

resizeObserver: ResizeObserver | null = null;

graphCanvas: HTMLCanvasElement | null = null;

graphCtx: CanvasRenderingContext2D | null = null;

graphDirty = true;

marqueeStart: Point | null = null;

marqueeEnd: Point | null = null;

autosaveTimer: ReturnType<typeof setInterval> | null = null;

autosaveKey = 'casuya-blackboard';

dirtySinceSave = false;

boundBeforeUnload: ((e: BeforeUnloadEvent) => void) | null = null;

toastTimeout: ReturnType<typeof setTimeout> | null = null;

usePressure = false;

contextMenuKeyHandler: ((e: KeyboardEvent) => void) | null = null;

laserStrokes: { id: string; points: Point[]; color: string; width: number; opacity: number; createdAt: number }[] = [];

laserAnimFrame: number | null = null;

katexImageCache = new Map<string, HTMLImageElement>();

presenterMode = false;

presenterStep = 0;

presenterOverlay: HTMLDivElement | null = null;

collabAdapter: CollabAdapter | null = null;

collabState: CollabState | null = null;

remoteCursors = new Map<string, { user: CollabUser; cursor: Point }>();

constructor(options: BlackboardOptions) {
    BlackboardBase.instanceCount++;
    this.container = options.container;
    this.autosaveKey = `casuya-blackboard-${BlackboardBase.instanceCount}`;
    this.width = options.width || this.container.clientWidth || 800;
    this.height = options.height || this.container.clientHeight || 600;
    this.dpr = window.devicePixelRatio || 1;
    this.theme = options.theme || 'light';

    injectMobileStyles();

    this.boundHandleImagePaste = this.handleImagePaste.bind(this);
    this.boundHandleDragOver = this.handleDragOver.bind(this);
    this.boundHandleFileDrop = this.handleFileDrop.bind(this);

    this.graph = {
      enabled: options.graph?.enabled ?? false,
      spacing: options.graph?.spacing ?? 25,
      color: options.graph?.color ?? '#e2e8f0',
      showAxes: options.graph?.showAxes ?? true,
      showLabels: options.graph?.showLabels ?? true,
    };
    this.strokeColor = options.color || this.strokeColor;
    this.strokeWidth = options.strokeWidth || this.strokeWidth;
    if (options.width) this.width = options.width;
    if (options.height) this.height = options.height;
    this.dpr = window.devicePixelRatio || 1;

    const mobile = IS_MOBILE();
    this.root = document.createElement('div');
    this.root.className = 'casuya-blackboard';
    this.root.style.cssText = `
      display: flex;
      flex-direction: column;
      border-radius: ${mobile ? 8 : 12}px;
      overflow: hidden;
      box-shadow: ${mobile ? '0 2px 8px rgba(0,0,0,0.06)' : '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'};
      background: ${THEMES[this.theme].canvasBg};
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      width: 100%;
      height: 100%;
      touch-action: none;
      -webkit-touch-callout: none;
    `;

    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.style.cssText = 'position: relative; overflow: hidden; flex: 1;';

    this.staticCanvas = document.createElement('canvas');
    this.liveCanvas = document.createElement('canvas');

    [this.staticCanvas, this.liveCanvas].forEach(c => {
      c.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        touch-action: none;
      `;
    });

    this.staticCanvas.style.zIndex = '0';
    this.liveCanvas.style.zIndex = '1';

    this.canvasWrapper.appendChild(this.staticCanvas);
    this.canvasWrapper.appendChild(this.liveCanvas);

    this.toolbar = createToolbar(this);
    this.root.appendChild(this.toolbar.bar);
    this.root.appendChild(this.canvasWrapper);
    this.container.appendChild(this.root);

    if (!this.container.style.position) {
      this.container.style.position = 'relative';
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            this.resize(Math.floor(w), Math.floor(h));
          }
        }
      });
      this.resizeObserver.observe(this.canvasWrapper);
    }

    this.staticCtx = this.staticCanvas.getContext('2d')!;
    this.liveCtx = this.liveCanvas.getContext('2d')!;

    this.setupCanvases();
    this.attachEvents();
    this.setTool('pen');
    this.renderAll();
    this.updateToolbar();

    this.autosaveTimer = setInterval(() => {
      if (this.dirtySinceSave) {
        this.saveToStorage(this.autosaveKey);
        this.dirtySinceSave = false;
      }
    }, 30000);

    this.boundBeforeUnload = (e: BeforeUnloadEvent) => {
      if (this.dirtySinceSave) {
        this.saveToStorage(this.autosaveKey);
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    this.loadFromStorage(this.autosaveKey);

    setTimeout(() => this.showToast('Select a tool and start drawing'), 600);
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

onScrollDismiss = (): void => { this.dismissContextMenu(); };

onResizeDismiss = (): void => { this.dismissContextMenu(); };

getPoint = (e: PointerEvent): Point => {
    const rect = this.liveCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { ...this.screenToWorld(sx, sy), pressure: e.pressure };
  };

onPointerDown = (e: PointerEvent): void => {
    this.dismissContextMenu();

    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (this.activePointers.size === 2) {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.currentElement = null;
        this.flushLive();
      }
      this.startPinch();
      return;
    }
    if (this.activePointers.size > 2) {
      return;
    }

    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) {
      if (e.pointerType === 'pen' && this.activePointerType === 'touch') {
        this.releasePointerCapture();
      } else {
        return;
      }
    }

    if (e.pointerType === 'touch' && this.activePointerType === 'pen' && this.isDrawing) {
      return;
    }
    
    e.preventDefault();
    try { this.liveCanvas.setPointerCapture(e.pointerId); } catch {}
    this.activePointerId = e.pointerId;
    this.activePointerType = e.pointerType;
    
    const point = this.getPoint(e);

    if (e.pointerType === 'touch' && this.activeTool === 'select') {
      this.longPressStart = point;
      this.longPressTimer = setTimeout(() => {
        if (this.longPressStart) {
          const hit = this.hitTest(this.longPressStart);
          if (hit) {
            if (!this.selectedIds.has(hit.id)) {
              this.selectedIds.clear();
              this.selectedIds.add(hit.id);
              this.renderAll();
            }
            this.isDrawing = false;
            this.currentElement = null;
            this.showContextMenu(e.clientX, e.clientY);
          }
        }
      }, 500);
    }

    if (this.activeTool === 'hand' || (this.isSpaceDown && !this.isPanning)) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.panCameraStart = { x: this.camera.x, y: this.camera.y };
      return;
    }

    if (this.activeTool === 'select') {
      const handle = this.getHandleAtPoint(point);
      if (handle === 'rotate') {
        this.pushUndo();
        this.dragState = { type: 'rotate', startWorld: point, origElements: JSON.parse(JSON.stringify(this.elements)) };
        this.renderAll();
        return;
      }
      if (handle) {
        this.pushUndo();
        this.dragState = { type: 'resize', startWorld: point, origElements: JSON.parse(JSON.stringify(this.elements)), handle };
        this.renderAll();
        return;
      }
      const hit = this.hitTest(point);
        if (hit) {
          if (e.shiftKey) {
            if (this.selectedIds.has(hit.id)) {
              this.selectedIds.delete(hit.id);
            } else {
              if (hit.groupId) {
                for (const el of this.elements) {
                  if (el.groupId === hit.groupId) this.selectedIds.add(el.id);
                }
              } else {
                this.selectedIds.add(hit.id);
              }
            }
            this.renderAll();
            return;
          }
          if (!this.selectedIds.has(hit.id)) {
            this.selectedIds.clear();
            if (hit.groupId) {
              for (const el of this.elements) {
                if (el.groupId === hit.groupId) this.selectedIds.add(el.id);
              }
            } else {
              this.selectedIds.add(hit.id);
            }
          }
        this.pushUndo();
        this.dragState = { type: 'move', startWorld: point, origElements: JSON.parse(JSON.stringify(this.elements)) };
      } else {
        if (!e.shiftKey) this.selectedIds.clear();
        this.marqueeStart = point;
        this.marqueeEnd = point;
      }
      this.renderAll();
      return;
    }

    if (this.activeTool === 'text') {
      const hit = this.hitTest(point);
      if (hit && hit.tool === 'text') {
        this.startTextEdit(hit.position.x, hit.position.y, hit as TextElement);
      } else {
        this.startTextEdit(point.x, point.y);
      }
      return;
    }

    if (this.activeTool === 'laser') {
      this.isDrawing = true;
      this.currentElement = {
        id: uid(),
        tool: 'laser',
        points: [point],
        color: '#ef4444',
        width: this.strokeWidth,
        opacity: 1,
        createdAt: Date.now(),
      } as Stroke;
      return;
    }
    
    if (this.activeTool === 'eraser') {
      if (this.pixelEraser) {
        this.pushUndo();
        this.isDrawing = true;
        this.currentElement = {
          id: uid(),
          tool: 'eraser',
          points: [point],
          color: '#000000',
          width: this.strokeWidth * 3,
          opacity: 1,
        };
        return;
      }
      this.pushUndo();
      this.isDrawing = true;
      this.lastPointerWorld = point;
      this.renderAll();
      return;
    }

    this.isDrawing = true;

    if (e.pointerType === 'pen') this.usePressure = true;

    if (this.activeTool === 'pen' || this.activeTool === 'highlighter') {
      this.currentElement = {
        id: uid(),
        tool: this.activeTool === 'highlighter' ? 'highlighter' : 'pen',
        points: [point],
        color: this.strokeColor,
        width: this.activeTool === 'highlighter' ? this.strokeWidth * 3 : this.strokeWidth,
        opacity: this.activeTool === 'highlighter' ? 0.3 : this.strokeOpacity,
      };
    } else {
      const snapped = this.snapToGrid(point);
      this.currentElement = {
        id: uid(),
        tool: this.activeTool,
        start: snapped,
        end: snapped,
        color: this.strokeColor,
        width: this.strokeWidth,
        opacity: this.strokeOpacity,
        filled: this.fillEnabled,
        roughness: this.roughness,
        ...(this.dashEnabled ? { dashPattern: [8, 4] } : {}),
        ...(this.cornerRadius > 0 ? { cornerRadius: this.cornerRadius } : {}),
      };
    }
  };

onPointerMove = (e: PointerEvent): void => {
    if (this.longPressTimer && this.longPressStart) {
      const dx = e.clientX - this.longPressStart.x;
      const dy = e.clientY - this.longPressStart.y;
      if (Math.hypot(dx, dy) > 10) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.longPressStart = null;
      }
    }
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    }
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = this.liveCanvas.getBoundingClientRect();
      const curCenter = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
      if (this.pinchStartDist > 0) {
        const newZoom = this.pinchStartZoom * (dist / this.pinchStartDist);
        this.zoomTo(newZoom, this.pinchCenter);
        const panDx = (curCenter.x - this.pinchCenter.x) / this.camera.zoom;
        const panDy = (curCenter.y - this.pinchCenter.y) / this.camera.zoom;
        this.camera.x = this.pinchStartCamera.x - panDx;
        this.camera.y = this.pinchStartCamera.y - panDy;
        this.graphDirty = true;
        this.renderAll();
        this.updateToolbar();
      }
      return;
    }

    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;

    if (this.isPanning) {
      const dx = (e.clientX - this.panStart.x) / this.camera.zoom;
      const dy = (e.clientY - this.panStart.y) / this.camera.zoom;
      this.camera.x = this.panCameraStart.x - dx;
      this.camera.y = this.panCameraStart.y - dy;
      this.graphDirty = true;
      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.dragState?.type === 'rotate') {
      const point = this.getPoint(e);
      const id = this.selectedIds.values().next().value!;
      const el = this.elements.find(e => e.id === id);
      if (el) {
        const center = this.getRotationCenter(el);
        const origAngle = Math.atan2(this.dragState.startWorld.y - center.y, this.dragState.startWorld.x - center.x);
        const curAngle = Math.atan2(point.y - center.y, point.x - center.x);
        const deltaAngle = curAngle - origAngle;
        const origEl = this.dragState.origElements.find(e => e.id === id);
        if (origEl) {
          el.rotation = ((origEl.rotation ?? 0) + deltaAngle) % (Math.PI * 2);
        }
      }
      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.dragState?.type === 'resize') {
      const point = this.getPoint(e);
      this.resizeSelected(this.dragState.handle!, point);
      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.dragState?.type === 'move') {
      const point = this.getPoint(e);
      const dx = point.x - this.dragState.startWorld.x;
      const dy = point.y - this.dragState.startWorld.y;
      this.moveSelectedElements(dx, dy);

      let combinedBounds = { x: Infinity, y: Infinity, w: 0, h: 0 };
      let hasBounds = false;
      for (const id of this.selectedIds) {
        const el = this.elements.find(e => e.id === id);
        if (!el) continue;
        const b = this.getElementBounds(el);
        if (!hasBounds) {
          combinedBounds = { x: b.x, y: b.y, w: b.w, h: b.h };
          hasBounds = true;
        } else {
          const nx = Math.min(combinedBounds.x, b.x);
          const ny = Math.min(combinedBounds.y, b.y);
          combinedBounds = {
            x: nx, y: ny,
            w: Math.max(combinedBounds.x + combinedBounds.w, b.x + b.w) - nx,
            h: Math.max(combinedBounds.y + combinedBounds.h, b.y + b.h) - ny,
          };
        }
      }
      if (hasBounds) {
        this.alignmentGuides = this.findAlignmentGuides(combinedBounds);
      }

      this.renderAll();
      return;
    }

    if (this.activeTool === 'select' && this.marqueeStart) {
      this.marqueeEnd = this.getPoint(e);
      this.renderAll();
      return;
    }

    if (this.activeTool === 'eraser' && this.isDrawing) {
      if (this.pixelEraser && this.currentElement) {
        const events = (e as any).getCoalescedEvents?.() ?? [e];
        for (const ce of events) {
          const p = this.getPoint(ce as PointerEvent);
          const pts = (this.currentElement as Stroke).points;
          const last = pts[pts.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
            pts.push(p);
          }
        }
        this.dirty = true;
        if (!this.animFrameId) this.animFrameId = requestAnimationFrame(this.flush);
        return;
      }
      const point = this.getPoint(e);
      this.lastPointerWorld = point;
      const hitDist = IS_MOBILE() ? this.strokeWidth * 3.5 : this.strokeWidth * 2.5;
      const toRemove: string[] = [];
      for (const el of this.elements) {
        if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
          const stroke = el as Stroke;
          const rotation = (stroke as any).rotation ?? 0;
          const center = this.getRotationCenter(stroke);
          const localPoint = rotation !== 0 ? this.rotatePoint(point, center, -rotation) : point;
          const hit = stroke.points.some(p => Math.hypot(p.x - localPoint.x, p.y - localPoint.y) < hitDist);
          if (hit) toRemove.push(el.id);
        } else {
          const bounds = this.getElementBounds(el);
          const pad = hitDist;
          if (point.x >= bounds.x - pad && point.x <= bounds.x + bounds.w + pad &&
              point.y >= bounds.y - pad && point.y <= bounds.y + bounds.h + pad) {
            toRemove.push(el.id);
          }
        }
      }
      if (toRemove.length > 0) {
        const kill = new Set(toRemove);
        this.elements = this.elements.filter(e => !kill.has(e.id));
        this.renderStatic();
        this.emit('change');
      }
      this.dirty = true;
      if (!this.animFrameId) this.animFrameId = requestAnimationFrame(this.flush);
      return;
    }

    if (!this.isDrawing || !this.currentElement) return;
    e.preventDefault();

    if (this.currentElement.tool === 'pen' || this.currentElement.tool === 'highlighter' || this.currentElement.tool === 'laser') {
      const events = (e as any).getCoalescedEvents?.() ?? [e];
      for (const ce of events) {
        const p = this.getPoint(ce as PointerEvent);
        const pts = this.currentElement.points;
        const last = pts[pts.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
          pts.push(p);
        }
      }
    } else {
      const point = this.getPoint(e);
      const shape = this.currentElement as Shape;
      let endPoint = this.snapToGrid(point);
      if (shape.tool === 'arrow') {
        const conn = this.findNearestEdgePoint(endPoint, this.currentElement?.id);
        if (conn) endPoint = conn;
      }
      shape.end = endPoint;
      
      if (e.shiftKey && 'start' in this.currentElement) {
        const dx = shape.end.x - shape.start.x;
        const dy = shape.end.y - shape.start.y;
        if (shape.tool === 'rect' || shape.tool === 'diamond') {
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          shape.end = { x: shape.start.x + size * Math.sign(dx || 1), y: shape.start.y + size * Math.sign(dy || 1) };
        } else if (shape.tool === 'circle') {
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          shape.end = { x: shape.start.x + size * Math.sign(dx || 1), y: shape.start.y + size * Math.sign(dy || 1) };
        } else if (shape.tool === 'line' || shape.tool === 'arrow') {
          const angle = Math.atan2(dy, dx);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          shape.end = { x: shape.start.x + len * Math.cos(snapped), y: shape.start.y + len * Math.sin(snapped) };
        }
      }
    }

    this.dirty = true;
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(this.flush);
    }
  };

onPointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (e.pointerType === 'pen') this.usePressure = false;
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
    this.longPressStart = null;

    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
    this.activePointerId = null;
    this.activePointerType = 'mouse';
    
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (this.activeTool === 'select' && this.dragState) {
      this.alignmentGuides = {};
      this.dragState = null;
      this.emit('change');
      return;
    }

    if (this.activeTool === 'select' && this.marqueeStart && this.marqueeEnd) {
      const mx = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
      const my = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
      const mw = Math.abs(this.marqueeEnd.x - this.marqueeStart.x);
      const mh = Math.abs(this.marqueeEnd.y - this.marqueeStart.y);
      if (mw > 2 / this.camera.zoom || mh > 2 / this.camera.zoom) {
        for (const el of this.elements) {
          const b = this.getElementBounds(el);
          if (b.x >= mx && b.y >= my && b.x + b.w <= mx + mw && b.y + b.h <= my + mh) {
            this.selectedIds.add(el.id);
          }
        }
      }
      this.marqueeStart = null;
      this.marqueeEnd = null;
      this.renderAll();
      return;
    }
    this.marqueeStart = null;
    this.marqueeEnd = null;

    if (this.activeTool === 'eraser' && this.isDrawing) {
      if (this.pixelEraser && this.currentElement) {
        this.isDrawing = false;
        if ((this.currentElement as Stroke).points.length < 2) {
          const p = (this.currentElement as Stroke).points[0];
          (this.currentElement as Stroke).points = [
            { x: p.x, y: p.y, pressure: 0.5 },
            { x: p.x + 0.5, y: p.y + 0.5, pressure: 0.5 },
          ];
      } else {
        (this.currentElement as Stroke).points = this.downsampleStroke((this.currentElement as Stroke).points, 2);
      }
    this.pushUndo();
    this.elements.push(this.currentElement);
      this.currentElement = null;
      this.flushLive();
      this.renderStatic();
      this.updateToolbar();
      this.emit('change');
      return;
    }
    this.isDrawing = false;
    this.lastPointerWorld = null;
    this.renderAll();
    this.updateToolbar();
    return;
  }

  if (!this.isDrawing || !this.currentElement) return;
  this.isDrawing = false;

  if (this.currentElement.tool === 'laser') {
    const laser = this.currentElement as Stroke;
    if (laser.points.length >= 2) {
      this.laserStrokes.push({
        id: laser.id,
        points: [...laser.points],
        color: laser.color,
        width: laser.width,
        opacity: 1,
        createdAt: Date.now(),
      });
      if (!this.laserAnimFrame) this.laserAnimFrame = requestAnimationFrame(this.animateLaser);
    }
    this.currentElement = null;
    return;
  }

  if (this.currentElement.tool === 'pen' || this.currentElement.tool === 'highlighter') {
    if ((this.currentElement as Stroke).points.length < 2) {
      const p = (this.currentElement as Stroke).points[0];
      (this.currentElement as Stroke).points = [
        { x: p.x, y: p.y, pressure: 0.5 },
        { x: p.x + 0.5, y: p.y + 0.5, pressure: 0.5 },
      ];
    } else {
      (this.currentElement as Stroke).points = this.downsampleStroke((this.currentElement as Stroke).points, 2);
    }
    }

    this.pushUndo();
    this.elements.push(this.currentElement);
    if (this.currentElement.tool === 'arrow' || this.currentElement.tool === 'line') {
      this.autoBindArrow(this.currentElement as Shape);
    }
    this.currentElement = null;
    this.flushLive();
    this.renderStatic();
    this.updateToolbar();
    this.emit('change');
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

onKeyDown = (e: KeyboardEvent): void => {
    if (this.textInput) return;
    if (isInInput(e.target)) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      e.shiftKey ? this.redo() : this.undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      this.zoomTo(this.camera.zoom * 1.1);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      this.zoomTo(this.camera.zoom * 0.9);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      this.resetView();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      this.duplicateSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      this.copySelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      this.pasteClipboard();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      this.copySelected();
      this.deleteSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      this.selectAll();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.contextMenu) { this.dismissContextMenu(); return; }
      if (this.selectedIds.size > 0) {
        this.selectedIds.clear();
        this.renderAll();
      } else if (this.isDrawing && this.currentElement) {
        this.isDrawing = false;
        this.currentElement = null;
        this.flushLive();
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (!this.isSpaceDown) {
        this.isSpaceDown = true;
        this.liveCanvas.style.cursor = 'grab';
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteSelected();
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const nudge = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.nudgeSelected(-nudge, 0); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.nudgeSelected(nudge, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.nudgeSelected(0, -nudge); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.nudgeSelected(0, nudge); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === ']') {
      e.preventDefault();
      if (e.shiftKey) this.bringToFront(); else this.bringForward();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '[') {
      e.preventDefault();
      if (e.shiftKey) this.sendToBack(); else this.sendBackward();
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
      e.preventDefault();
      if (this.activeTool === 'text') this.setFontSize(this.fontSize + 2);
      else this.setWidth(this.strokeWidth + 1);
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
      e.preventDefault();
      if (this.activeTool === 'text') this.setFontSize(this.fontSize - 2);
      else this.setWidth(this.strokeWidth - 1);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
      e.preventDefault();
      this.groupSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      this.ungroupSelected();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      const svg = this.exportSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'blackboard.svg'; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      this.exportPNG();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      this.applyStyleToSelected();
      return;
    }

    if (e.shiftKey && e.key === 'R') {
      e.preventDefault();
      this.rotateSelected(Math.PI / 12);
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      this.showShortcutHelp();
      return;
    }

    const keyToolMap: Record<string, Tool> = {
      'v': 'select', 'h': 'hand', 'p': 'pen', 'm': 'highlighter',
      't': 'text', 'l': 'line', 'r': 'rect', 'o': 'circle',
      'a': 'arrow', 'e': 'eraser', 'b': 'laser', 'n': 'diamond'
    };

    if ((e.ctrlKey || e.metaKey) && !['z','+','-','0','d','c','v','x','a','g',']','['].includes(e.key.toLowerCase())) {
      return;
    }

    const tool = keyToolMap[e.key.toLowerCase()];
    if (tool) {
      this.commitText();
      this.setTool(tool);
    }
  };

onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === ' ') {
      this.isSpaceDown = false;
      this.setTool(this.activeTool);
    }
  };

onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const point = this.getPoint(e as any);
    const hit = this.hitTest(point);
    if (hit) {
      if (!this.selectedIds.has(hit.id)) {
        this.selectedIds.clear();
        this.selectedIds.add(hit.id);
        this.renderAll();
      }
    }
    this.showContextMenu(e.clientX, e.clientY);
  };

onDoubleClick = (e: MouseEvent): void => {
    const point = this.getPoint(e as any);
    const hit = this.hitTest(point);
    if (hit && (hit.tool === 'rect' || hit.tool === 'circle' || hit.tool === 'diamond')) {
      const shape = hit as Shape;
      const bounds = this.getElementBounds(shape);
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      if (shape.label) {
        const existingText = this.elements.find(el => el.tool === 'text' && (el as TextElement).content === shape.label);
        if (existingText) {
          this.editingShapeId = shape.id;
          this.startTextEdit((existingText as TextElement).position.x, (existingText as TextElement).position.y, existingText as TextElement);
          return;
        }
      }
      this.editingShapeId = shape.id;
      const world = this.screenToWorld(cx, cy);
      this.startTextEdit(world.x, world.y);
    } else if (hit && (hit.tool === 'line' || hit.tool === 'arrow')) {
      const shape = hit as Shape;
      const mx = (shape.start.x + shape.end.x) / 2;
      const my = (shape.start.y + shape.end.y) / 2;
      const label = prompt('Label for this line/arrow:', shape.label ?? '');
      if (label !== null) {
        this.pushUndo();
        shape.label = label;
        this.renderAll();
        this.emit('change');
      }
    } else if (hit && hit.tool === 'katex') {
      const k = hit as LaTeXElement;
      const newLatex = prompt('Edit LaTeX:', k.latex);
      if (newLatex !== null && newLatex !== k.latex) {
        this.pushUndo();
        k.latex = newLatex;
        this.katexImageCache.clear();
        this.renderAll();
        this.emit('change');
      }
    }
  };

onWindowClick = (): void => {
    this.dismissContextMenu();
  };

flush = (): void => {
    this.animFrameId = null;
    if (!this.dirty) return;
    this.dirty = false;
    this.flushLive();
  };

hintEl: HTMLDivElement | null = null;

  screenToWorld(screenX: number, screenY: number): Point { return undefined as any; }
  worldToScreen(wx: number, wy: number): { x: number; y: number } { return undefined as any; }
  findNearestConnectionPoint(point: Point, excludeId?: string): Point | null { return undefined as any; }
  findNearestEdgePoint(point: Point, excludeId?: string): Point | null { return undefined as any; }
  hitTest(worldPoint: Point): Element | null { return undefined as any; }
  getHandleAtPoint(worldPoint: Point): string | null { return undefined as any; }
  getElementBounds(el: Element): { x: number; y: number; w: number; h: number } { return undefined as any; }
  getLocalBounds(el: Element): { x: number; y: number; w: number; h: number } { return undefined as any; }
  updateBoundArrows(): void { return undefined as any; }
  drawLaserStrokes(ctx: CanvasRenderingContext2D): void { return undefined as any; }
  setupCanvases(): void { return undefined as any; }
  renderAll(): void { return undefined as any; }
  renderStatic(): void { return undefined as any; }
  ensureGraphCanvas(): void { return undefined as any; }
  renderGraphToOffscreen(): void { return undefined as any; }
  drawGraph(ctx: CanvasRenderingContext2D): void { return undefined as any; }
  drawElement(ctx: CanvasRenderingContext2D, el: Element): void { return undefined as any; }
  drawFreehand(ctx: CanvasRenderingContext2D, stroke: Stroke): void { return undefined as any; }
  drawText(ctx: CanvasRenderingContext2D, el: TextElement): void { return undefined as any; }
  drawLaTeX(ctx: CanvasRenderingContext2D, el: LaTeXElement): void { return undefined as any; }
  drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void { return undefined as any; }
  drawRoughShape(ctx: CanvasRenderingContext2D, shape: Shape): void { return undefined as any; }
  drawSelectionIndicators(ctx: CanvasRenderingContext2D): void { return undefined as any; }
  renderTextPreview(content: string, worldX: number, worldY: number, fontSize: number, fontFamily: string, color: string): void { return undefined as any; }
  drawImage(ctx: CanvasRenderingContext2D, el: ImageElement): void { return undefined as any; }
  pushUndo(): void { return undefined as any; }
  downsampleStroke(points: Point[], minDist: number): Point[] { return undefined as any; }
  getRotateHandlePos(): Point | null { return undefined as any; }
  rotatePoint(point: Point, center: Point, angle: number): Point { return undefined as any; }
  getRotatedCorners(bounds: { x: number; y: number; w: number; h: number }, rotation: number): Point[] { return undefined as any; }
  moveSelectedElements(dx: number, dy: number): void { return undefined as any; }
  findShapeEdgeForPoint(el: Element, point: Point): Point | null { return undefined as any; }
  resizeSelected(handle: string, currentWorld: Point): void { return undefined as any; }
  deleteSelected(): void { return undefined as any; }
  startTextEdit(worldX: number, worldY: number, existing?: TextElement): void { return undefined as any; }
  cancelText(): void { return undefined as any; }
  commitText(): void { return undefined as any; }
  setTool(tool: Tool): void { return undefined as any; }
  getTool(): Tool { return undefined as any; }
  setColor(color: string): void { return undefined as any; }
  getColor(): string { return undefined as any; }
  setFill(enabled: boolean): void { return undefined as any; }
  getFill(): boolean { return undefined as any; }
  getPixelEraser(): boolean { return undefined as any; }
  setPixelEraser(enabled: boolean): void { return undefined as any; }
  getClipboard(): string { return undefined as any; }
  setClipboard(data: string): void { return undefined as any; }
  isGraphEnabled(): boolean { return undefined as any; }
  enableGraph(options?: Partial<GraphConfig>): void { return undefined as any; }
  disableGraph(): void { return undefined as any; }
  undo(): void { return undefined as any; }
  redo(): void { return undefined as any; }
  nudgeSelected(dx: number, dy: number): void { return undefined as any; }
  duplicateSelected(): void { return undefined as any; }
  rotateSelected(angle: number): void { return undefined as any; }
  getSelectedRotation(): number { return undefined as any; }
  copySelected(): void { return undefined as any; }
  pasteClipboard(): void { return undefined as any; }
  selectAll(): void { return undefined as any; }
  applyStyleToSelected(): void { return undefined as any; }
  resize(width: number, height: number): void { return undefined as any; }
  cleanImagePool(): void { return undefined as any; }
  handleImagePaste(e: ClipboardEvent): void { return undefined as any; }
  groupSelected(): void { return undefined as any; }
  ungroupSelected(): void { return undefined as any; }
  wordWrapTextForSVG(text: string, fontSize: number, maxWidth: number, fontFamily = 'system-ui, -apple-system, sans-serif'): string[] { return undefined as any; }
  insertLaTeX(latex: string): void { return undefined as any; }
  attachEvents(): void { return undefined as any; }
  detachEvents(): void { return undefined as any; }
  autoBindArrow(shape: Shape): void { return undefined as any; }
  startPinch(): void { return undefined as any; }
  releasePointerCapture(): void { return undefined as any; }
  getZoom(): number { return undefined as any; }
  zoomTo(level: number, center?: Point): void { return undefined as any; }
  handleDragOver(e: DragEvent): void { return undefined as any; }
  findAlignmentGuides(movingBounds: { x: number; y: number; w: number; h: number }, excludeId?: string): { x?: number; y?: number } { return undefined as any; }
  drawAlignmentGuides(ctx: CanvasRenderingContext2D): void { return undefined as any; }
  showContextMenu(clientX: number, clientY: number): void { return undefined as any; }
  dismissContextMenu(): void { return undefined as any; }
  updateToolbar(): void { return undefined as any; }
  getTheme(): 'light' | 'dark' { return undefined as any; }
  setTheme(theme: 'light' | 'dark'): void { return undefined as any; }
  showShortcutHelp(): void { return undefined as any; }
  showToast(msg: string): void { return undefined as any; }
  drawRemoteCursors(ctx: CanvasRenderingContext2D): void { return undefined as any; }
  getCollabState(): CollabState | null { return undefined as any; }
  connectCollaboration(adapter: CollabAdapter, roomId: string, userName: string): void { return undefined as any; }
  disconnectCollaboration(): void { return undefined as any; }
  resolveSnapshot(elements: Element[]): Element[] { return undefined as any; }
  renderKaTeXToImage(latex: string, fontSize: number, color: string): HTMLImageElement | null { return undefined as any; }
  exportPNG(): void { return undefined as any; }
  toDataURL(type = 'image/png', quality = 1): string { return undefined as any; }
  exportJSON(): Snapshot { return undefined as any; }
  importJSON(snapshot: Snapshot): void { return undefined as any; }
  saveToStorage(key = 'casuya-blackboard'): void { return undefined as any; }
  loadFromStorage(key = 'casuya-blackboard'): boolean { return undefined as any; }
  handleFileDrop(e: DragEvent): void { return undefined as any; }
  exportSVG(): string { return undefined as any; }
  exportSelectedSVG(): string { return undefined as any; }
  exportSelectedPNG(): void { return undefined as any; }
  elementToSVG(el: Element): string { return undefined as any; }
  exportPDF(): void { return undefined as any; }
  snapToGrid(point: Point): Point { return undefined as any; }
  clamp(val: number, min: number, max: number): number { return undefined as any; }
  moveSingleElement(el: Element, orig: Element, dx: number, dy: number): void { return undefined as any; }
  getRotationCenter(el: Element): Point { return undefined as any; }
  flushLive(): void { return undefined as any; }
  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void { return undefined as any; }
  seededRandom(seed: number): () => number { return undefined as any; }
  setWidth(width: number): void { return undefined as any; }
  getWidth(): number { return undefined as any; }
  getFontSize(): number { return undefined as any; }
  setFontSize(size: number): void { return undefined as any; }
  getRoughness(): number { return undefined as any; }
  setRoughness(level: number): void { return undefined as any; }
  getDashEnabled(): boolean { return undefined as any; }
  setDashEnabled(enabled: boolean): void { return undefined as any; }
  getOpacity(): number { return undefined as any; }
  setOpacity(opacity: number): void { return undefined as any; }
  getFontFamily(): string { return undefined as any; }
  setFontFamily(family: string): void { return undefined as any; }
  getCornerRadius(): number { return undefined as any; }
  setCornerRadius(r: number): void { return undefined as any; }
  resetView(): void { return undefined as any; }
  clear(): void { return undefined as any; }
  getElements(): readonly Element[] { return undefined as any; }
  on(event: BlackboardEvent, callback: BlackboardEventCallback): void { return undefined as any; }
  off(event: BlackboardEvent, callback: BlackboardEventCallback): void { return undefined as any; }
  emit(event: BlackboardEvent): void { return undefined as any; }
  bringForward(): void { return undefined as any; }
  sendBackward(): void { return undefined as any; }
  bringToFront(): void { return undefined as any; }
  sendToBack(): void { return undefined as any; }
  toBlob(type = 'image/png', quality = 1): Promise<Blob | null> { return undefined as any; }
  startPresentation(): void { return undefined as any; }
  stopPresentation(): void { return undefined as any; }
  isPresenting(): boolean { return undefined as any; }
  presentNext(): void { return undefined as any; }
  presentPrev(): void { return undefined as any; }
  showPresenterView(): void { return undefined as any; }
  destroy(): void { return undefined as any; }
}
