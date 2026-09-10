import type { Tool, ToolbarElements, BlackboardAPI } from './types';
import { SECTION_ICONS, SECTION_LABELS } from './icons';
import { TOOLBAR_THEMES, applyToolbarTheme, injectStyles } from './toolbar-theme';
import { makeAction, createToolbarSections, SectionId } from './toolbar-sections';

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

  const panelRefs = createToolbarSections({ board, toolButtons, panels, tooltipEl, closePanels });

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

  const undoBtn = makeAction('\u21A9', 'Undo (Ctrl+Z)', () => board.undo(), tooltipEl);
  const redoBtn = makeAction('\u21AA', 'Redo (Ctrl+Shift+Z)', () => board.redo(), tooltipEl);
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

  applyToolbarTheme(bar, tooltipEl, getTheme());

  return {
    bar, toolButtons,
    undoBtn, redoBtn, graphBtn: panelRefs.graphBtn, fillBtn: panelRefs.fillBtn,
    themeBtn: panelRefs.themeBtn, roughnessBtn: panelRefs.roughnessBtn,
    groupBtn: panelRefs.groupBtn, ungroupBtn: panelRefs.ungroupBtn,
    rotateBtn: panelRefs.rotateBtn, svgBtn: panelRefs.svgBtn, pngBtn: panelRefs.pngBtn,
    dashBtn: panelRefs.dashBtn, pixelEraseBtn: panelRefs.pixelEraseBtn,
    opacitySlider: panelRefs.opacitySlider, fontFamilySelect: panelRefs.fontFamilySelect,
    cornerRadiusSlider: panelRefs.cornerRadiusSlider,
    widthLabel: panelRefs.widthLabel, widthDot: panelRefs.widthDot,
    colorInput: panelRefs.colorInput, zoomLabel, applyStyleBtn: panelRefs.applyStyleBtn,
  };
}

export { updateToolbarState } from './toolbar-theme';