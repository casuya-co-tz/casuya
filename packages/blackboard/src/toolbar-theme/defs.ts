export interface ToolbarThemeDef {
  barBg: string;
  barBorder: string;
  btnColor: string;
  btnHover: string;
  btnHoverBg: string;
  activeBg: string;
  activeColor: string;
  activeBorder: string;
  sep: string;
  tipBg: string;
  tipBorder: string;
  tipColor: string;
  panelBg: string;
  panelBorder: string;
  panelShadow: string;
}

export const TOOLBAR_THEMES: Record<'light' | 'dark', ToolbarThemeDef> = {
  light: { barBg: '#f8fafc', barBorder: '#e2e8f0', btnColor: '#64748b', btnHover: '#334155', btnHoverBg: '#e2e8f0', activeBg: '#dbeafe', activeColor: '#2563eb', activeBorder: '#93c5fd', sep: '#e2e8f0', tipBg: '#f1f5f9', tipBorder: '#e2e8f0', tipColor: '#64748b', panelBg: '#ffffff', panelBorder: '#e2e8f0', panelShadow: 'rgba(0,0,0,0.08)' },
  dark: { barBg: '#1e1e2e', barBorder: '#313244', btnColor: '#6c7086', btnHover: '#cdd6f4', btnHoverBg: '#313244', activeBg: '#313244', activeColor: '#89b4fa', activeBorder: '#45475a', sep: '#313244', tipBg: '#181825', tipBorder: '#313244', tipColor: '#6c7086', panelBg: '#181825', panelBorder: '#313244', panelShadow: 'rgba(0,0,0,0.3)' },
};

export function applyToolbarTheme(bar: HTMLElement, tooltipEl: HTMLElement, themeDef: ToolbarThemeDef): void {
  bar.style.background = themeDef.barBg;
  bar.style.borderColor = themeDef.barBorder;
  tooltipEl.style.background = themeDef.tipBg;
  tooltipEl.style.borderColor = themeDef.tipBorder;
  tooltipEl.style.color = themeDef.tipColor;
  const seps = bar.querySelectorAll('.casuya-separator');
  seps.forEach(s => { (s as HTMLElement).style.background = themeDef.sep; });
  const allPanels = bar.querySelectorAll('.casuya-panel') as NodeListOf<HTMLElement>;
  allPanels.forEach(p => { p.style.background = themeDef.panelBg; p.style.borderColor = themeDef.panelBorder; });
}