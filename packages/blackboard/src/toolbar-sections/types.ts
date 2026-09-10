import type { Tool, BlackboardAPI } from '../types';

export type SectionId = 'write' | 'shapes' | 'text' | 'edit' | 'export';

export const SECTION_TOOLS: Record<SectionId, Tool[]> = {
  write: ['pen', 'highlighter', 'eraser', 'laser'],
  shapes: ['line', 'rect', 'circle', 'arrow', 'diamond'],
  text: ['text'],
  edit: ['select', 'hand'],
  export: [],
};

export interface ToolbarPanelRefs {
  colorInput: HTMLInputElement;
  widthLabel: HTMLSpanElement;
  widthDot: HTMLDivElement;
  opacitySlider: HTMLInputElement;
  fontFamilySelect: HTMLSelectElement;
  fillBtn: HTMLButtonElement;
  roughnessBtn: HTMLButtonElement;
  dashBtn: HTMLButtonElement;
  pixelEraseBtn: HTMLButtonElement;
  cornerRadiusSlider: HTMLInputElement;
  groupBtn: HTMLButtonElement;
  ungroupBtn: HTMLButtonElement;
  rotateBtn: HTMLButtonElement;
  applyStyleBtn: HTMLButtonElement;
  svgBtn: HTMLButtonElement;
  pngBtn: HTMLButtonElement;
  pdfBtn: HTMLButtonElement;
  saveBtn: HTMLButtonElement;
  graphBtn: HTMLButtonElement;
  themeBtn: HTMLButtonElement;
  presentBtn: HTMLButtonElement;
  latexBtn: HTMLButtonElement;
}

export interface ToolbarSectionContext {
  board: BlackboardAPI;
  toolButtons: Map<Tool, HTMLButtonElement>;
  panels: Record<SectionId, HTMLDivElement>;
  tooltipEl: HTMLDivElement;
  closePanels: () => void;
}