import { FONT_FAMILIES } from '../types';
import type { ToolbarPanelRefs, ToolbarSectionContext } from './types';
import { makePanel, makeToolBtn } from './builder';

export function buildTextSection(ctx: ToolbarSectionContext): Pick<ToolbarPanelRefs, 'fontFamilySelect'> {
  const { board } = ctx;

  // ── SECTION: TEXT ──
  const textPanel = makePanel('text', ctx);
  const textRow = document.createElement('div');
  textRow.className = 'casuya-panel-row';
  textRow.appendChild(makeToolBtn('text', ctx));
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

  return { fontFamilySelect };
}