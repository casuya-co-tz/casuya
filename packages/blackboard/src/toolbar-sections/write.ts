import { COLORS } from '../icons';
import type { ToolbarPanelRefs, ToolbarSectionContext } from './types';
import { SECTION_TOOLS } from './types';
import { makePanel, makeToolBtn } from './builder';

export function buildWriteSection(ctx: ToolbarSectionContext): Pick<ToolbarPanelRefs, 'colorInput' | 'widthLabel' | 'widthDot' | 'opacitySlider'> {
  const { board, tooltipEl } = ctx;

  // ── SECTION: WRITE ──
  const writePanel = makePanel('write', ctx);
  const writeRow1 = document.createElement('div');
  writeRow1.className = 'casuya-panel-row';
  for (const tool of SECTION_TOOLS.write) {
    writeRow1.appendChild(makeToolBtn(tool, ctx));
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

  return { colorInput, widthLabel, widthDot, opacitySlider };
}