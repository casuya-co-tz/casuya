export const TOOLBAR_STYLES = `
.casuya-section-btn {
  min-width: 56px; height: 40px; border: 2px solid transparent; border-radius: 8px;
  background: transparent; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px; padding: 3px 8px;
  transition: all 0.15s ease; font-family: inherit; color: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-section-btn:active { transform: scale(0.95); }
.casuya-section-btn span { font-size: 9px; line-height: 1; letter-spacing: 0.02em; }
.casuya-tool-btn {
  min-width: 40px; height: 36px; border: 2px solid transparent; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px; padding: 2px 6px;
  transition: all 0.15s ease; font-family: inherit; color: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-tool-btn:active { transform: scale(0.95); }
.casuya-tool-btn span { font-size: 8px; line-height: 1; }
.casuya-panel {
  position: absolute; top: 100%; left: 0; z-index: 100;
  border-radius: 10px; padding: 8px; display: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.casuya-panel.open { display: flex; flex-direction: column; gap: 8px; }
.casuya-panel-row { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.casuya-panel-label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }
.casuya-panel-sep { height: 1px; width: 100%; opacity: 0.2; }
.casuya-action-btn {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  font-size: 14px; transition: all 0.15s ease; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-action-btn:active { transform: scale(0.95); }
.casuya-swatch {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  transition: all 0.15s ease; padding: 0; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.casuya-swatch:active { transform: scale(0.9); }
.casuya-color-picker {
  width: 24px; height: 24px; border: none; border-radius: 50%; padding: 0;
  cursor: pointer; flex-shrink: 0; overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.casuya-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
.casuya-color-picker::-webkit-color-swatch { border-radius: 50%; }
.casuya-range {
  height: 3px; -webkit-appearance: none; appearance: none;
  border-radius: 2px; outline: none; cursor: pointer;
  transition: background 0.15s ease;
}
.casuya-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: currentColor; cursor: pointer;
  border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.casuya-range::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: currentColor; cursor: pointer;
  border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.casuya-select {
  font-size: 11px; border: 1px solid; border-radius: 4px;
  padding: 2px 4px; cursor: pointer; background: transparent; outline: none;
}
.casuya-zoom-group { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.casuya-zoom-btn {
  width: 28px; height: 28px; border: none; background: transparent; cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; transition: all 0.15s ease; flex-shrink: 0;
}
.casuya-zoom-btn:active { transform: scale(0.95); }
.casuya-zoom-label {
  cursor: pointer; font-size: 11px; min-width: 36px; text-align: center;
  user-select: none; padding: 0 4px;
}
.casuya-undo-redo { display: flex; gap: 2px; margin-left: 4px; }
.casuya-undo-redo button {
  width: 32px; height: 32px; border: none; border-radius: 6px;
  background: transparent; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  font-size: 16px; transition: all 0.15s ease;
}
.casuya-tooltip {
  width: 100%; padding: 4px 8px; font-size: 11px; min-height: 22px;
  box-sizing: border-box; line-height: 1.3; transition: all 0.15s ease;
}
.casuya-tooltip:empty { display: none; }
@media (max-width: 640px) {
  .casuya-section-btn { min-width: 44px; height: 36px; padding: 2px 4px; }
  .casuya-section-btn span { display: none; }
  .casuya-tool-btn { min-width: 34px; height: 34px; padding: 2px !important; }
  .casuya-tool-btn span { display: none !important; }
  .casuya-action-btn { width: 28px; height: 28px; font-size: 12px; }
  .casuya-swatch { width: 20px; height: 20px; }
  .casuya-color-picker { width: 20px; height: 20px; }
  .casuya-zoom-btn { width: 24px; height: 24px; font-size: 12px; }
  .casuya-zoom-label { font-size: 10px; min-width: 30px; }
  .casuya-tooltip { display: none !important; }
  .casuya-panel { right: 0; left: auto; }
}
`;

export function injectStyles(): void {
  if (document.getElementById('casuya-toolbar-styles')) return;
  const style = document.createElement('style');
  style.id = 'casuya-toolbar-styles';
  style.textContent = TOOLBAR_STYLES;
  document.head.appendChild(style);
}