import type { ToolbarPanelRefs, ToolbarSectionContext } from './types';
import { SECTION_TOOLS } from './types';
import { makeAction, makePanel, makeToolBtn } from './builder';

export function buildEditSection(ctx: ToolbarSectionContext): Pick<ToolbarPanelRefs, 'groupBtn' | 'ungroupBtn' | 'rotateBtn' | 'applyStyleBtn'> {
  const { board, tooltipEl } = ctx;

  // ── SECTION: EDIT ──
  const editPanel = makePanel('edit', ctx);
  const editRow1 = document.createElement('div');
  editRow1.className = 'casuya-panel-row';
  for (const tool of SECTION_TOOLS.edit) {
    editRow1.appendChild(makeToolBtn(tool, ctx));
  }
  editPanel.appendChild(editRow1);
  const editSep = document.createElement('div');
  editSep.className = 'casuya-panel-sep';
  editPanel.appendChild(editSep);
  const editRow2 = document.createElement('div');
  editRow2.className = 'casuya-panel-row';
  const clearBtn = makeAction('\u2715', 'Clear all', () => board.clear(), tooltipEl);
  const groupBtn = makeAction('\u2261', 'Group (Ctrl+G)', () => board.groupSelected(), tooltipEl);
  const ungroupBtn = makeAction('\u2262', 'Ungroup (Ctrl+Shift+G)', () => board.ungroupSelected(), tooltipEl);
  const rotateBtn = makeAction('\u21BB', 'Rotate 15\u00B0 (Shift+R)', () => board.rotateSelected(Math.PI / 12), tooltipEl);
  const applyStyleBtn = makeAction('\u270E', 'Apply style (Ctrl+Shift+F)', () => board.applyStyleToSelected(), tooltipEl);
  editRow2.appendChild(clearBtn);
  editRow2.appendChild(groupBtn);
  editRow2.appendChild(ungroupBtn);
  editRow2.appendChild(rotateBtn);
  editRow2.appendChild(applyStyleBtn);
  editPanel.appendChild(editRow2);

  return { groupBtn, ungroupBtn, rotateBtn, applyStyleBtn };
}