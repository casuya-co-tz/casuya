export type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'text' | 'line' | 'rect' | 'circle' | 'arrow' | 'eraser' | 'laser' | 'diamond';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Stroke {
  id: string;
  tool: 'pen' | 'eraser' | 'highlighter' | 'laser';
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  createdAt?: number;
  zIndex?: number;
  groupId?: string;
  rotation?: number;
}

export interface Shape {
  id: string;
  tool: 'line' | 'rect' | 'circle' | 'arrow' | 'diamond';
  start: Point;
  end: Point;
  color: string;
  width: number;
  opacity: number;
  createdAt?: number;
  filled?: boolean;
  dashPattern?: number[];
  cornerRadius?: number;
  roughness?: number;
  zIndex?: number;
  groupId?: string;
  rotation?: number;
  label?: string;
  boundTo?: string;
  boundElements?: string[];
}

export interface LaTeXElement {
  id: string;
  tool: 'katex';
  position: Point;
  latex: string;
  fontSize: number;
  color: string;
  opacity: number;
  createdAt?: number;
  zIndex?: number;
  groupId?: string;
  rotation?: number;
  width?: number;
  height?: number;
}

export interface TextElement {
  id: string;
  tool: 'text';
  position: Point;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  width: number;
  opacity: number;
  createdAt?: number;
  zIndex?: number;
  groupId?: string;
  rotation?: number;
}

export interface ImageElement {
  id: string;
  tool: 'image';
  position: Point;
  width: number;
  height: number;
  src: string;
  opacity: number;
  createdAt?: number;
  zIndex?: number;
  groupId?: string;
  rotation?: number;
}

export interface GraphConfig {
  enabled: boolean;
  spacing: number;
  color: string;
  showAxes: boolean;
  showLabels: boolean;
}

export interface BlackboardOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  graph?: Partial<GraphConfig>;
  theme?: 'light' | 'dark';
}

export type Element = Stroke | Shape | TextElement | ImageElement | LaTeXElement;

export interface Snapshot {
  elements: Element[];
  width: number;
  height: number;
  camera?: Camera;
  graph?: GraphConfig;
  theme?: 'light' | 'dark';
}

export type BlackboardEvent =
  | 'change'
  | 'toolchange'
  | 'undo'
  | 'redo'
  | 'clear'
  | 'save'
  | 'load';

export type BlackboardEventCallback = (payload: { elements: Element[]; tool?: Tool }) => void;

/** Shared toolbar DOM element references used by both Blackboard and toolbar module. */
export interface ToolbarElements {
  bar: HTMLDivElement;
  toolButtons: Map<Tool, HTMLButtonElement>;
  undoBtn: HTMLButtonElement;
  redoBtn: HTMLButtonElement;
  graphBtn: HTMLButtonElement;
  fillBtn: HTMLButtonElement;
  themeBtn: HTMLButtonElement;
  roughnessBtn: HTMLButtonElement;
  groupBtn: HTMLButtonElement;
  ungroupBtn: HTMLButtonElement;
  rotateBtn: HTMLButtonElement;
  svgBtn: HTMLButtonElement;
  pngBtn: HTMLButtonElement;
  dashBtn: HTMLButtonElement;
  pixelEraseBtn: HTMLButtonElement;
  opacitySlider: HTMLInputElement;
  fontFamilySelect: HTMLSelectElement;
  cornerRadiusSlider: HTMLInputElement;
  widthLabel: HTMLSpanElement;
  widthDot: HTMLDivElement;
  colorInput: HTMLInputElement;
  zoomLabel: HTMLSpanElement;
  applyStyleBtn: HTMLButtonElement;
}

/**
 * Public API surface that the toolbar calls on the Blackboard instance.
 * Keeps the toolbar decoupled from the concrete Blackboard class.
 */
export interface BlackboardAPI {
  getTool(): Tool;
  setTool(tool: Tool): void;
  getColor(): string;
  setColor(color: string): void;
  getWidth(): number;
  setWidth(width: number): void;
  getFill(): boolean;
  setFill(enabled: boolean): void;
  getTheme(): 'light' | 'dark';
  setTheme(theme: 'light' | 'dark'): void;
  getZoom(): number;
  zoomTo(level: number, center?: Point): void;
  resetView(): void;
  isGraphEnabled(): boolean;
  undo(): void;
  redo(): void;
  clear(): void;
  enableGraph(options?: Partial<GraphConfig>): void;
  disableGraph(): void;
  saveToStorage(key?: string): void;
  showToast(msg: string): void;
  bringForward(): void;
  sendBackward(): void;
  bringToFront(): void;
  sendToBack(): void;
  duplicateSelected(): void;
  rotateSelected(angle: number): void;
  getSelectedRotation(): number;
  getFontSize(): number;
  setFontSize(size: number): void;
  getRoughness(): number;
  setRoughness(level: number): void;
  selectAll(): void;
  groupSelected(): void;
  ungroupSelected(): void;
  exportSVG(): string;
  applyStyleToSelected(): void;
  exportPNG(): void;
  getDashEnabled(): boolean;
  setDashEnabled(enabled: boolean): void;
  getOpacity(): number;
  setOpacity(opacity: number): void;
  getFontFamily(): string;
  setFontFamily(family: string): void;
  getCornerRadius(): number;
  setCornerRadius(r: number): void;
  getPixelEraser(): boolean;
  setPixelEraser(enabled: boolean): void;
  getClipboard(): string;
  setClipboard(data: string): void;
  exportSelectedSVG(): string;
  exportSelectedPNG(): void;
  exportPDF(): void;
  startPresentation(): void;
  stopPresentation(): void;
  isPresenting(): boolean;
  presentNext(): void;
  presentPrev(): void;
  insertLaTeX(latex: string): void;
  getCollabState(): CollabState | null;
}

export const FONT_FAMILIES = [
  'system-ui, -apple-system, sans-serif',
  'Georgia, serif',
  '"Courier New", monospace',
  '"Trebuchet MS", sans-serif',
  'Impact, sans-serif',
  '"Comic Sans MS", cursive',
  'Verdana, sans-serif',
  'Arial, sans-serif',
];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface SelectionBox {
  elementId: string;
  bounds: BoundingBox;
}

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
}

export interface CollabState {
  connected: boolean;
  roomId: string;
  users: CollabUser[];
  localUser: CollabUser;
}

export interface CollabAdapter {
  connect(roomId: string, user: CollabUser): void;
  disconnect(): void;
  sendElements(elements: Element[]): void;
  sendCursor(cursor: Point): void;
  onElementsUpdate(callback: (elements: Element[]) => void): void;
  onCursorUpdate(callback: (userId: string, cursor: Point) => void): void;
  onUserJoin(callback: (user: CollabUser) => void): void;
  onUserLeave(callback: (userId: string) => void): void;
  getState(): CollabState;
}

