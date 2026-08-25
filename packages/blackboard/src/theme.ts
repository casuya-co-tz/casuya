export const MOBILE_STYLES = `
.casuya-blackboard { border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important; }
.casuya-blackboard .casuya-toast { font-size: 11px !important; padding: 6px 12px !important; bottom: 8px !important; }
.casuya-blackboard .casuya-hint { font-size: 11px !important; }
.casuya-blackboard textarea { font-size: 16px !important; }
`;

export function injectMobileStyles(): void {
  if (document.getElementById('casuya-blackboard-mobile')) return;
  const style = document.createElement('style');
  style.id = 'casuya-blackboard-mobile';
  style.textContent = MOBILE_STYLES;
  document.head.appendChild(style);
}

export const THEMES = {
  light: { canvasBg: '#ffffff', gridColor: '#e2e8f0', gridAxisColor: '#94a3b8', gridLabelColor: '#64748b', hintColor: '#cbd5e1', selectionColor: '#3b82f6', selectionFill: 'rgba(59, 130, 246, 0.1)' },
  dark: { canvasBg: '#1e1e2e', gridColor: '#313244', gridAxisColor: '#585b70', gridLabelColor: '#6c7086', hintColor: '#45475a', selectionColor: '#89b4fa', selectionFill: 'rgba(137, 180, 250, 0.1)' },
};

export type ThemeName = keyof typeof THEMES;
