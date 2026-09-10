import type { Tool, ToolbarElements } from '../types';
import { TOOLBAR_THEMES } from './defs';

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