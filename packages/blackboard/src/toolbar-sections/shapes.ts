import type { ToolbarPanelRefs, ToolbarSectionContext } from './types';
import { SECTION_TOOLS } from './types';
import { makeAction, makePanel, makeToolBtn } from './builder';

export function buildShapesSection(ctx: ToolbarSectionContext): Pick<ToolbarPanelRefs, 'fillBtn' | 'roughnessBtn' | 'dashBtn' | 'pixelEraseBtn' | 'cornerRadiusSlider'> {
  const { board, tooltipEl } = ctx;

  // ── SECTION: SHAPES ──
  const shapesPanel = makePanel('shapes', ctx);
  const shapesRow = document.createElement('div');
  shapesRow.className = 'casuya-panel-row';
  for (const tool of SECTION_TOOLS.shapes) {
    shapesRow.appendChild(makeToolBtn(tool, ctx));
  }
  shapesPanel.appendChild(shapesRow);
  const shapesSep = document.createElement('div');
  shapesSep.className = 'casuya-panel-sep';
  shapesPanel.appendChild(shapesSep);
  const shapesOpts = document.createElement('div');
  shapesOpts.className = 'casuya-panel-row';
  const fillBtn = makeAction('\u25A3', 'Fill: off', () => board.setFill(!board.getFill()), tooltipEl);
  fillBtn.dataset.role = 'fill';
  const roughnessLabels = ['Clean', 'Light', 'Medium', 'Heavy'];
  let roughnessIdx = board.getRoughness();
  const roughnessBtn = makeAction('\u2734', `Roughness: ${roughnessLabels[roughnessIdx]}`, () => {
    roughnessIdx = (roughnessIdx + 1) % 4;
    board.setRoughness(roughnessIdx);
    roughnessBtn.title = `Roughness: ${roughnessLabels[roughnessIdx]}`;
  }, tooltipEl);
  roughnessBtn.dataset.role = 'roughness';
  const dashBtn = makeAction('\u2506', 'Toggle dashed lines', () => board.setDashEnabled(!board.getDashEnabled()), tooltipEl);
  dashBtn.dataset.role = 'dash';
  const pixelEraseBtn = makeAction('\u232B', 'Toggle pixel eraser', () => board.setPixelEraser(!board.getPixelEraser()), tooltipEl);
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

  return { fillBtn, roughnessBtn, dashBtn, pixelEraseBtn, cornerRadiusSlider: cornerSlider };
}