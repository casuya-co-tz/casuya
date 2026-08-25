import type { Tool, ToolbarElements, BlackboardAPI } from './types';
import { FONT_FAMILIES } from './types';

const TOOLBAR_THEMES = {
  light: { barBg: '#f8fafc', barBorder: '#e2e8f0', btnColor: '#64748b', btnHover: '#334155', btnHoverBg: '#e2e8f0', activeBg: '#dbeafe', activeColor: '#2563eb', activeBorder: '#93c5fd', sep: '#e2e8f0', tipBg: '#f1f5f9', tipBorder: '#e2e8f0', tipColor: '#64748b', panelBg: '#ffffff', panelBorder: '#e2e8f0', panelShadow: 'rgba(0,0,0,0.08)' },
  dark: { barBg: '#1e1e2e', barBorder: '#313244', btnColor: '#6c7086', btnHover: '#cdd6f4', btnHoverBg: '#313244', activeBg: '#313244', activeColor: '#89b4fa', activeBorder: '#45475a', sep: '#313244', tipBg: '#181825', tipBorder: '#313244', tipColor: '#6c7086', panelBg: '#181825', panelBorder: '#313244', panelShadow: 'rgba(0,0,0,0.3)' },
};

const SECTION_ICONS: Record<string, string> = {
  write: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  shapes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
  text: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  edit: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`,
  export: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
};

const SECTION_LABELS: Record<string, string> = {
  write: 'Write', shapes: 'Shapes', text: 'Text', edit: 'Edit', export: 'Export',
};

const TOOL_ICONS: Record<Tool, string> = {
  select: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`,
  hand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V4a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  pen: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  highlighter: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
  text: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  line: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>`,
  rect: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
  circle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
  arrow: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  eraser: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
  laser: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3m-9-9h3m12 0h3"/><path d="m4.9 4.9 2.1 2.1m9.9 9.9 2.1 2.1m-14 0 2.1-2.1m9.9-9.9 2.1-2.1"/></svg>`,
  diamond: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L22 12L12 22L2 12Z"/></svg>`,
};

const TOOL_LABELS: Record<Tool, string> = {
  select: 'Select', hand: 'Hand', pen: 'Pen', highlighter: 'Marker', text: 'Text',
  line: 'Line', rect: 'Rect', circle: 'Circle', arrow: 'Arrow', eraser: 'Eraser',
  laser: 'Laser', diamond: 'Diamond',
};

const TOOL_DESCRIPTIONS: Record<Tool, string> = {
  select: 'Select, move, resize (V)', hand: 'Pan canvas (H)', pen: 'Draw with pen (P)',
  highlighter: 'Highlight marker (M)', text: 'Add text (T)', line: 'Straight line (L)',
  rect: 'Rectangle (R)', circle: 'Ellipse (O)', arrow: 'Arrow (A)', eraser: 'Erase (E)',
  laser: 'Laser pointer (B)', diamond: 'Diamond shape (N)',
};

const COLORS = ['#1e293b', '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#0891b2'];

const TOOLBAR_STYLES = `
.casuya-section-btn {
  min-width: 56px; height: 40px; border: 2px solid transparent; border-radius: 8px;
  background: transparent; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px; padding: 3px 8px;
  transition: all 0.15s ease; font-family: inherit; color: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-section-btn:active { transform: scale(0.95); }
.casuya-section-btn span { font-size: 9px; line-height: 1; letter-spacing: 0.02em; }
.casuya-tool-btn {
  min-width: 40px; height: 36px; border: 2px solid transparent; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px; padding: 2px 6px;
  transition: all 0.15s ease; font-family: inherit; color: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-tool-btn:active { transform: scale(0.95); }
.casuya-tool-btn span { font-size: 8px; line-height: 1; }
.casuya-panel {
  position: absolute; top: 100%; left: 0; z-index: 100;
  border-radius: 10px; padding: 8px; display: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.casuya-panel.open { display: flex; flex-direction: column; gap: 8px; }
.casuya-panel-row { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.casuya-panel-label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }
.casuya-panel-sep { height: 1px; width: 100%; opacity: 0.2; }
.casuya-action-btn {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  font-size: 14px; transition: all 0.15s ease; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-action-btn:active { transform: scale(0.95); }
.casuya-swatch {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  transition: all 0.15s ease; padding: 0; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-swatch:active { transform: scale(0.9); }
.casuya-color-picker {
  width: 24px; height: 24px; border: none; border-radius: 50%; padding: 0;
  cursor: pointer; flex-shrink: 0; overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.casuya-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
.casuya-color-picker::-webkit-color-swatch { border-radius: 50%; }
.casuya-range {
  height: 3px; -webkit-appearance: none; appearance: none;
  border-radius: 2px; outline: none; cursor: pointer;
  transition: background 0.15s ease;
}
.casuya-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: currentColor; cursor: pointer;
  border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.casuya-range::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: currentColor; cursor: pointer;
  border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.casuya-select {
  font-size: 11px; border: 1px solid; border-radius: 4px;
  padding: 2px 4px; cursor: pointer; background: transparent; outline: none;
}
.casuya-zoom-group { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.casuya-zoom-btn {
  width: 28px; height: 28px; border: none; background: transparent; cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; transition: all 0.15s ease; flex-shrink: 0;
}
.casuya-zoom-btn:active { transform: scale(0.95); }
.casuya-zoom-label {
  cursor: pointer; font-size: 11px; min-width: 36px; text-align: center;
  user-select: none; padding: 0 4px;
}
.casuya-undo-redo { display: flex; gap: 2px; margin-left: 4px; }
.casuya-undo-redo button {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  font-size: 16px; transition: all 0.15s ease;
}
.casuya-tooltip {
  width: 100%; padding: 4px 8px; font-size: 11px; min-height: 22px;
  box-sizing: border-box; line-height: 1.3; transition: all 0.15s ease;
}
.casuya-tooltip:empty { display: none; }
@media (max-width: 640px) {
  .casuya-section-btn { min-width: 44px; height: 36px; padding: 2px 4px; }
  .casuya-section-btn span { display: none; }
  .casuya-tool-btn { min-width: 34px; height: 34px; padding: 2px !important; }
  .casuya-tool-btn span { display: none !important; }
  .casuya-action-btn { width: 28px; height: 28px; font-size: 12px; }
  .casuya-swatch { width: 20px; height: 20px; }
  .casuya-color-picker { width: 20px; height: 20px; }
  .casuya-zoom-btn { width: 24px; height: 24px; font-size: 12px; }
  .casuya-zoom-label { font-size: 10px; min-width: 30px; }
  .casuya-tooltip { display: none !important; }
  .casuya-panel { right: 0; left: auto; }
}
`;

function injectStyles(): void {
  if (document.getElementById('casuya-toolbar-styles')) return;
  const style = document.createElement('style');
  style.id = 'casuya-toolbar-styles';
  style.textContent = TOOLBAR_STYLES;
  document.head.appendChild(style);
}

type SectionId = 'write' | 'shapes' | 'text' | 'edit' | 'export';

const SECTION_TOOLS: Record<SectionId, Tool[]> = {
  write: ['pen', 'highlighter', 'eraser', 'laser'],
  shapes: ['line', 'rect', 'circle', 'arrow', 'diamond'],
  text: ['text'],
  edit: ['select', 'hand'],
  export: [],
};

export function createToolbar(board: BlackboardAPI): ToolbarElements {
  injectStyles();

  const bar = document.createElement('div');
  bar.style.cssText = 'display: flex; flex-direction: column; transition: all 0.15s ease; border-bottom-width: 1px; border-bottom-style: solid; position: relative;';

  const mainRow = document.createElement('div');
  mainRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 10px;';

  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'casuya-tooltip';

  const toolButtons = new Map<Tool, HTMLButtonElement>();
  let activePanel: SectionId | null = null;
  const panels: Record<SectionId, HTMLDivElement> = {} as any;
  let outsideHandler: ((e: PointerEvent) => void) | null = null;

  const getTheme = () => TOOLBAR_THEMES[board.getTheme()];

  const closePanels = () => {
    for (const id of Object.keys(panels) as SectionId[]) {
      panels[id].classList.remove('open');
      const btn = bar.querySelector(`[data-section="${id}"]`) as HTMLElement;
      if (btn) {
        btn.style.background = 'transparent';
        btn.style.color = getTheme().btnColor;
        btn.style.borderColor = 'transparent';
      }
    }
    activePanel = null;
  };

  const togglePanel = (id: SectionId) => {
    if (activePanel === id) { closePanels(); return; }
    closePanels();
    activePanel = id;
    const t = getTheme();
    panels[id].classList.add('open');
    const btn = bar.querySelector(`[data-section="${id}"]`) as HTMLElement;
    if (btn) {
      btn.style.background = t.activeBg;
      btn.style.color = t.activeColor;
      btn.style.borderColor = t.activeBorder;
    }
  };

  function makeToolBtn(tool: Tool): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'casuya-tool-btn';
    btn.innerHTML = `${TOOL_ICONS[tool]}<span>${TOOL_LABELS[tool]}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      board.setTool(tool);
      setTimeout(closePanels, 80);
    });
    btn.addEventListener('mouseenter', () => { tooltipEl.textContent = TOOL_DESCRIPTIONS[tool]; });
    btn.addEventListener('mouseleave', () => { tooltipEl.textContent = ''; });
    toolButtons.set(tool, btn);
    return btn;
  }

  function makeAction(icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'casuya-action-btn';
    btn.textContent = icon;
    btn.title = title;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    btn.addEventListener('mouseenter', () => { tooltipEl.textContent = title; });
    btn.addEventListener('mouseleave', () => { tooltipEl.textContent = ''; });
    return btn;
  }

  function makeSectionButton(id: SectionId): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'casuya-section-btn';
    btn.dataset.section = id;
    btn.innerHTML = `${SECTION_ICONS[id]}<span>${SECTION_LABELS[id]}</span>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(id); });
    btn.addEventListener('mouseenter', () => { tooltipEl.textContent = SECTION_LABELS[id] + ' tools'; });
    btn.addEventListener('mouseleave', () => { tooltipEl.textContent = ''; });
    return btn;
  }

  function makePanel(id: SectionId): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'casuya-panel';
    panels[id] = panel;
    return panel;
  }

  // ── SECTION: WRITE ──
  const writePanel = makePanel('write');
  const writeRow1 = document.createElement('div');
  writeRow1.className = 'casuya-panel-row';
  for (const tool of SECTION_TOOLS.write) {
    writeRow1.appendChild(makeToolBtn(tool));
  }
  writePanel.appendChild(writeRow1);
  const writeSep = document.createElement('div');
  writeSep.className = 'casuya-panel-sep';
  writePanel.appendChild(writeSep);
  const writeColors = document.createElement('div');
  writeColors.className = 'casuya-panel-row';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'casuya-color-picker';
  colorInput.value = board.getColor();
  colorInput.addEventListener('input', () => board.setColor(colorInput.value));
  for (const color of COLORS) {
    const swatch = document.createElement('button');
    swatch.className = 'casuya-swatch';
    swatch.style.background = color;
    swatch.addEventListener('click', (e) => { e.stopPropagation(); board.setColor(color); colorInput.value = color; });
    writeColors.appendChild(swatch);
  }
  writeColors.appendChild(colorInput);
  writePanel.appendChild(writeColors);
  const writeWidth = document.createElement('div');
  writeWidth.className = 'casuya-panel-row';
  const widthLabel = document.createElement('span');
  widthLabel.className = 'casuya-panel-label';
  widthLabel.textContent = 'Width';
  const widthSlider = document.createElement('input');
  widthSlider.type = 'range'; widthSlider.min = '1'; widthSlider.max = '20';
  widthSlider.value = String(board.getWidth());
  widthSlider.className = 'casuya-range';
  widthSlider.style.cssText = 'width: 120px;';
  widthSlider.addEventListener('input', () => {
    if (board.getTool() === 'text') board.setFontSize(Number(widthSlider.value));
    else board.setWidth(Number(widthSlider.value));
  });
  const widthPreview = document.createElement('div');
  widthPreview.style.cssText = 'width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;';
  const widthDot = document.createElement('div');
  widthDot.style.cssText = `background: ${board.getColor()}; border-radius: 50%; width: 4px; height: 4px; transition: all 0.15s ease;`;
  widthPreview.appendChild(widthDot);
  writeWidth.appendChild(widthLabel);
  writeWidth.appendChild(widthSlider);
  writeWidth.appendChild(widthPreview);
  writePanel.appendChild(writeWidth);
  const writeOpacity = document.createElement('div');
  writeOpacity.className = 'casuya-panel-row';
  const opLabel = document.createElement('span');
  opLabel.className = 'casuya-panel-label';
  opLabel.textContent = 'Opacity';
  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range'; opacitySlider.min = '0.05'; opacitySlider.max = '1';
  opacitySlider.step = '0.05'; opacitySlider.value = String(board.getOpacity());
  opacitySlider.className = 'casuya-range';
  opacitySlider.style.cssText = 'width: 120px;';
  opacitySlider.addEventListener('input', () => board.setOpacity(Number(opacitySlider.value)));
  writeOpacity.appendChild(opLabel);
  writeOpacity.appendChild(opacitySlider);
  writePanel.appendChild(writeOpacity);

  // ── SECTION: SHAPES ──
  const shapesPanel = makePanel('shapes');
  const shapesRow = document.createElement('div');
  shapesRow.className = 'casuya-panel-row';
  for (const tool of SECTION_TOOLS.shapes) {
    shapesRow.appendChild(makeToolBtn(tool));
  }
  shapesPanel.appendChild(shapesRow);
  const shapesSep = document.createElement('div');
  shapesSep.className = 'casuya-panel-sep';
  shapesPanel.appendChild(shapesSep);
  const shapesOpts = document.createElement('div');
  shapesOpts.className = 'casuya-panel-row';
  const fillBtn = makeAction('\u25A3', 'Fill: off', () => board.setFill(!board.getFill()));
  fillBtn.dataset.role = 'fill';
  const roughnessLabels = ['Clean', 'Light', 'Medium', 'Heavy'];
  let roughnessIdx = board.getRoughness();
  const roughnessBtn = makeAction('\u2734', `Roughness: ${roughnessLabels[roughnessIdx]}`, () => {
    roughnessIdx = (roughnessIdx + 1) % 4;
    board.setRoughness(roughnessIdx);
    roughnessBtn.title = `Roughness: ${roughnessLabels[roughnessIdx]}`;
  });
  roughnessBtn.dataset.role = 'roughness';
  const dashBtn = makeAction('\u2506', 'Toggle dashed lines', () => board.setDashEnabled(!board.getDashEnabled()));
  dashBtn.dataset.role = 'dash';
  const pixelEraseBtn = makeAction('\u232B', 'Toggle pixel eraser', () => board.setPixelEraser(!board.getPixelEraser()));
  pixelEraseBtn.dataset.role = 'pixelErase';
  shapesOpts.appendChild(fillBtn);
  shapesOpts.appendChild(roughnessBtn);
  shapesOpts.appendChild(dashBtn);
  shapesOpts.appendChild(pixelEraseBtn);
  shapesPanel.appendChild(shapesOpts);
  const shapesCorner = document.createElement('div');
  shapesCorner.className = 'casuya-panel-row';
  const cornerLabel = document.createElement('span');
  cornerLabel.className = 'casuya-panel-label';
  cornerLabel.textContent = 'Corner';
  const cornerSlider = document.createElement('input');
  cornerSlider.type = 'range'; cornerSlider.min = '0'; cornerSlider.max = '50';
  cornerSlider.value = String(board.getCornerRadius());
  cornerSlider.className = 'casuya-range';
  cornerSlider.style.cssText = 'width: 100px;';
  cornerSlider.addEventListener('input', () => board.setCornerRadius(Number(cornerSlider.value)));
  shapesCorner.appendChild(cornerLabel);
  shapesCorner.appendChild(cornerSlider);
  shapesPanel.appendChild(shapesCorner);

  // ── SECTION: TEXT ──
  const textPanel = makePanel('text');
  const textRow = document.createElement('div');
  textRow.className = 'casuya-panel-row';
  textRow.appendChild(makeToolBtn('text'));
  textPanel.appendChild(textRow);
  const textSep = document.createElement('div');
  textSep.className = 'casuya-panel-sep';
  textPanel.appendChild(textSep);
  const fontFamilySelect = document.createElement('select');
  fontFamilySelect.className = 'casuya-select';
  fontFamilySelect.title = 'Font Family';
  for (const ff of FONT_FAMILIES) {
    const opt = document.createElement('option');
    opt.value = ff;
    opt.textContent = ff.split(',')[0].replace(/"/g, '');
    fontFamilySelect.appendChild(opt);
  }
  fontFamilySelect.value = board.getFontFamily();
  fontFamilySelect.addEventListener('change', () => board.setFontFamily(fontFamilySelect.value));
  const fontRow = document.createElement('div');
  fontRow.className = 'casuya-panel-row';
  fontRow.appendChild(fontFamilySelect);
  textPanel.appendChild(fontRow);

  // ── SECTION: EDIT ──
  const editPanel = makePanel('edit');
  const editRow1 = document.createElement('div');
  editRow1.className = 'casuya-panel-row';
  for (const tool of SECTION_TOOLS.edit) {
    editRow1.appendChild(makeToolBtn(tool));
  }
  editPanel.appendChild(editRow1);
  const editSep = document.createElement('div');
  editSep.className = 'casuya-panel-sep';
  editPanel.appendChild(editSep);
  const editRow2 = document.createElement('div');
  editRow2.className = 'casuya-panel-row';
  const clearBtn = makeAction('\u2715', 'Clear all', () => board.clear());
  const groupBtn = makeAction('\u2261', 'Group (Ctrl+G)', () => board.groupSelected());
  const ungroupBtn = makeAction('\u2262', 'Ungroup (Ctrl+Shift+G)', () => board.ungroupSelected());
  const rotateBtn = makeAction('\u21BB', 'Rotate 15\u00B0 (Shift+R)', () => board.rotateSelected(Math.PI / 12));
  const applyStyleBtn = makeAction('\u270E', 'Apply style (Ctrl+Shift+F)', () => board.applyStyleToSelected());
  editRow2.appendChild(clearBtn);
  editRow2.appendChild(groupBtn);
  editRow2.appendChild(ungroupBtn);
  editRow2.appendChild(rotateBtn);
  editRow2.appendChild(applyStyleBtn);
  editPanel.appendChild(editRow2);

  // ── SECTION: EXPORT ──
  const exportPanel = makePanel('export');
  const exportRow1 = document.createElement('div');
  exportRow1.className = 'casuya-panel-row';
  const svgBtn = makeAction('\u2B1A', 'Export SVG', () => {
    const svg = board.exportSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'blackboard.svg'; a.click();
    URL.revokeObjectURL(url);
  });
  const pngBtn = makeAction('\uD83D\uDDBC', 'Export PNG', () => board.exportPNG());
  const pdfBtn = makeAction('\uD83D\uDCC4', 'Export PDF', () => board.exportPDF());
  const saveBtn = makeAction('\u2193', 'Save to browser', () => { board.saveToStorage(); board.showToast('\u2713 Saved'); });
  exportRow1.appendChild(svgBtn);
  exportRow1.appendChild(pngBtn);
  exportRow1.appendChild(pdfBtn);
  exportRow1.appendChild(saveBtn);
  exportPanel.appendChild(exportRow1);
  const exportSep = document.createElement('div');
  exportSep.className = 'casuya-panel-sep';
  exportPanel.appendChild(exportSep);
  const exportRow2 = document.createElement('div');
  exportRow2.className = 'casuya-panel-row';
  const graphBtn = makeAction('\u229E', 'Toggle graph paper', () => {
    if (board.isGraphEnabled()) board.disableGraph(); else board.enableGraph();
  });
  graphBtn.dataset.role = 'graph';
  const themeBtn = makeAction(board.getTheme() === 'light' ? '\u263E' : '\u2600', 'Toggle theme', () => {
    board.setTheme(board.getTheme() === 'light' ? 'dark' : 'light');
  });
  themeBtn.dataset.role = 'theme';
  exportRow2.appendChild(graphBtn);
  exportRow2.appendChild(themeBtn);
  exportPanel.appendChild(exportRow2);
  const exportSep2 = document.createElement('div');
  exportSep2.className = 'casuya-panel-sep';
  exportPanel.appendChild(exportSep2);
  const exportRow3 = document.createElement('div');
  exportRow3.className = 'casuya-panel-row';
  const presentBtn = makeAction('\u25B6', 'Presentation mode', () => {
    if (board.isPresenting()) board.stopPresentation(); else board.startPresentation();
  });
  const latexBtn = makeAction('\u03A3', 'Insert LaTeX equation', () => {
    const latex = prompt('Enter LaTeX expression:', 'E = mc^2');
    if (latex) board.insertLaTeX(latex);
  });
  exportRow3.appendChild(presentBtn);
  exportRow3.appendChild(latexBtn);
  exportPanel.appendChild(exportRow3);

  // ── Assemble main bar ──
  mainRow.appendChild(makeSectionButton('write'));
  mainRow.appendChild(makeSectionButton('shapes'));
  mainRow.appendChild(makeSectionButton('text'));
  mainRow.appendChild(makeSectionButton('edit'));
  mainRow.appendChild(makeSectionButton('export'));

  const sepEl = document.createElement('div');
  sepEl.className = 'casuya-toolbar-sep casuya-separator';
  sepEl.style.cssText = 'width: 1px; height: 28px; margin: 0 4px; flex-shrink: 0;';
  mainRow.appendChild(sepEl);

  const undoBtn = makeAction('\u21A9', 'Undo (Ctrl+Z)', () => board.undo());
  const redoBtn = makeAction('\u21AA', 'Redo (Ctrl+Shift+Z)', () => board.redo());
  const undoRedoGroup = document.createElement('div');
  undoRedoGroup.className = 'casuya-undo-redo';
  undoRedoGroup.appendChild(undoBtn);
  undoRedoGroup.appendChild(redoBtn);
  mainRow.appendChild(undoRedoGroup);

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'casuya-zoom-group';
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.className = 'casuya-zoom-btn';
  zoomOutBtn.textContent = '\u2212';
  zoomOutBtn.title = 'Zoom Out';
  zoomOutBtn.addEventListener('click', () => board.zoomTo(board.getZoom() / 1.25));
  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'casuya-zoom-label';
  zoomLabel.textContent = Math.round(board.getZoom() * 100) + '%';
  zoomLabel.title = 'Reset Zoom';
  zoomLabel.addEventListener('click', () => board.resetView());
  const zoomInBtn = document.createElement('button');
  zoomInBtn.className = 'casuya-zoom-btn';
  zoomInBtn.textContent = '+';
  zoomInBtn.title = 'Zoom In';
  zoomInBtn.addEventListener('click', () => board.zoomTo(board.getZoom() * 1.25));
  zoomGroup.appendChild(zoomOutBtn);
  zoomGroup.appendChild(zoomLabel);
  zoomGroup.appendChild(zoomInBtn);
  mainRow.appendChild(zoomGroup);

  bar.appendChild(mainRow);
  for (const id of Object.keys(panels) as SectionId[]) {
    bar.appendChild(panels[id]);
  }
  bar.appendChild(tooltipEl);

  outsideHandler = (e: PointerEvent) => {
    if (!bar.contains(e.target as Node)) closePanels();
  };
  document.addEventListener('pointerdown', outsideHandler);

  const applyTheme = () => {
    const t = getTheme();
    bar.style.background = t.barBg;
    bar.style.borderColor = t.barBorder;
    tooltipEl.style.background = t.tipBg;
    tooltipEl.style.borderColor = t.tipBorder;
    tooltipEl.style.color = t.tipColor;
    const seps = bar.querySelectorAll('.casuya-separator');
    seps.forEach(s => { (s as HTMLElement).style.background = t.sep; });
    const allPanels = bar.querySelectorAll('.casuya-panel') as NodeListOf<HTMLElement>;
    allPanels.forEach(p => { p.style.background = t.panelBg; p.style.borderColor = t.panelBorder; });
  };
  applyTheme();

  return {
    bar, toolButtons,
    undoBtn, redoBtn, graphBtn, fillBtn, themeBtn, roughnessBtn,
    groupBtn, ungroupBtn, rotateBtn, svgBtn, pngBtn, dashBtn,
    pixelEraseBtn, opacitySlider, fontFamilySelect,
    cornerRadiusSlider: cornerSlider, widthLabel, widthDot,
    colorInput, zoomLabel, applyStyleBtn,
  };
}

export function updateToolbarState(
  tb: ToolbarElements,
  activeTool: Tool,
  color: string,
  width: number,
  fillEnabled: boolean,
  theme: 'light' | 'dark',
  zoom: number,
  fontSize?: number,
  roughness?: number,
  graphEnabled?: boolean,
  dashEnabled?: boolean,
  opacity?: number,
  fontFamily?: string,
  cornerRadius?: number,
  pixelEraser?: boolean
): void {
  const themeDef = TOOLBAR_THEMES[theme];

  tb.bar.style.background = themeDef.barBg;
  tb.bar.style.borderColor = themeDef.barBorder;

  for (const [tool, btn] of tb.toolButtons) {
    const active = tool === activeTool;
    btn.style.background = active ? themeDef.activeBg : 'transparent';
    btn.style.color = active ? themeDef.activeColor : themeDef.btnColor;
    btn.style.borderColor = active ? themeDef.activeBorder : 'transparent';
  }

  if (tb.widthLabel) {
    const slider = tb.widthLabel.nextElementSibling as HTMLInputElement;
    if (activeTool === 'text') {
      tb.widthLabel.textContent = `${fontSize ?? 18}px`;
      if (slider && slider.tagName === 'INPUT') {
        slider.min = '8'; slider.max = '72';
        slider.value = String(fontSize ?? 18);
      }
    } else {
      tb.widthLabel.textContent = 'Width';
      if (slider && slider.tagName === 'INPUT') {
        slider.min = '1'; slider.max = '20';
        slider.value = String(width);
      }
    }
  }

  if (tb.widthDot) {
    tb.widthDot.style.background = color;
    tb.widthDot.style.width = `${Math.max(4, width)}px`;
    tb.widthDot.style.height = `${Math.max(4, width)}px`;
  }

  tb.colorInput.value = color;
  tb.colorInput.style.borderColor = themeDef.sep;

  if (fillEnabled) {
    tb.fillBtn.style.background = themeDef.activeBg;
    tb.fillBtn.style.color = themeDef.activeColor;
    tb.fillBtn.title = 'Fill: on';
    tb.fillBtn.dataset.active = 'true';
  } else {
    tb.fillBtn.style.background = 'transparent';
    tb.fillBtn.style.color = themeDef.btnColor;
    tb.fillBtn.title = 'Fill: off';
    delete tb.fillBtn.dataset.active;
  }

  if (roughness !== undefined) {
    const roughnessLabels = ['Clean', 'Light', 'Medium', 'Heavy'];
    tb.roughnessBtn.title = `Roughness: ${roughnessLabels[roughness]}`;
    if (roughness > 0) {
      tb.roughnessBtn.style.background = themeDef.activeBg;
      tb.roughnessBtn.style.color = themeDef.activeColor;
      tb.roughnessBtn.dataset.active = 'true';
    } else {
      tb.roughnessBtn.style.background = 'transparent';
      tb.roughnessBtn.style.color = themeDef.btnColor;
      delete tb.roughnessBtn.dataset.active;
    }
  }

  tb.themeBtn.textContent = theme === 'light' ? '\u263E' : '\u2600';
  tb.themeBtn.style.color = themeDef.btnColor;
  tb.themeBtn.style.background = 'transparent';

  if (graphEnabled) {
    tb.graphBtn.style.background = themeDef.activeBg;
    tb.graphBtn.style.color = themeDef.activeColor;
    tb.graphBtn.dataset.active = 'true';
  } else {
    tb.graphBtn.style.background = 'transparent';
    tb.graphBtn.style.color = themeDef.btnColor;
    delete tb.graphBtn.dataset.active;
  }

  tb.zoomLabel.textContent = Math.round(zoom * 100) + '%';
  tb.zoomLabel.style.color = themeDef.btnColor;

  const zoomBtns = tb.zoomLabel.parentElement?.querySelectorAll('button') || [];
  zoomBtns.forEach(b => {
    (b as HTMLElement).style.color = themeDef.btnColor;
    (b as HTMLElement).style.background = 'transparent';
  });

  const undoRedoBtns = tb.undoBtn.parentElement?.querySelectorAll('button') || [];
  undoRedoBtns.forEach(b => {
    (b as HTMLElement).style.color = themeDef.btnColor;
    (b as HTMLElement).style.background = 'transparent';
  });

  if (dashEnabled) {
    tb.dashBtn.style.background = themeDef.activeBg;
    tb.dashBtn.style.color = themeDef.activeColor;
    tb.dashBtn.dataset.active = 'true';
  } else {
    tb.dashBtn.style.background = 'transparent';
    tb.dashBtn.style.color = themeDef.btnColor;
    delete tb.dashBtn.dataset.active;
  }

  if (pixelEraser) {
    tb.pixelEraseBtn.style.background = themeDef.activeBg;
    tb.pixelEraseBtn.style.color = themeDef.activeColor;
    tb.pixelEraseBtn.dataset.active = 'true';
  } else {
    tb.pixelEraseBtn.style.background = 'transparent';
    tb.pixelEraseBtn.style.color = themeDef.btnColor;
    delete tb.pixelEraseBtn.dataset.active;
  }

  if (opacity !== undefined) tb.opacitySlider.value = String(opacity);
  if (fontFamily !== undefined && tb.fontFamilySelect) tb.fontFamilySelect.value = fontFamily;
  if (cornerRadius !== undefined && tb.cornerRadiusSlider) tb.cornerRadiusSlider.value = String(cornerRadius);

  const seps = tb.bar.querySelectorAll('.casuya-separator');
  seps.forEach(s => { (s as HTMLElement).style.background = themeDef.sep; });

  const tooltip = tb.bar.querySelector('.casuya-tooltip') as HTMLElement;
  if (tooltip) {
    tooltip.style.background = themeDef.tipBg;
    tooltip.style.borderColor = themeDef.tipBorder;
    tooltip.style.color = themeDef.tipColor;
  }

  const allPanels = tb.bar.querySelectorAll('.casuya-panel') as NodeListOf<HTMLElement>;
  allPanels.forEach(p => {
    p.style.background = themeDef.panelBg;
    p.style.borderColor = themeDef.panelBorder;
  });
}
