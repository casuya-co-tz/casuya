import type { ToolbarPanelRefs, ToolbarSectionContext } from './types';
import { makeAction, makePanel } from './builder';

export function buildExportSection(ctx: ToolbarSectionContext): Pick<ToolbarPanelRefs, 'svgBtn' | 'pngBtn' | 'pdfBtn' | 'saveBtn' | 'graphBtn' | 'themeBtn' | 'presentBtn' | 'latexBtn'> {
  const { board, tooltipEl } = ctx;

  // ── SECTION: EXPORT ──
  const exportPanel = makePanel('export', ctx);
  const exportRow1 = document.createElement('div');
  exportRow1.className = 'casuya-panel-row';
  const svgBtn = makeAction('\u2B1A', 'Export SVG', () => {
    const svg = board.exportSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'blackboard.svg'; a.click();
    URL.revokeObjectURL(url);
  }, tooltipEl);
  const pngBtn = makeAction('\uD83D\uDDBC', 'Export PNG', () => board.exportPNG(), tooltipEl);
  const pdfBtn = makeAction('\uD83D\uDCC4', 'Export PDF', () => board.exportPDF(), tooltipEl);
  const saveBtn = makeAction('\u2193', 'Save to browser', () => { board.saveToStorage(); board.showToast('\u2713 Saved'); }, tooltipEl);
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
  }, tooltipEl);
  graphBtn.dataset.role = 'graph';
  const themeBtn = makeAction(board.getTheme() === 'light' ? '\u263E' : '\u2600', 'Toggle theme', () => {
    board.setTheme(board.getTheme() === 'light' ? 'dark' : 'light');
  }, tooltipEl);
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
  }, tooltipEl);
  const latexBtn = makeAction('\u03A3', 'Insert LaTeX equation', () => {
    const latex = prompt('Enter LaTeX expression:', 'E = mc^2');
    if (latex) board.insertLaTeX(latex);
  }, tooltipEl);
  exportRow3.appendChild(presentBtn);
  exportRow3.appendChild(latexBtn);
  exportPanel.appendChild(exportRow3);

  return { svgBtn, pngBtn, pdfBtn, saveBtn, graphBtn, themeBtn, presentBtn, latexBtn };
}