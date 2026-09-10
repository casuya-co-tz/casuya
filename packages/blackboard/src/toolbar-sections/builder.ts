import type { Tool } from '../types';
import { TOOL_ICONS, TOOL_LABELS, TOOL_DESCRIPTIONS } from '../icons';
import type { SectionId, ToolbarSectionContext } from './types';

export function makeAction(icon: string, title: string, onClick: () => void, tooltipEl: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'casuya-action-btn';
  btn.textContent = icon;
  btn.title = title;
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  btn.addEventListener('mouseenter', () => { tooltipEl.textContent = title; });
  btn.addEventListener('mouseleave', () => { tooltipEl.textContent = ''; });
  return btn;
}

export function makeToolBtn(tool: Tool, ctx: ToolbarSectionContext): HTMLButtonElement {
  const { board, toolButtons, tooltipEl, closePanels } = ctx;
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

export function makePanel(id: SectionId, ctx: ToolbarSectionContext): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'casuya-panel';
  ctx.panels[id] = panel;
  return panel;
}