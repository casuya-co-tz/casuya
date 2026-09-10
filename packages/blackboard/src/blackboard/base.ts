import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, CollabUser, CollabState, CollabAdapter } from '../types';
export type Constructor<T = {}> = new (...args: any[]) => T;

export class BlackboardBase {
container!: HTMLElement;

root!: HTMLDivElement;

canvasWrapper!: HTMLDivElement;

staticCanvas!: HTMLCanvasElement;

liveCanvas!: HTMLCanvasElement;

staticCtx!: CanvasRenderingContext2D;

liveCtx!: CanvasRenderingContext2D;

width!: number;

height!: number;

dpr!: number;

activeTool: Tool = 'pen';

strokeColor = '#1e293b';

strokeWidth = 2;

strokeOpacity = 1;

fillEnabled = false;

dashEnabled = false;

pixelEraser = false;

fontFamily = 'system-ui, -apple-system, sans-serif';

cornerRadius = 0;

declare clipboardData: string; declare getPoint: (e: PointerEvent) => Point; declare onWheel: (e: WheelEvent) => void; declare onPointerDown: (e: PointerEvent) => void;
declare onPointerMove: (e: PointerEvent) => void; declare onPointerUp: (e: PointerEvent) => void; declare camera: Camera; declare selectedIds: Set<string>;
declare dragState: { type: 'move' | 'resize' | 'rotate'; startWorld: Point; origElements: Element[]; handle?: string } | null;
declare isSpaceDown: boolean; declare isPanning: boolean; declare panStart: Point; declare panCameraStart: Point;
declare textInput: HTMLTextAreaElement | null; declare editingTextId: string | null; declare editingTextIndex: number; declare editingTextOriginal: TextElement | null;
declare editingShapeId: string | null; declare activePointerId: number | null; declare activePointerType: string; declare lastPointerWorld: Point | null;
declare activePointers: Map<number, { x: number; y: number; type: string }>;
declare pinchStartDist: number; declare pinchStartZoom: number; declare pinchCenter: Point; declare pinchStartCamera: Point;
declare imagePool: string[]; declare imageSrcToIdx: Map<string, number>; declare elements: Element[]; declare undoStack: Element[][];
declare redoStack: Element[][]; declare currentElement: Element | null; declare isDrawing: boolean; declare animFrameId: number | null;
declare dirty: boolean; declare clipboard: Element[]; declare alignmentGuides: { x?: number; y?: number }; declare imageCache: Map<string, HTMLImageElement>;
declare marqueeStart: Point | null; declare marqueeEnd: Point | null; declare laserStrokes: { id: string; points: Point[]; color: string; width: number; opacity: number; createdAt: number }[];
declare laserAnimFrame: number | null; declare katexImageCache: Map<string, HTMLImageElement>;

static instanceCount = 0;

static readonly MAX_UNDO = 50;

graph!: GraphConfig;

toolbar!: ToolbarElements;

listeners: Map<string, Set<BlackboardEventCallback>> = new Map();

theme: 'light' | 'dark' = 'light';

contextMenu: HTMLDivElement | null = null;

helpOverlay: HTMLDivElement | null = null;

longPressTimer: ReturnType<typeof setTimeout> | null = null;

longPressStart: Point | null = null;

boundHandleImagePaste!: (e: ClipboardEvent) => void;

boundHandleDragOver!: (e: DragEvent) => void;

boundHandleFileDrop!: (e: DragEvent) => void;

fontSize = 18;

roughness = 0;

resizeObserver: ResizeObserver | null = null;

graphCanvas: HTMLCanvasElement | null = null;

graphCtx: CanvasRenderingContext2D | null = null;

graphDirty = true;

autosaveTimer: ReturnType<typeof setInterval> | null = null;

autosaveKey = 'casuya-blackboard';

dirtySinceSave = false;

boundBeforeUnload: ((e: BeforeUnloadEvent) => void) | null = null;

toastTimeout: ReturnType<typeof setTimeout> | null = null;

usePressure = false;

contextMenuKeyHandler: ((e: KeyboardEvent) => void) | null = null;

presenterMode = false;

presenterStep = 0;

presenterOverlay: HTMLDivElement | null = null;

collabAdapter: CollabAdapter | null = null;

collabState: CollabState | null = null;

remoteCursors = new Map<string, { user: CollabUser; cursor: Point }>();

constructor(_options: BlackboardOptions) { /* setup handled by SetupMixin */ }

onScrollDismiss = (): void => { this.dismissContextMenu(); };

onResizeDismiss = (): void => { this.dismissContextMenu(); };

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
  animateLaser = (): void => {};
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