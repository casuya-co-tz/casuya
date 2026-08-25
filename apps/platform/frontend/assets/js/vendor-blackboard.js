"use strict";
var CasuyaBlackboard = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/browser-core.ts
  var browser_core_exports = {};
  __export(browser_core_exports, {
    Blackboard: () => Blackboard,
    createToolbar: () => createToolbar,
    updateToolbarState: () => updateToolbarState
  });

  // src/types.ts
  var FONT_FAMILIES = [
    "system-ui, -apple-system, sans-serif",
    "Georgia, serif",
    '"Courier New", monospace',
    '"Trebuchet MS", sans-serif',
    "Impact, sans-serif",
    '"Comic Sans MS", cursive',
    "Verdana, sans-serif",
    "Arial, sans-serif"
  ];

  // src/toolbar.ts
  var TOOLBAR_THEMES = {
    light: { barBg: "#f8fafc", barBorder: "#e2e8f0", btnColor: "#64748b", btnHover: "#334155", btnHoverBg: "#e2e8f0", activeBg: "#dbeafe", activeColor: "#2563eb", activeBorder: "#93c5fd", sep: "#e2e8f0", tipBg: "#f1f5f9", tipBorder: "#e2e8f0", tipColor: "#64748b", panelBg: "#ffffff", panelBorder: "#e2e8f0", panelShadow: "rgba(0,0,0,0.08)" },
    dark: { barBg: "#1e1e2e", barBorder: "#313244", btnColor: "#6c7086", btnHover: "#cdd6f4", btnHoverBg: "#313244", activeBg: "#313244", activeColor: "#89b4fa", activeBorder: "#45475a", sep: "#313244", tipBg: "#181825", tipBorder: "#313244", tipColor: "#6c7086", panelBg: "#181825", panelBorder: "#313244", panelShadow: "rgba(0,0,0,0.3)" }
  };
  var SECTION_ICONS = {
    write: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
    shapes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
    text: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    edit: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`,
    export: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
  };
  var SECTION_LABELS = {
    write: "Write",
    shapes: "Shapes",
    text: "Text",
    edit: "Edit",
    export: "Export"
  };
  var TOOL_ICONS = {
    select: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>`,
    hand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V4a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
    pen: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
    highlighter: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
    text: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    line: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>`,
    rect: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
    circle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
    arrow: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    eraser: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
    laser: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3m-9-9h3m12 0h3"/><path d="m4.9 4.9 2.1 2.1m9.9 9.9 2.1 2.1m-14 0 2.1-2.1m9.9-9.9 2.1-2.1"/></svg>`,
    diamond: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L22 12L12 22L2 12Z"/></svg>`
  };
  var TOOL_LABELS = {
    select: "Select",
    hand: "Hand",
    pen: "Pen",
    highlighter: "Marker",
    text: "Text",
    line: "Line",
    rect: "Rect",
    circle: "Circle",
    arrow: "Arrow",
    eraser: "Eraser",
    laser: "Laser",
    diamond: "Diamond"
  };
  var TOOL_DESCRIPTIONS = {
    select: "Select, move, resize (V)",
    hand: "Pan canvas (H)",
    pen: "Draw with pen (P)",
    highlighter: "Highlight marker (M)",
    text: "Add text (T)",
    line: "Straight line (L)",
    rect: "Rectangle (R)",
    circle: "Ellipse (O)",
    arrow: "Arrow (A)",
    eraser: "Erase (E)",
    laser: "Laser pointer (B)",
    diamond: "Diamond shape (N)"
  };
  var COLORS = ["#1e293b", "#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#9333ea", "#ea580c", "#0891b2"];
  var TOOLBAR_STYLES = `
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
  function injectStyles() {
    if (document.getElementById("casuya-toolbar-styles")) return;
    const style = document.createElement("style");
    style.id = "casuya-toolbar-styles";
    style.textContent = TOOLBAR_STYLES;
    document.head.appendChild(style);
  }
  var SECTION_TOOLS = {
    write: ["pen", "highlighter", "eraser", "laser"],
    shapes: ["line", "rect", "circle", "arrow", "diamond"],
    text: ["text"],
    edit: ["select", "hand"],
    export: []
  };
  function createToolbar(board) {
    injectStyles();
    const bar = document.createElement("div");
    bar.style.cssText = "display: flex; flex-direction: column; transition: all 0.15s ease; border-bottom-width: 1px; border-bottom-style: solid; position: relative;";
    const mainRow = document.createElement("div");
    mainRow.style.cssText = "display: flex; align-items: center; gap: 4px; padding: 4px 10px;";
    const tooltipEl = document.createElement("div");
    tooltipEl.className = "casuya-tooltip";
    const toolButtons = /* @__PURE__ */ new Map();
    let activePanel = null;
    const panels = {};
    let outsideHandler = null;
    const getTheme = () => TOOLBAR_THEMES[board.getTheme()];
    const closePanels = () => {
      for (const id of Object.keys(panels)) {
        panels[id].classList.remove("open");
        const btn = bar.querySelector(`[data-section="${id}"]`);
        if (btn) {
          btn.style.background = "transparent";
          btn.style.color = getTheme().btnColor;
          btn.style.borderColor = "transparent";
        }
      }
      activePanel = null;
    };
    const togglePanel = (id) => {
      if (activePanel === id) {
        closePanels();
        return;
      }
      closePanels();
      activePanel = id;
      const t = getTheme();
      panels[id].classList.add("open");
      const btn = bar.querySelector(`[data-section="${id}"]`);
      if (btn) {
        btn.style.background = t.activeBg;
        btn.style.color = t.activeColor;
        btn.style.borderColor = t.activeBorder;
      }
    };
    function makeToolBtn(tool) {
      const btn = document.createElement("button");
      btn.className = "casuya-tool-btn";
      btn.innerHTML = `${TOOL_ICONS[tool]}<span>${TOOL_LABELS[tool]}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        board.setTool(tool);
        setTimeout(closePanels, 80);
      });
      btn.addEventListener("mouseenter", () => {
        tooltipEl.textContent = TOOL_DESCRIPTIONS[tool];
      });
      btn.addEventListener("mouseleave", () => {
        tooltipEl.textContent = "";
      });
      toolButtons.set(tool, btn);
      return btn;
    }
    function makeAction(icon, title, onClick) {
      const btn = document.createElement("button");
      btn.className = "casuya-action-btn";
      btn.textContent = icon;
      btn.title = title;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
      btn.addEventListener("mouseenter", () => {
        tooltipEl.textContent = title;
      });
      btn.addEventListener("mouseleave", () => {
        tooltipEl.textContent = "";
      });
      return btn;
    }
    function makeSectionButton(id) {
      const btn = document.createElement("button");
      btn.className = "casuya-section-btn";
      btn.dataset.section = id;
      btn.innerHTML = `${SECTION_ICONS[id]}<span>${SECTION_LABELS[id]}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePanel(id);
      });
      btn.addEventListener("mouseenter", () => {
        tooltipEl.textContent = SECTION_LABELS[id] + " tools";
      });
      btn.addEventListener("mouseleave", () => {
        tooltipEl.textContent = "";
      });
      return btn;
    }
    function makePanel(id) {
      const panel = document.createElement("div");
      panel.className = "casuya-panel";
      panels[id] = panel;
      return panel;
    }
    const writePanel = makePanel("write");
    const writeRow1 = document.createElement("div");
    writeRow1.className = "casuya-panel-row";
    for (const tool of SECTION_TOOLS.write) {
      writeRow1.appendChild(makeToolBtn(tool));
    }
    writePanel.appendChild(writeRow1);
    const writeSep = document.createElement("div");
    writeSep.className = "casuya-panel-sep";
    writePanel.appendChild(writeSep);
    const writeColors = document.createElement("div");
    writeColors.className = "casuya-panel-row";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "casuya-color-picker";
    colorInput.value = board.getColor();
    colorInput.addEventListener("input", () => board.setColor(colorInput.value));
    for (const color of COLORS) {
      const swatch = document.createElement("button");
      swatch.className = "casuya-swatch";
      swatch.style.background = color;
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        board.setColor(color);
        colorInput.value = color;
      });
      writeColors.appendChild(swatch);
    }
    writeColors.appendChild(colorInput);
    writePanel.appendChild(writeColors);
    const writeWidth = document.createElement("div");
    writeWidth.className = "casuya-panel-row";
    const widthLabel = document.createElement("span");
    widthLabel.className = "casuya-panel-label";
    widthLabel.textContent = "Width";
    const widthSlider = document.createElement("input");
    widthSlider.type = "range";
    widthSlider.min = "1";
    widthSlider.max = "20";
    widthSlider.value = String(board.getWidth());
    widthSlider.className = "casuya-range";
    widthSlider.style.cssText = "width: 120px;";
    widthSlider.addEventListener("input", () => {
      if (board.getTool() === "text") board.setFontSize(Number(widthSlider.value));
      else board.setWidth(Number(widthSlider.value));
    });
    const widthPreview = document.createElement("div");
    widthPreview.style.cssText = "width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;";
    const widthDot = document.createElement("div");
    widthDot.style.cssText = `background: ${board.getColor()}; border-radius: 50%; width: 4px; height: 4px; transition: all 0.15s ease;`;
    widthPreview.appendChild(widthDot);
    writeWidth.appendChild(widthLabel);
    writeWidth.appendChild(widthSlider);
    writeWidth.appendChild(widthPreview);
    writePanel.appendChild(writeWidth);
    const writeOpacity = document.createElement("div");
    writeOpacity.className = "casuya-panel-row";
    const opLabel = document.createElement("span");
    opLabel.className = "casuya-panel-label";
    opLabel.textContent = "Opacity";
    const opacitySlider = document.createElement("input");
    opacitySlider.type = "range";
    opacitySlider.min = "0.05";
    opacitySlider.max = "1";
    opacitySlider.step = "0.05";
    opacitySlider.value = String(board.getOpacity());
    opacitySlider.className = "casuya-range";
    opacitySlider.style.cssText = "width: 120px;";
    opacitySlider.addEventListener("input", () => board.setOpacity(Number(opacitySlider.value)));
    writeOpacity.appendChild(opLabel);
    writeOpacity.appendChild(opacitySlider);
    writePanel.appendChild(writeOpacity);
    const shapesPanel = makePanel("shapes");
    const shapesRow = document.createElement("div");
    shapesRow.className = "casuya-panel-row";
    for (const tool of SECTION_TOOLS.shapes) {
      shapesRow.appendChild(makeToolBtn(tool));
    }
    shapesPanel.appendChild(shapesRow);
    const shapesSep = document.createElement("div");
    shapesSep.className = "casuya-panel-sep";
    shapesPanel.appendChild(shapesSep);
    const shapesOpts = document.createElement("div");
    shapesOpts.className = "casuya-panel-row";
    const fillBtn = makeAction("\u25A3", "Fill: off", () => board.setFill(!board.getFill()));
    fillBtn.dataset.role = "fill";
    const roughnessLabels = ["Clean", "Light", "Medium", "Heavy"];
    let roughnessIdx = board.getRoughness();
    const roughnessBtn = makeAction("\u2734", `Roughness: ${roughnessLabels[roughnessIdx]}`, () => {
      roughnessIdx = (roughnessIdx + 1) % 4;
      board.setRoughness(roughnessIdx);
      roughnessBtn.title = `Roughness: ${roughnessLabels[roughnessIdx]}`;
    });
    roughnessBtn.dataset.role = "roughness";
    const dashBtn = makeAction("\u2506", "Toggle dashed lines", () => board.setDashEnabled(!board.getDashEnabled()));
    dashBtn.dataset.role = "dash";
    const pixelEraseBtn = makeAction("\u232B", "Toggle pixel eraser", () => board.setPixelEraser(!board.getPixelEraser()));
    pixelEraseBtn.dataset.role = "pixelErase";
    shapesOpts.appendChild(fillBtn);
    shapesOpts.appendChild(roughnessBtn);
    shapesOpts.appendChild(dashBtn);
    shapesOpts.appendChild(pixelEraseBtn);
    shapesPanel.appendChild(shapesOpts);
    const shapesCorner = document.createElement("div");
    shapesCorner.className = "casuya-panel-row";
    const cornerLabel = document.createElement("span");
    cornerLabel.className = "casuya-panel-label";
    cornerLabel.textContent = "Corner";
    const cornerSlider = document.createElement("input");
    cornerSlider.type = "range";
    cornerSlider.min = "0";
    cornerSlider.max = "50";
    cornerSlider.value = String(board.getCornerRadius());
    cornerSlider.className = "casuya-range";
    cornerSlider.style.cssText = "width: 100px;";
    cornerSlider.addEventListener("input", () => board.setCornerRadius(Number(cornerSlider.value)));
    shapesCorner.appendChild(cornerLabel);
    shapesCorner.appendChild(cornerSlider);
    shapesPanel.appendChild(shapesCorner);
    const textPanel = makePanel("text");
    const textRow = document.createElement("div");
    textRow.className = "casuya-panel-row";
    textRow.appendChild(makeToolBtn("text"));
    textPanel.appendChild(textRow);
    const textSep = document.createElement("div");
    textSep.className = "casuya-panel-sep";
    textPanel.appendChild(textSep);
    const fontFamilySelect = document.createElement("select");
    fontFamilySelect.className = "casuya-select";
    fontFamilySelect.title = "Font Family";
    for (const ff of FONT_FAMILIES) {
      const opt = document.createElement("option");
      opt.value = ff;
      opt.textContent = ff.split(",")[0].replace(/"/g, "");
      fontFamilySelect.appendChild(opt);
    }
    fontFamilySelect.value = board.getFontFamily();
    fontFamilySelect.addEventListener("change", () => board.setFontFamily(fontFamilySelect.value));
    const fontRow = document.createElement("div");
    fontRow.className = "casuya-panel-row";
    fontRow.appendChild(fontFamilySelect);
    textPanel.appendChild(fontRow);
    const editPanel = makePanel("edit");
    const editRow1 = document.createElement("div");
    editRow1.className = "casuya-panel-row";
    for (const tool of SECTION_TOOLS.edit) {
      editRow1.appendChild(makeToolBtn(tool));
    }
    editPanel.appendChild(editRow1);
    const editSep = document.createElement("div");
    editSep.className = "casuya-panel-sep";
    editPanel.appendChild(editSep);
    const editRow2 = document.createElement("div");
    editRow2.className = "casuya-panel-row";
    const clearBtn = makeAction("\u2715", "Clear all", () => board.clear());
    const groupBtn = makeAction("\u2261", "Group (Ctrl+G)", () => board.groupSelected());
    const ungroupBtn = makeAction("\u2262", "Ungroup (Ctrl+Shift+G)", () => board.ungroupSelected());
    const rotateBtn = makeAction("\u21BB", "Rotate 15\xB0 (Shift+R)", () => board.rotateSelected(Math.PI / 12));
    const applyStyleBtn = makeAction("\u270E", "Apply style (Ctrl+Shift+F)", () => board.applyStyleToSelected());
    editRow2.appendChild(clearBtn);
    editRow2.appendChild(groupBtn);
    editRow2.appendChild(ungroupBtn);
    editRow2.appendChild(rotateBtn);
    editRow2.appendChild(applyStyleBtn);
    editPanel.appendChild(editRow2);
    const exportPanel = makePanel("export");
    const exportRow1 = document.createElement("div");
    exportRow1.className = "casuya-panel-row";
    const svgBtn = makeAction("\u2B1A", "Export SVG", () => {
      const svg = board.exportSVG();
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "blackboard.svg";
      a.click();
      URL.revokeObjectURL(url);
    });
    const pngBtn = makeAction("\u{1F5BC}", "Export PNG", () => board.exportPNG());
    const pdfBtn = makeAction("\u{1F4C4}", "Export PDF", () => board.exportPDF());
    const saveBtn = makeAction("\u2193", "Save to browser", () => {
      board.saveToStorage();
      board.showToast("\u2713 Saved");
    });
    exportRow1.appendChild(svgBtn);
    exportRow1.appendChild(pngBtn);
    exportRow1.appendChild(pdfBtn);
    exportRow1.appendChild(saveBtn);
    exportPanel.appendChild(exportRow1);
    const exportSep = document.createElement("div");
    exportSep.className = "casuya-panel-sep";
    exportPanel.appendChild(exportSep);
    const exportRow2 = document.createElement("div");
    exportRow2.className = "casuya-panel-row";
    const graphBtn = makeAction("\u229E", "Toggle graph paper", () => {
      if (board.isGraphEnabled()) board.disableGraph();
      else board.enableGraph();
    });
    graphBtn.dataset.role = "graph";
    const themeBtn = makeAction(board.getTheme() === "light" ? "\u263E" : "\u2600", "Toggle theme", () => {
      board.setTheme(board.getTheme() === "light" ? "dark" : "light");
    });
    themeBtn.dataset.role = "theme";
    exportRow2.appendChild(graphBtn);
    exportRow2.appendChild(themeBtn);
    exportPanel.appendChild(exportRow2);
    const exportSep2 = document.createElement("div");
    exportSep2.className = "casuya-panel-sep";
    exportPanel.appendChild(exportSep2);
    const exportRow3 = document.createElement("div");
    exportRow3.className = "casuya-panel-row";
    const presentBtn = makeAction("\u25B6", "Presentation mode", () => {
      if (board.isPresenting()) board.stopPresentation();
      else board.startPresentation();
    });
    const latexBtn = makeAction("\u03A3", "Insert LaTeX equation", () => {
      const latex = prompt("Enter LaTeX expression:", "E = mc^2");
      if (latex) board.insertLaTeX(latex);
    });
    exportRow3.appendChild(presentBtn);
    exportRow3.appendChild(latexBtn);
    exportPanel.appendChild(exportRow3);
    mainRow.appendChild(makeSectionButton("write"));
    mainRow.appendChild(makeSectionButton("shapes"));
    mainRow.appendChild(makeSectionButton("text"));
    mainRow.appendChild(makeSectionButton("edit"));
    mainRow.appendChild(makeSectionButton("export"));
    const sepEl = document.createElement("div");
    sepEl.className = "casuya-toolbar-sep casuya-separator";
    sepEl.style.cssText = "width: 1px; height: 28px; margin: 0 4px; flex-shrink: 0;";
    mainRow.appendChild(sepEl);
    const undoBtn = makeAction("\u21A9", "Undo (Ctrl+Z)", () => board.undo());
    const redoBtn = makeAction("\u21AA", "Redo (Ctrl+Shift+Z)", () => board.redo());
    const undoRedoGroup = document.createElement("div");
    undoRedoGroup.className = "casuya-undo-redo";
    undoRedoGroup.appendChild(undoBtn);
    undoRedoGroup.appendChild(redoBtn);
    mainRow.appendChild(undoRedoGroup);
    const zoomGroup = document.createElement("div");
    zoomGroup.className = "casuya-zoom-group";
    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "casuya-zoom-btn";
    zoomOutBtn.textContent = "\u2212";
    zoomOutBtn.title = "Zoom Out";
    zoomOutBtn.addEventListener("click", () => board.zoomTo(board.getZoom() / 1.25));
    const zoomLabel = document.createElement("span");
    zoomLabel.className = "casuya-zoom-label";
    zoomLabel.textContent = Math.round(board.getZoom() * 100) + "%";
    zoomLabel.title = "Reset Zoom";
    zoomLabel.addEventListener("click", () => board.resetView());
    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "casuya-zoom-btn";
    zoomInBtn.textContent = "+";
    zoomInBtn.title = "Zoom In";
    zoomInBtn.addEventListener("click", () => board.zoomTo(board.getZoom() * 1.25));
    zoomGroup.appendChild(zoomOutBtn);
    zoomGroup.appendChild(zoomLabel);
    zoomGroup.appendChild(zoomInBtn);
    mainRow.appendChild(zoomGroup);
    bar.appendChild(mainRow);
    for (const id of Object.keys(panels)) {
      bar.appendChild(panels[id]);
    }
    bar.appendChild(tooltipEl);
    outsideHandler = (e) => {
      if (!bar.contains(e.target)) closePanels();
    };
    document.addEventListener("pointerdown", outsideHandler);
    const applyTheme = () => {
      const t = getTheme();
      bar.style.background = t.barBg;
      bar.style.borderColor = t.barBorder;
      tooltipEl.style.background = t.tipBg;
      tooltipEl.style.borderColor = t.tipBorder;
      tooltipEl.style.color = t.tipColor;
      const seps = bar.querySelectorAll(".casuya-separator");
      seps.forEach((s) => {
        s.style.background = t.sep;
      });
      const allPanels = bar.querySelectorAll(".casuya-panel");
      allPanels.forEach((p) => {
        p.style.background = t.panelBg;
        p.style.borderColor = t.panelBorder;
      });
    };
    applyTheme();
    return {
      bar,
      toolButtons,
      undoBtn,
      redoBtn,
      graphBtn,
      fillBtn,
      themeBtn,
      roughnessBtn,
      groupBtn,
      ungroupBtn,
      rotateBtn,
      svgBtn,
      pngBtn,
      dashBtn,
      pixelEraseBtn,
      opacitySlider,
      fontFamilySelect,
      cornerRadiusSlider: cornerSlider,
      widthLabel,
      widthDot,
      colorInput,
      zoomLabel,
      applyStyleBtn
    };
  }
  function updateToolbarState(tb, activeTool, color, width, fillEnabled, theme, zoom, fontSize, roughness, graphEnabled, dashEnabled, opacity, fontFamily, cornerRadius, pixelEraser) {
    const themeDef = TOOLBAR_THEMES[theme];
    tb.bar.style.background = themeDef.barBg;
    tb.bar.style.borderColor = themeDef.barBorder;
    for (const [tool, btn] of tb.toolButtons) {
      const active = tool === activeTool;
      btn.style.background = active ? themeDef.activeBg : "transparent";
      btn.style.color = active ? themeDef.activeColor : themeDef.btnColor;
      btn.style.borderColor = active ? themeDef.activeBorder : "transparent";
    }
    if (tb.widthLabel) {
      const slider = tb.widthLabel.nextElementSibling;
      if (activeTool === "text") {
        tb.widthLabel.textContent = `${fontSize ?? 18}px`;
        if (slider && slider.tagName === "INPUT") {
          slider.min = "8";
          slider.max = "72";
          slider.value = String(fontSize ?? 18);
        }
      } else {
        tb.widthLabel.textContent = "Width";
        if (slider && slider.tagName === "INPUT") {
          slider.min = "1";
          slider.max = "20";
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
      tb.fillBtn.title = "Fill: on";
      tb.fillBtn.dataset.active = "true";
    } else {
      tb.fillBtn.style.background = "transparent";
      tb.fillBtn.style.color = themeDef.btnColor;
      tb.fillBtn.title = "Fill: off";
      delete tb.fillBtn.dataset.active;
    }
    if (roughness !== void 0) {
      const roughnessLabels = ["Clean", "Light", "Medium", "Heavy"];
      tb.roughnessBtn.title = `Roughness: ${roughnessLabels[roughness]}`;
      if (roughness > 0) {
        tb.roughnessBtn.style.background = themeDef.activeBg;
        tb.roughnessBtn.style.color = themeDef.activeColor;
        tb.roughnessBtn.dataset.active = "true";
      } else {
        tb.roughnessBtn.style.background = "transparent";
        tb.roughnessBtn.style.color = themeDef.btnColor;
        delete tb.roughnessBtn.dataset.active;
      }
    }
    tb.themeBtn.textContent = theme === "light" ? "\u263E" : "\u2600";
    tb.themeBtn.style.color = themeDef.btnColor;
    tb.themeBtn.style.background = "transparent";
    if (graphEnabled) {
      tb.graphBtn.style.background = themeDef.activeBg;
      tb.graphBtn.style.color = themeDef.activeColor;
      tb.graphBtn.dataset.active = "true";
    } else {
      tb.graphBtn.style.background = "transparent";
      tb.graphBtn.style.color = themeDef.btnColor;
      delete tb.graphBtn.dataset.active;
    }
    tb.zoomLabel.textContent = Math.round(zoom * 100) + "%";
    tb.zoomLabel.style.color = themeDef.btnColor;
    const zoomBtns = tb.zoomLabel.parentElement?.querySelectorAll("button") || [];
    zoomBtns.forEach((b) => {
      b.style.color = themeDef.btnColor;
      b.style.background = "transparent";
    });
    const undoRedoBtns = tb.undoBtn.parentElement?.querySelectorAll("button") || [];
    undoRedoBtns.forEach((b) => {
      b.style.color = themeDef.btnColor;
      b.style.background = "transparent";
    });
    if (dashEnabled) {
      tb.dashBtn.style.background = themeDef.activeBg;
      tb.dashBtn.style.color = themeDef.activeColor;
      tb.dashBtn.dataset.active = "true";
    } else {
      tb.dashBtn.style.background = "transparent";
      tb.dashBtn.style.color = themeDef.btnColor;
      delete tb.dashBtn.dataset.active;
    }
    if (pixelEraser) {
      tb.pixelEraseBtn.style.background = themeDef.activeBg;
      tb.pixelEraseBtn.style.color = themeDef.activeColor;
      tb.pixelEraseBtn.dataset.active = "true";
    } else {
      tb.pixelEraseBtn.style.background = "transparent";
      tb.pixelEraseBtn.style.color = themeDef.btnColor;
      delete tb.pixelEraseBtn.dataset.active;
    }
    if (opacity !== void 0) tb.opacitySlider.value = String(opacity);
    if (fontFamily !== void 0 && tb.fontFamilySelect) tb.fontFamilySelect.value = fontFamily;
    if (cornerRadius !== void 0 && tb.cornerRadiusSlider) tb.cornerRadiusSlider.value = String(cornerRadius);
    const seps = tb.bar.querySelectorAll(".casuya-separator");
    seps.forEach((s) => {
      s.style.background = themeDef.sep;
    });
    const tooltip = tb.bar.querySelector(".casuya-tooltip");
    if (tooltip) {
      tooltip.style.background = themeDef.tipBg;
      tooltip.style.borderColor = themeDef.tipBorder;
      tooltip.style.color = themeDef.tipColor;
    }
    const allPanels = tb.bar.querySelectorAll(".casuya-panel");
    allPanels.forEach((p) => {
      p.style.background = themeDef.panelBg;
      p.style.borderColor = themeDef.panelBorder;
    });
  }

  // src/Blackboard.ts
  var IS_MOBILE = () => window.innerWidth <= 640;
  function uid() {
    try {
      return crypto.randomUUID();
    } catch {
      return "xxxx-xxxx-xxxx".replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
    }
  }
  function isInInput(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    return el.closest('input, textarea, [contenteditable="true"], select') !== null;
  }
  var MOBILE_STYLES = `
.casuya-blackboard { border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important; }
.casuya-blackboard .casuya-toast { font-size: 11px !important; padding: 6px 12px !important; bottom: 8px !important; }
.casuya-blackboard .casuya-hint { font-size: 11px !important; }
.casuya-blackboard textarea { font-size: 16px !important; }
`;
  function injectMobileStyles() {
    if (document.getElementById("casuya-blackboard-mobile")) return;
    const style = document.createElement("style");
    style.id = "casuya-blackboard-mobile";
    style.textContent = MOBILE_STYLES;
    document.head.appendChild(style);
  }
  var THEMES = {
    light: { canvasBg: "#ffffff", gridColor: "#e2e8f0", gridAxisColor: "#94a3b8", gridLabelColor: "#64748b", hintColor: "#cbd5e1", selectionColor: "#3b82f6", selectionFill: "rgba(59, 130, 246, 0.1)" },
    dark: { canvasBg: "#1e1e2e", gridColor: "#313244", gridAxisColor: "#585b70", gridLabelColor: "#6c7086", hintColor: "#45475a", selectionColor: "#89b4fa", selectionFill: "rgba(137, 180, 250, 0.1)" }
  };
  var Blackboard = class _Blackboard {
    container;
    root;
    canvasWrapper;
    staticCanvas;
    liveCanvas;
    staticCtx;
    liveCtx;
    width;
    height;
    dpr;
    activeTool = "pen";
    strokeColor = "#1e293b";
    strokeWidth = 2;
    strokeOpacity = 1;
    fillEnabled = false;
    dashEnabled = false;
    pixelEraser = false;
    fontFamily = "system-ui, -apple-system, sans-serif";
    cornerRadius = 0;
    clipboardData = "";
    static instanceCount = 0;
    imagePool = [];
    imageSrcToIdx = /* @__PURE__ */ new Map();
    elements = [];
    undoStack = [];
    redoStack = [];
    static MAX_UNDO = 50;
    currentElement = null;
    isDrawing = false;
    graph;
    animFrameId = null;
    dirty = false;
    toolbar;
    listeners = /* @__PURE__ */ new Map();
    theme = "light";
    camera = { x: 0, y: 0, zoom: 1 };
    selectedIds = /* @__PURE__ */ new Set();
    dragState = null;
    isSpaceDown = false;
    isPanning = false;
    panStart = { x: 0, y: 0 };
    panCameraStart = { x: 0, y: 0 };
    textInput = null;
    editingTextId = null;
    editingTextOriginal = null;
    activePointerId = null;
    activePointerType = "mouse";
    lastPointerWorld = null;
    activePointers = /* @__PURE__ */ new Map();
    pinchStartDist = 0;
    pinchStartZoom = 1;
    pinchCenter = { x: 0, y: 0 };
    pinchStartCamera = { x: 0, y: 0 };
    contextMenu = null;
    helpOverlay = null;
    longPressTimer = null;
    longPressStart = null;
    boundHandleImagePaste;
    boundHandleDragOver;
    boundHandleFileDrop;
    fontSize = 18;
    clipboard = [];
    roughness = 0;
    alignmentGuides = {};
    imageCache = /* @__PURE__ */ new Map();
    resizeObserver = null;
    graphCanvas = null;
    graphCtx = null;
    graphDirty = true;
    marqueeStart = null;
    marqueeEnd = null;
    autosaveTimer = null;
    autosaveKey = "casuya-blackboard";
    dirtySinceSave = false;
    boundBeforeUnload = null;
    toastTimeout = null;
    usePressure = false;
    contextMenuKeyHandler = null;
    laserStrokes = [];
    laserAnimFrame = null;
    katexImageCache = /* @__PURE__ */ new Map();
    presenterMode = false;
    presenterStep = 0;
    presenterOverlay = null;
    collabAdapter = null;
    collabState = null;
    remoteCursors = /* @__PURE__ */ new Map();
    constructor(options) {
      _Blackboard.instanceCount++;
      this.container = options.container;
      this.autosaveKey = `casuya-blackboard-${_Blackboard.instanceCount}`;
      this.width = options.width || this.container.clientWidth || 800;
      this.height = options.height || this.container.clientHeight || 600;
      this.dpr = window.devicePixelRatio || 1;
      this.theme = options.theme || "light";
      injectMobileStyles();
      this.boundHandleImagePaste = this.handleImagePaste.bind(this);
      this.boundHandleDragOver = this.handleDragOver.bind(this);
      this.boundHandleFileDrop = this.handleFileDrop.bind(this);
      this.graph = {
        enabled: options.graph?.enabled ?? false,
        spacing: options.graph?.spacing ?? 25,
        color: options.graph?.color ?? "#e2e8f0",
        showAxes: options.graph?.showAxes ?? true,
        showLabels: options.graph?.showLabels ?? true
      };
      this.strokeColor = options.color || this.strokeColor;
      this.strokeWidth = options.strokeWidth || this.strokeWidth;
      if (options.width) this.width = options.width;
      if (options.height) this.height = options.height;
      this.dpr = window.devicePixelRatio || 1;
      const mobile = IS_MOBILE();
      this.root = document.createElement("div");
      this.root.className = "casuya-blackboard";
      this.root.style.cssText = `
      display: flex;
      flex-direction: column;
      border-radius: ${mobile ? 8 : 12}px;
      overflow: hidden;
      box-shadow: ${mobile ? "0 2px 8px rgba(0,0,0,0.06)" : "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)"};
      background: ${THEMES[this.theme].canvasBg};
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      width: 100%;
      height: 100%;
      touch-action: none;
      -webkit-touch-callout: none;
    `;
      this.canvasWrapper = document.createElement("div");
      this.canvasWrapper.style.cssText = "position: relative; overflow: hidden; flex: 1;";
      this.staticCanvas = document.createElement("canvas");
      this.liveCanvas = document.createElement("canvas");
      [this.staticCanvas, this.liveCanvas].forEach((c) => {
        c.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        touch-action: none;
      `;
      });
      this.staticCanvas.style.zIndex = "0";
      this.liveCanvas.style.zIndex = "1";
      this.canvasWrapper.appendChild(this.staticCanvas);
      this.canvasWrapper.appendChild(this.liveCanvas);
      this.toolbar = createToolbar(this);
      this.root.appendChild(this.toolbar.bar);
      this.root.appendChild(this.canvasWrapper);
      this.container.appendChild(this.root);
      if (!this.container.style.position) {
        this.container.style.position = "relative";
      }
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width: w, height: h } = entry.contentRect;
            if (w > 0 && h > 0) {
              this.resize(Math.floor(w), Math.floor(h));
            }
          }
        });
        this.resizeObserver.observe(this.canvasWrapper);
      }
      this.staticCtx = this.staticCanvas.getContext("2d");
      this.liveCtx = this.liveCanvas.getContext("2d");
      this.setupCanvases();
      this.attachEvents();
      this.setTool("pen");
      this.renderAll();
      this.updateToolbar();
      this.autosaveTimer = setInterval(() => {
        if (this.dirtySinceSave) {
          this.saveToStorage(this.autosaveKey);
          this.dirtySinceSave = false;
        }
      }, 3e4);
      this.boundBeforeUnload = (e) => {
        if (this.dirtySinceSave) {
          this.saveToStorage(this.autosaveKey);
          e.preventDefault();
          e.returnValue = "";
        }
      };
      window.addEventListener("beforeunload", this.boundBeforeUnload);
      this.loadFromStorage(this.autosaveKey);
      setTimeout(() => this.showToast("Select a tool and start drawing"), 600);
    }
    pushUndo() {
      const snapshot = this.elements.map((el) => {
        if (el.tool === "image") {
          const img = el;
          let idx = this.imageSrcToIdx.get(img.src);
          if (idx === void 0) {
            idx = this.imagePool.length;
            this.imagePool.push(img.src);
            this.imageSrcToIdx.set(img.src, idx);
          }
          return { ...img, src: `__img:${idx}` };
        }
        return JSON.parse(JSON.stringify(el));
      });
      this.undoStack.push(snapshot);
      if (this.undoStack.length > _Blackboard.MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
    }
    resolveSnapshot(elements) {
      return elements.map((el) => {
        if (el.tool === "image") {
          const img = { ...el };
          if (img.src.startsWith("__img:")) {
            const idx = parseInt(img.src.slice(6));
            img.src = this.imagePool[idx] ?? "";
          }
          return img;
        }
        return el;
      });
    }
    screenToWorld(screenX, screenY) {
      return { x: screenX / this.camera.zoom + this.camera.x, y: screenY / this.camera.zoom + this.camera.y };
    }
    worldToScreen(wx, wy) {
      return { x: (wx - this.camera.x) * this.camera.zoom, y: (wy - this.camera.y) * this.camera.zoom };
    }
    snapToGrid(point) {
      if (!this.graph.enabled) return point;
      const s = this.graph.spacing;
      return { x: Math.round(point.x / s) * s, y: Math.round(point.y / s) * s };
    }
    findNearestConnectionPoint(point, excludeId) {
      let bestDist = 30 / this.camera.zoom;
      let bestPoint = null;
      for (const el of this.elements) {
        if (el.id === excludeId) continue;
        const bounds = this.getElementBounds(el);
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        const dist = Math.hypot(point.x - cx, point.y - cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestPoint = { x: cx, y: cy };
        }
      }
      return bestPoint;
    }
    downsampleStroke(points, minDist) {
      if (points.length < 2) return [...points];
      const result = [points[0]];
      for (let i = 1; i < points.length; i++) {
        const prev = result[result.length - 1];
        const p = points[i];
        if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) {
          result.push(p);
        }
      }
      if (result.length < 2 && points.length >= 2) {
        result.push(points[points.length - 1]);
      }
      return result;
    }
    findNearestEdgePoint(point, excludeId) {
      let bestDist = 30 / this.camera.zoom;
      let bestPoint = null;
      for (const el of this.elements) {
        if (el.id === excludeId) continue;
        if (el.tool === "pen" || el.tool === "eraser") continue;
        const bounds = this.getElementBounds(el);
        const rx = bounds.x;
        const ry = bounds.y;
        const rw = bounds.w;
        const rh = bounds.h;
        if (rw <= 0 && rh <= 0) continue;
        const candidates = [];
        if (rw > 0) {
          candidates.push({ x: rx, y: this.clamp(point.y, ry, ry + rh) });
          candidates.push({ x: rx + rw, y: this.clamp(point.y, ry, ry + rh) });
        }
        if (rh > 0) {
          candidates.push({ x: this.clamp(point.x, rx, rx + rw), y: ry });
          candidates.push({ x: this.clamp(point.x, rx, rx + rw), y: ry + rh });
        }
        for (const c of candidates) {
          const dist = Math.hypot(point.x - c.x, point.y - c.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestPoint = c;
          }
        }
      }
      return bestPoint;
    }
    clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }
    findAlignmentGuides(movingBounds, excludeId) {
      const guides = {};
      const threshold = 5 / this.camera.zoom;
      const movingEdges = {
        left: movingBounds.x,
        right: movingBounds.x + movingBounds.w,
        cx: movingBounds.x + movingBounds.w / 2,
        top: movingBounds.y,
        bottom: movingBounds.y + movingBounds.h,
        cy: movingBounds.y + movingBounds.h / 2
      };
      let bestXDist = threshold;
      let bestYDist = threshold;
      for (const el of this.elements) {
        if (excludeId && el.id === excludeId) continue;
        if (this.selectedIds.has(el.id) && el.id !== excludeId) continue;
        const b = this.getElementBounds(el);
        const otherEdges = {
          left: b.x,
          right: b.x + b.w,
          cx: b.x + b.w / 2,
          top: b.y,
          bottom: b.y + b.h,
          cy: b.y + b.h / 2
        };
        const xChecks = [otherEdges.left, otherEdges.right, otherEdges.cx];
        const movingXChecks = [movingEdges.left, movingEdges.right, movingEdges.cx];
        for (const ox of xChecks) {
          for (const mx of movingXChecks) {
            const d = Math.abs(mx - ox);
            if (d < bestXDist) {
              bestXDist = d;
              guides.x = ox - (mx - movingBounds.x);
            }
          }
        }
        const yChecks = [otherEdges.top, otherEdges.bottom, otherEdges.cy];
        const movingYChecks = [movingEdges.top, movingEdges.bottom, movingEdges.cy];
        for (const oy of yChecks) {
          for (const my of movingYChecks) {
            const d = Math.abs(my - oy);
            if (d < bestYDist) {
              bestYDist = d;
              guides.y = oy - (my - movingBounds.y);
            }
          }
        }
      }
      return guides;
    }
    drawAlignmentGuides(ctx) {
      if (!this.alignmentGuides.x && !this.alignmentGuides.y) return;
      const vl = this.camera.x;
      const vt = this.camera.y;
      const vr = this.camera.x + this.width / this.camera.zoom;
      const vb = this.camera.y + this.height / this.camera.zoom;
      ctx.save();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1 / this.camera.zoom;
      ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
      if (this.alignmentGuides.x !== void 0) {
        const x = this.alignmentGuides.x;
        ctx.beginPath();
        ctx.moveTo(x, vt);
        ctx.lineTo(x, vb);
        ctx.stroke();
      }
      if (this.alignmentGuides.y !== void 0) {
        const y = this.alignmentGuides.y;
        ctx.beginPath();
        ctx.moveTo(vl, y);
        ctx.lineTo(vr, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
    animateLaser = () => {
      this.laserAnimFrame = null;
      const now = Date.now();
      const FADE_MS = 2e3;
      this.laserStrokes = this.laserStrokes.filter((s) => now - s.createdAt < FADE_MS);
      if (this.laserStrokes.length > 0) {
        this.laserAnimFrame = requestAnimationFrame(this.animateLaser);
      }
      this.flushLive();
    };
    drawLaserStrokes(ctx) {
      if (this.laserStrokes.length === 0) return;
      const now = Date.now();
      const FADE_MS = 2e3;
      for (const s of this.laserStrokes) {
        const age = now - s.createdAt;
        const alpha = Math.max(0, 1 - age / FADE_MS);
        if (alpha <= 0 || s.points.length < 2) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          const prev = s.points[i - 1];
          const curr = s.points[i];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
        ctx.stroke();
        ctx.restore();
      }
    }
    drawRemoteCursors(ctx) {
      for (const [userId, data] of this.remoteCursors) {
        const { user, cursor } = data;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 4 / this.camera.zoom, 0, Math.PI * 2);
        ctx.fillStyle = user.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 / this.camera.zoom;
        ctx.stroke();
        ctx.font = `${10 / this.camera.zoom}px system-ui, sans-serif`;
        ctx.fillStyle = user.color;
        ctx.fillText(user.name, cursor.x + 8 / this.camera.zoom, cursor.y - 4 / this.camera.zoom);
        ctx.restore();
      }
    }
    setupCanvases() {
      [this.staticCanvas, this.liveCanvas].forEach((c) => {
        c.width = this.width * this.dpr;
        c.height = this.height * this.dpr;
        c.getContext("2d").scale(this.dpr, this.dpr);
      });
    }
    onScrollDismiss = () => {
      this.dismissContextMenu();
    };
    onResizeDismiss = () => {
      this.dismissContextMenu();
    };
    attachEvents() {
      this.liveCanvas.addEventListener("pointerdown", this.onPointerDown);
      this.liveCanvas.addEventListener("pointermove", this.onPointerMove);
      this.liveCanvas.addEventListener("pointerup", this.onPointerUp);
      this.liveCanvas.addEventListener("pointerleave", this.onPointerUp);
      this.liveCanvas.addEventListener("pointercancel", this.onPointerUp);
      this.liveCanvas.addEventListener("wheel", this.onWheel, { passive: false });
      this.liveCanvas.addEventListener("contextmenu", this.onContextMenu);
      this.liveCanvas.addEventListener("dblclick", this.onDoubleClick);
      this.liveCanvas.addEventListener("dragover", this.boundHandleDragOver);
      this.liveCanvas.addEventListener("drop", this.boundHandleFileDrop);
      window.addEventListener("paste", this.boundHandleImagePaste);
      window.addEventListener("click", this.onWindowClick);
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      window.addEventListener("scroll", this.onScrollDismiss, { capture: true, passive: true });
      window.addEventListener("resize", this.onResizeDismiss);
    }
    detachEvents() {
      this.liveCanvas.removeEventListener("pointerdown", this.onPointerDown);
      this.liveCanvas.removeEventListener("pointermove", this.onPointerMove);
      this.liveCanvas.removeEventListener("pointerup", this.onPointerUp);
      this.liveCanvas.removeEventListener("pointerleave", this.onPointerUp);
      this.liveCanvas.removeEventListener("pointercancel", this.onPointerUp);
      this.liveCanvas.removeEventListener("wheel", this.onWheel);
      this.liveCanvas.removeEventListener("contextmenu", this.onContextMenu);
      this.liveCanvas.removeEventListener("dblclick", this.onDoubleClick);
      this.liveCanvas.removeEventListener("dragover", this.boundHandleDragOver);
      this.liveCanvas.removeEventListener("drop", this.boundHandleFileDrop);
      window.removeEventListener("paste", this.boundHandleImagePaste);
      window.removeEventListener("click", this.onWindowClick);
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      window.removeEventListener("scroll", this.onScrollDismiss);
      window.removeEventListener("resize", this.onResizeDismiss);
    }
    getPoint = (e) => {
      const rect = this.liveCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return { ...this.screenToWorld(sx, sy), pressure: e.pressure };
    };
    hitTest(worldPoint) {
      for (let i = this.elements.length - 1; i >= 0; i--) {
        const el = this.elements[i];
        const rotation = el.rotation ?? 0;
        if ((el.tool === "pen" || el.tool === "highlighter" || el.tool === "eraser") && "points" in el) {
          const hitDist = Math.max(el.width * 2, 10) / this.camera.zoom;
          const center = this.getRotationCenter(el);
          const testPoint = rotation !== 0 ? this.rotatePoint(worldPoint, center, -rotation) : worldPoint;
          const hit = el.points.some(
            (p) => Math.hypot(p.x - testPoint.x, p.y - testPoint.y) < hitDist
          );
          if (hit) return el;
          continue;
        }
        const bounds = this.getElementBounds(el);
        const pad = (IS_MOBILE() ? 12 : 8) / this.camera.zoom;
        if (worldPoint.x >= bounds.x - pad && worldPoint.x <= bounds.x + bounds.w + pad && worldPoint.y >= bounds.y - pad && worldPoint.y <= bounds.y + bounds.h + pad) {
          return el;
        }
      }
      return null;
    }
    getHandleAtPoint(worldPoint) {
      if (this.selectedIds.size !== 1) return null;
      const id = this.selectedIds.values().next().value;
      const el = this.elements.find((e) => e.id === id);
      if (!el) return null;
      const bounds = this.getElementBounds(el);
      const local = this.getLocalBounds(el);
      const rotation = el.rotation ?? 0;
      const pad = 6 / this.camera.zoom;
      const handleSize = (IS_MOBILE() ? 14 : 10) / this.camera.zoom;
      let handleDefs;
      if (rotation !== 0) {
        const corners = this.getRotatedCorners({ x: local.x - pad, y: local.y - pad, w: local.w + pad * 2, h: local.h + pad * 2 }, rotation);
        handleDefs = {
          "nw": corners[0],
          "ne": corners[1],
          "se": corners[2],
          "sw": corners[3],
          "n": { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
          "e": { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
          "s": { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
          "w": { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 }
        };
      } else {
        handleDefs = {
          "nw": { x: bounds.x - pad, y: bounds.y - pad },
          "n": { x: bounds.x + bounds.w / 2, y: bounds.y - pad },
          "ne": { x: bounds.x + bounds.w + pad, y: bounds.y - pad },
          "e": { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h / 2 },
          "se": { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad },
          "s": { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h + pad },
          "sw": { x: bounds.x - pad, y: bounds.y + bounds.h + pad },
          "w": { x: bounds.x - pad, y: bounds.y + bounds.h / 2 }
        };
      }
      for (const [name, pos] of Object.entries(handleDefs)) {
        if (Math.abs(worldPoint.x - pos.x) < handleSize && Math.abs(worldPoint.y - pos.y) < handleSize) {
          return name;
        }
      }
      const rotatePos = this.getRotateHandlePos();
      if (rotatePos && Math.abs(worldPoint.x - rotatePos.x) < handleSize * 1.5 && Math.abs(worldPoint.y - rotatePos.y) < handleSize * 1.5) {
        return "rotate";
      }
      return null;
    }
    getRotateHandlePos() {
      if (this.selectedIds.size !== 1) return null;
      const id = this.selectedIds.values().next().value;
      const el = this.elements.find((e) => e.id === id);
      if (!el) return null;
      const bounds = this.getElementBounds(el);
      const rotation = el.rotation ?? 0;
      const pad = 6 / this.camera.zoom;
      const topCenter = { x: bounds.x + bounds.w / 2, y: bounds.y - pad };
      if (rotation !== 0) {
        const center = this.getRotationCenter(el);
        return this.rotatePoint(topCenter, center, rotation);
      }
      return topCenter;
    }
    getElementBounds(el) {
      const local = this.getLocalBounds(el);
      const rotation = el.rotation ?? 0;
      if (rotation === 0) return local;
      const corners = this.getRotatedCorners(local, rotation);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of corners) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    onPointerDown = (e) => {
      this.dismissContextMenu();
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (this.activePointers.size === 2) {
        if (this.isDrawing) {
          this.isDrawing = false;
          this.currentElement = null;
          this.flushLive();
        }
        this.startPinch();
        return;
      }
      if (this.activePointers.size > 2) {
        return;
      }
      if (this.activePointerId !== null && this.activePointerId !== e.pointerId) {
        if (e.pointerType === "pen" && this.activePointerType === "touch") {
          this.releasePointerCapture();
        } else {
          return;
        }
      }
      if (e.pointerType === "touch" && this.activePointerType === "pen" && this.isDrawing) {
        return;
      }
      e.preventDefault();
      try {
        this.liveCanvas.setPointerCapture(e.pointerId);
      } catch {
      }
      this.activePointerId = e.pointerId;
      this.activePointerType = e.pointerType;
      const point = this.getPoint(e);
      if (e.pointerType === "touch" && this.activeTool === "select") {
        this.longPressStart = point;
        this.longPressTimer = setTimeout(() => {
          if (this.longPressStart) {
            const hit = this.hitTest(this.longPressStart);
            if (hit) {
              if (!this.selectedIds.has(hit.id)) {
                this.selectedIds.clear();
                this.selectedIds.add(hit.id);
                this.renderAll();
              }
              this.isDrawing = false;
              this.currentElement = null;
              this.showContextMenu(e.clientX, e.clientY);
            }
          }
        }, 500);
      }
      if (this.activeTool === "hand" || this.isSpaceDown && !this.isPanning) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.panCameraStart = { x: this.camera.x, y: this.camera.y };
        return;
      }
      if (this.activeTool === "select") {
        const handle = this.getHandleAtPoint(point);
        if (handle === "rotate") {
          this.pushUndo();
          this.dragState = { type: "rotate", startWorld: point, origElements: JSON.parse(JSON.stringify(this.elements)) };
          this.renderAll();
          return;
        }
        if (handle) {
          this.pushUndo();
          this.dragState = { type: "resize", startWorld: point, origElements: JSON.parse(JSON.stringify(this.elements)), handle };
          this.renderAll();
          return;
        }
        const hit = this.hitTest(point);
        if (hit) {
          if (e.shiftKey) {
            if (this.selectedIds.has(hit.id)) {
              this.selectedIds.delete(hit.id);
            } else {
              if (hit.groupId) {
                for (const el of this.elements) {
                  if (el.groupId === hit.groupId) this.selectedIds.add(el.id);
                }
              } else {
                this.selectedIds.add(hit.id);
              }
            }
            this.renderAll();
            return;
          }
          if (!this.selectedIds.has(hit.id)) {
            this.selectedIds.clear();
            if (hit.groupId) {
              for (const el of this.elements) {
                if (el.groupId === hit.groupId) this.selectedIds.add(el.id);
              }
            } else {
              this.selectedIds.add(hit.id);
            }
          }
          this.pushUndo();
          this.dragState = { type: "move", startWorld: point, origElements: JSON.parse(JSON.stringify(this.elements)) };
        } else {
          if (!e.shiftKey) this.selectedIds.clear();
          this.marqueeStart = point;
          this.marqueeEnd = point;
        }
        this.renderAll();
        return;
      }
      if (this.activeTool === "text") {
        const hit = this.hitTest(point);
        if (hit && hit.tool === "text") {
          this.startTextEdit(hit.position.x, hit.position.y, hit);
        } else {
          this.startTextEdit(point.x, point.y);
        }
        return;
      }
      if (this.activeTool === "laser") {
        this.isDrawing = true;
        this.currentElement = {
          id: uid(),
          tool: "laser",
          points: [point],
          color: "#ef4444",
          width: this.strokeWidth,
          opacity: 1,
          createdAt: Date.now()
        };
        return;
      }
      if (this.activeTool === "eraser") {
        if (this.pixelEraser) {
          this.pushUndo();
          this.isDrawing = true;
          this.currentElement = {
            id: uid(),
            tool: "eraser",
            points: [point],
            color: "#000000",
            width: this.strokeWidth * 3,
            opacity: 1
          };
          return;
        }
        this.pushUndo();
        this.isDrawing = true;
        this.lastPointerWorld = point;
        this.renderAll();
        return;
      }
      this.isDrawing = true;
      if (e.pointerType === "pen") this.usePressure = true;
      if (this.activeTool === "pen" || this.activeTool === "highlighter") {
        this.currentElement = {
          id: uid(),
          tool: this.activeTool === "highlighter" ? "highlighter" : "pen",
          points: [point],
          color: this.strokeColor,
          width: this.activeTool === "highlighter" ? this.strokeWidth * 3 : this.strokeWidth,
          opacity: this.activeTool === "highlighter" ? 0.3 : this.strokeOpacity
        };
      } else {
        const snapped = this.snapToGrid(point);
        this.currentElement = {
          id: uid(),
          tool: this.activeTool,
          start: snapped,
          end: snapped,
          color: this.strokeColor,
          width: this.strokeWidth,
          opacity: this.strokeOpacity,
          filled: this.fillEnabled,
          roughness: this.roughness,
          ...this.dashEnabled ? { dashPattern: [8, 4] } : {},
          ...this.cornerRadius > 0 ? { cornerRadius: this.cornerRadius } : {}
        };
      }
    };
    moveSingleElement(el, orig, dx, dy) {
      if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter" || el.tool === "laser") {
        const s = el;
        const o = orig;
        s.points = o.points.map((p) => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
      } else if (el.tool === "text") {
        const t = el;
        const o = orig;
        t.position = { x: o.position.x + dx, y: o.position.y + dy };
      } else if (el.tool === "katex") {
        const k = el;
        const o = orig;
        k.position = { x: o.position.x + dx, y: o.position.y + dy };
      } else if (el.tool === "image") {
        const img = el;
        const o = orig;
        img.position = { x: o.position.x + dx, y: o.position.y + dy };
      } else {
        const s = el;
        const o = orig;
        s.start = { x: o.start.x + dx, y: o.start.y + dy };
        s.end = { x: o.end.x + dx, y: o.end.y + dy };
      }
    }
    getRotationCenter(el) {
      const bounds = this.getLocalBounds(el);
      return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    }
    rotatePoint(point, center, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
    }
    getLocalBounds(el) {
      if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter" || el.tool === "laser") {
        const stroke = el;
        if (stroke.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of stroke.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
      if (el.tool === "text") {
        const t = el;
        const ctx = this.staticCtx;
        ctx.font = `${t.fontSize}px ${t.fontFamily}`;
        const lines = t.content.split("\n");
        const lineHeight = t.fontSize * 1.4;
        let maxW = 0;
        for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
        return { x: t.position.x, y: t.position.y, w: Math.max(maxW, 20), h: Math.max(lines.length * lineHeight, t.fontSize) };
      }
      if (el.tool === "image") {
        const img = el;
        return { x: img.position.x, y: img.position.y, w: img.width, h: img.height };
      }
      if (el.tool === "katex") {
        const k = el;
        return { x: k.position.x, y: k.position.y, w: k.width ?? 200, h: k.height ?? 40 };
      }
      const s = el;
      const x = Math.min(s.start.x, s.end.x);
      const y = Math.min(s.start.y, s.end.y);
      return { x, y, w: Math.abs(s.end.x - s.start.x), h: Math.abs(s.end.y - s.start.y) };
    }
    getRotatedCorners(bounds, rotation) {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const corners = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.w, y: bounds.y },
        { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
        { x: bounds.x, y: bounds.y + bounds.h }
      ];
      return corners.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
      });
    }
    moveSelectedElements(dx, dy) {
      if (!this.dragState) return;
      const origMap = new Map(this.dragState.origElements.map((e) => [e.id, e]));
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        const orig = origMap.get(id);
        if (!el || !orig) continue;
        this.moveSingleElement(el, orig, dx, dy);
      }
      this.updateBoundArrows();
    }
    updateBoundArrows() {
      for (const el of this.elements) {
        if (el.tool !== "arrow" && el.tool !== "line") continue;
        const shape = el;
        if (!shape.boundTo) continue;
        const target = this.elements.find((e) => e.id === shape.boundTo);
        if (!target) {
          shape.boundTo = void 0;
          continue;
        }
        const tb = this.getElementBounds(target);
        const arrowBounds = this.getLocalBounds(shape);
        const acx = (shape.start.x + shape.end.x) / 2;
        const acy = (shape.start.y + shape.end.y) / 2;
        const tcx = tb.x + tb.w / 2;
        const tcy = tb.y + tb.h / 2;
        if (acx < tcx) {
          shape.start.x = tb.x;
          shape.end.x = tb.x + tb.w;
        } else {
          shape.start.x = tb.x + tb.w;
          shape.end.x = tb.x;
        }
        if (acy < tcy) {
          shape.start.y = tb.y + tb.h;
          shape.end.y = tb.y;
        } else {
          shape.start.y = tb.y;
          shape.end.y = tb.y + tb.h;
        }
      }
    }
    autoBindArrow(shape) {
      const edge = this.findNearestEdgePoint(shape.start, shape.id);
      if (edge) {
        const target = this.elements.find((e) => {
          if (e.id === shape.id) return false;
          const b = this.getElementBounds(e);
          return Math.hypot(edge.x - (b.x + b.w / 2), edge.y - (b.y + b.h / 2)) < Math.max(b.w, b.h);
        });
        if (target) {
          shape.boundTo = target.id;
          shape.start = edge;
        }
      }
      const edgeEnd = this.findNearestEdgePoint(shape.end, shape.id);
      if (edgeEnd) {
        const target = this.elements.find((e) => {
          if (e.id === shape.id) return false;
          const b = this.getElementBounds(e);
          return Math.hypot(edgeEnd.x - (b.x + b.w / 2), edgeEnd.y - (b.y + b.h / 2)) < Math.max(b.w, b.h);
        });
        if (target) {
          if (!shape.boundTo) shape.boundTo = target.id;
          shape.end = edgeEnd;
        }
      }
    }
    resizeSelected(handle, currentWorld) {
      if (!this.dragState) return;
      const origMap = new Map(this.dragState.origElements.map((e) => [e.id, e]));
      const rawDx = currentWorld.x - this.dragState.startWorld.x;
      const rawDy = currentWorld.y - this.dragState.startWorld.y;
      if (this.selectedIds.size === 1) {
        const id = this.selectedIds.values().next().value;
        const el = this.elements.find((e) => e.id === id);
        const orig = origMap.get(id);
        if (!el || !orig) return;
        const rotation = el.rotation ?? 0;
        let dx = rawDx, dy = rawDy;
        if (rotation !== 0) {
          const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
          dx = rawDx * cos - rawDy * sin;
          dy = rawDx * sin + rawDy * cos;
        }
        if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter" || el.tool === "text") {
          this.moveSingleElement(el, orig, dx, dy);
          return;
        }
        if (el.tool === "image") {
          const img = el, o2 = orig;
          let newX = o2.position.x, newY = o2.position.y, newW = o2.width, newH = o2.height;
          if (handle === "nw") {
            newX = o2.position.x + dx;
            newY = o2.position.y + dy;
            newW = o2.width - dx;
            newH = o2.height - dy;
          } else if (handle === "ne") {
            newY = o2.position.y + dy;
            newW = o2.width + dx;
            newH = o2.height - dy;
          } else if (handle === "sw") {
            newX = o2.position.x + dx;
            newW = o2.width - dx;
            newH = o2.height + dy;
          } else if (handle === "se") {
            newW = o2.width + dx;
            newH = o2.height + dy;
          } else if (handle === "n") {
            newY = o2.position.y + dy;
            newH = o2.height - dy;
          } else if (handle === "s") {
            newH = o2.height + dy;
          } else if (handle === "e") {
            newW = o2.width + dx;
          } else if (handle === "w") {
            newX = o2.position.x + dx;
            newW = o2.width - dx;
          }
          if (newW > 0 && newH > 0) {
            img.position = { x: newX, y: newY };
            img.width = newW;
            img.height = newH;
          }
          return;
        }
        const s = el, o = orig;
        let ns = { x: o.start.x, y: o.start.y }, ne = { x: o.end.x, y: o.end.y };
        if (handle === "nw") {
          ns.x = o.start.x + dx;
          ns.y = o.start.y + dy;
        }
        if (handle === "ne") {
          ne.x = o.end.x + dx;
          ns.y = o.start.y + dy;
        }
        if (handle === "sw") {
          ns.x = o.start.x + dx;
          ne.y = o.end.y + dy;
        }
        if (handle === "se") {
          ne.x = o.end.x + dx;
          ne.y = o.end.y + dy;
        }
        if (handle === "n") {
          ns.y = o.start.y + dy;
        }
        if (handle === "s") {
          ne.y = o.end.y + dy;
        }
        if (handle === "e") {
          ne.x = o.end.x + dx;
        }
        if (handle === "w") {
          ns.x = o.start.x + dx;
        }
        if (ns.x > ne.x) {
          const t = ns.x;
          ns.x = ne.x;
          ne.x = t;
        }
        if (ns.y > ne.y) {
          const t = ns.y;
          ns.y = ne.y;
          ne.y = t;
        }
        if (Math.abs(ne.x - ns.x) < 5 || Math.abs(ne.y - ns.y) < 5) return;
        s.start = ns;
        s.end = ne;
        return;
      }
      let origMinX = Infinity, origMinY = Infinity, origMaxX = -Infinity, origMaxY = -Infinity;
      for (const id of this.selectedIds) {
        const orig = origMap.get(id);
        if (!orig) continue;
        const b = this.getLocalBounds(orig);
        if (b.x < origMinX) origMinX = b.x;
        if (b.y < origMinY) origMinY = b.y;
        if (b.x + b.w > origMaxX) origMaxX = b.x + b.w;
        if (b.y + b.h > origMaxY) origMaxY = b.y + b.h;
      }
      if (origMinX === Infinity) return;
      const origW = origMaxX - origMinX, origH = origMaxY - origMinY;
      const origCX = origMinX + origW / 2, origCY = origMinY + origH / 2;
      let scaleX = 1, scaleY = 1;
      if (handle.includes("e") || handle === "ne" || handle === "se") scaleX = Math.max(0.1, (origW + rawDx) / origW);
      if (handle.includes("w") || handle === "nw" || handle === "sw") scaleX = Math.max(0.1, (origW - rawDx) / origW);
      if (handle === "n" || handle === "nw" || handle === "ne") scaleY = Math.max(0.1, (origH - rawDy) / origH);
      if (handle === "s" || handle === "sw" || handle === "se") scaleY = Math.max(0.1, (origH + rawDy) / origH);
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        const orig = origMap.get(id);
        if (!el || !orig) continue;
        const ob = this.getLocalBounds(orig);
        const newCX = origCX + (ob.x + ob.w / 2 - origCX) * scaleX;
        const newCY = origCY + (ob.y + ob.h / 2 - origCY) * scaleY;
        const newW = ob.w * scaleX;
        const newH = ob.h * scaleY;
        const dx = newCX - (ob.x + ob.w / 2);
        const dy = newCY - (ob.y + ob.h / 2);
        if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter" || el.tool === "text") {
          this.moveSingleElement(el, orig, dx, dy);
          continue;
        }
        if (el.tool === "image") {
          const img = el, o2 = orig;
          const nw = o2.width * scaleX, nh = o2.height * scaleY;
          if (nw > 0 && nh > 0) {
            img.position = { x: o2.position.x + dx, y: o2.position.y + dy };
            img.width = nw;
            img.height = nh;
          }
          continue;
        }
        const s = el, o = orig;
        const ns = { x: o.start.x + dx, y: o.start.y + dy };
        const ne = { x: o.end.x + dx, y: o.end.y + dy };
        s.start = ns;
        s.end = ne;
      }
    }
    startPinch() {
      const pts = Array.from(this.activePointers.values());
      this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this.pinchStartZoom = this.camera.zoom;
      this.pinchStartCamera = { x: this.camera.x, y: this.camera.y };
      const rect = this.liveCanvas.getBoundingClientRect();
      this.pinchCenter = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top
      };
    }
    onPointerMove = (e) => {
      if (this.longPressTimer && this.longPressStart) {
        const dx = e.clientX - this.longPressStart.x;
        const dy = e.clientY - this.longPressStart.y;
        if (Math.hypot(dx, dy) > 10) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
          this.longPressStart = null;
        }
      }
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      }
      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const rect = this.liveCanvas.getBoundingClientRect();
        const curCenter = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top
        };
        if (this.pinchStartDist > 0) {
          const newZoom = this.pinchStartZoom * (dist / this.pinchStartDist);
          this.zoomTo(newZoom, this.pinchCenter);
          const panDx = (curCenter.x - this.pinchCenter.x) / this.camera.zoom;
          const panDy = (curCenter.y - this.pinchCenter.y) / this.camera.zoom;
          this.camera.x = this.pinchStartCamera.x - panDx;
          this.camera.y = this.pinchStartCamera.y - panDy;
          this.graphDirty = true;
          this.renderAll();
          this.updateToolbar();
        }
        return;
      }
      if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
      if (this.isPanning) {
        const dx = (e.clientX - this.panStart.x) / this.camera.zoom;
        const dy = (e.clientY - this.panStart.y) / this.camera.zoom;
        this.camera.x = this.panCameraStart.x - dx;
        this.camera.y = this.panCameraStart.y - dy;
        this.graphDirty = true;
        this.renderAll();
        return;
      }
      if (this.activeTool === "select" && this.dragState?.type === "rotate") {
        const point = this.getPoint(e);
        const id = this.selectedIds.values().next().value;
        const el = this.elements.find((e2) => e2.id === id);
        if (el) {
          const center = this.getRotationCenter(el);
          const origAngle = Math.atan2(this.dragState.startWorld.y - center.y, this.dragState.startWorld.x - center.x);
          const curAngle = Math.atan2(point.y - center.y, point.x - center.x);
          const deltaAngle = curAngle - origAngle;
          const origEl = this.dragState.origElements.find((e2) => e2.id === id);
          if (origEl) {
            el.rotation = ((origEl.rotation ?? 0) + deltaAngle) % (Math.PI * 2);
          }
        }
        this.renderAll();
        return;
      }
      if (this.activeTool === "select" && this.dragState?.type === "resize") {
        const point = this.getPoint(e);
        this.resizeSelected(this.dragState.handle, point);
        this.renderAll();
        return;
      }
      if (this.activeTool === "select" && this.dragState?.type === "move") {
        const point = this.getPoint(e);
        const dx = point.x - this.dragState.startWorld.x;
        const dy = point.y - this.dragState.startWorld.y;
        this.moveSelectedElements(dx, dy);
        let combinedBounds = { x: Infinity, y: Infinity, w: 0, h: 0 };
        let hasBounds = false;
        for (const id of this.selectedIds) {
          const el = this.elements.find((e2) => e2.id === id);
          if (!el) continue;
          const b = this.getElementBounds(el);
          if (!hasBounds) {
            combinedBounds = { x: b.x, y: b.y, w: b.w, h: b.h };
            hasBounds = true;
          } else {
            const nx = Math.min(combinedBounds.x, b.x);
            const ny = Math.min(combinedBounds.y, b.y);
            combinedBounds = {
              x: nx,
              y: ny,
              w: Math.max(combinedBounds.x + combinedBounds.w, b.x + b.w) - nx,
              h: Math.max(combinedBounds.y + combinedBounds.h, b.y + b.h) - ny
            };
          }
        }
        if (hasBounds) {
          this.alignmentGuides = this.findAlignmentGuides(combinedBounds);
        }
        this.renderAll();
        return;
      }
      if (this.activeTool === "select" && this.marqueeStart) {
        this.marqueeEnd = this.getPoint(e);
        this.renderAll();
        return;
      }
      if (this.activeTool === "eraser" && this.isDrawing) {
        if (this.pixelEraser && this.currentElement) {
          const events = e.getCoalescedEvents?.() ?? [e];
          for (const ce of events) {
            const p = this.getPoint(ce);
            const pts = this.currentElement.points;
            const last = pts[pts.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
              pts.push(p);
            }
          }
          this.dirty = true;
          if (!this.animFrameId) this.animFrameId = requestAnimationFrame(this.flush);
          return;
        }
        const point = this.getPoint(e);
        this.lastPointerWorld = point;
        const hitDist = IS_MOBILE() ? this.strokeWidth * 3.5 : this.strokeWidth * 2.5;
        const toRemove = [];
        for (const el of this.elements) {
          if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter") {
            const stroke = el;
            const rotation = stroke.rotation ?? 0;
            const center = this.getRotationCenter(stroke);
            const localPoint = rotation !== 0 ? this.rotatePoint(point, center, -rotation) : point;
            const hit = stroke.points.some((p) => Math.hypot(p.x - localPoint.x, p.y - localPoint.y) < hitDist);
            if (hit) toRemove.push(el.id);
          } else {
            const bounds = this.getElementBounds(el);
            const pad = hitDist;
            if (point.x >= bounds.x - pad && point.x <= bounds.x + bounds.w + pad && point.y >= bounds.y - pad && point.y <= bounds.y + bounds.h + pad) {
              toRemove.push(el.id);
            }
          }
        }
        if (toRemove.length > 0) {
          this.elements = this.elements.filter((e2) => !toRemove.includes(e2.id));
          this.renderStatic();
          this.emit("change");
        }
        this.dirty = true;
        if (!this.animFrameId) this.animFrameId = requestAnimationFrame(this.flush);
        return;
      }
      if (!this.isDrawing || !this.currentElement) return;
      e.preventDefault();
      if (this.currentElement.tool === "pen" || this.currentElement.tool === "highlighter" || this.currentElement.tool === "laser") {
        const events = e.getCoalescedEvents?.() ?? [e];
        for (const ce of events) {
          const p = this.getPoint(ce);
          const pts = this.currentElement.points;
          const last = pts[pts.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) >= 1) {
            pts.push(p);
          }
        }
      } else {
        const point = this.getPoint(e);
        const shape = this.currentElement;
        let endPoint = this.snapToGrid(point);
        if (shape.tool === "arrow") {
          const conn = this.findNearestEdgePoint(endPoint, this.currentElement?.id);
          if (conn) endPoint = conn;
        }
        shape.end = endPoint;
        if (e.shiftKey && "start" in this.currentElement) {
          const dx = shape.end.x - shape.start.x;
          const dy = shape.end.y - shape.start.y;
          if (shape.tool === "rect") {
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            shape.end = { x: shape.start.x + size * Math.sign(dx || 1), y: shape.start.y + size * Math.sign(dy || 1) };
          } else if (shape.tool === "circle") {
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            shape.end = { x: shape.start.x + size * Math.sign(dx || 1), y: shape.start.y + size * Math.sign(dy || 1) };
          } else if (shape.tool === "line" || shape.tool === "arrow") {
            const angle = Math.atan2(dy, dx);
            const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            shape.end = { x: shape.start.x + len * Math.cos(snapped), y: shape.start.y + len * Math.sin(snapped) };
          }
        }
      }
      this.dirty = true;
      if (!this.animFrameId) {
        this.animFrameId = requestAnimationFrame(this.flush);
      }
    };
    onPointerUp = (e) => {
      this.activePointers.delete(e.pointerId);
      if (e.pointerType === "pen") this.usePressure = false;
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.longPressStart = null;
      if (this.activePointerId !== null && this.activePointerId !== e.pointerId) return;
      this.activePointerId = null;
      this.activePointerType = "mouse";
      if (this.isPanning) {
        this.isPanning = false;
        return;
      }
      if (this.activeTool === "select" && this.dragState) {
        this.alignmentGuides = {};
        this.dragState = null;
        this.emit("change");
        return;
      }
      if (this.activeTool === "select" && this.marqueeStart && this.marqueeEnd) {
        const mx = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const my = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const mw = Math.abs(this.marqueeEnd.x - this.marqueeStart.x);
        const mh = Math.abs(this.marqueeEnd.y - this.marqueeStart.y);
        if (mw > 2 / this.camera.zoom || mh > 2 / this.camera.zoom) {
          for (const el of this.elements) {
            const b = this.getElementBounds(el);
            if (b.x >= mx && b.y >= my && b.x + b.w <= mx + mw && b.y + b.h <= my + mh) {
              this.selectedIds.add(el.id);
            }
          }
        }
        this.marqueeStart = null;
        this.marqueeEnd = null;
        this.renderAll();
        return;
      }
      this.marqueeStart = null;
      this.marqueeEnd = null;
      if (this.activeTool === "eraser" && this.isDrawing) {
        if (this.pixelEraser && this.currentElement) {
          this.isDrawing = false;
          if (this.currentElement.points.length < 2) {
            const p = this.currentElement.points[0];
            this.currentElement.points = [
              { x: p.x, y: p.y, pressure: 0.5 },
              { x: p.x + 0.5, y: p.y + 0.5, pressure: 0.5 }
            ];
          } else {
            this.currentElement.points = this.downsampleStroke(this.currentElement.points, 2);
          }
          this.elements.push(this.currentElement);
          this.currentElement = null;
          this.flushLive();
          this.renderStatic();
          this.updateToolbar();
          this.emit("change");
          return;
        }
        this.isDrawing = false;
        this.lastPointerWorld = null;
        this.renderAll();
        this.updateToolbar();
        return;
      }
      if (!this.isDrawing || !this.currentElement) return;
      this.isDrawing = false;
      if (this.currentElement.tool === "laser") {
        const laser = this.currentElement;
        if (laser.points.length >= 2) {
          this.laserStrokes.push({
            id: laser.id,
            points: [...laser.points],
            color: laser.color,
            width: laser.width,
            opacity: 1,
            createdAt: Date.now()
          });
          if (!this.laserAnimFrame) this.laserAnimFrame = requestAnimationFrame(this.animateLaser);
        }
        this.currentElement = null;
        return;
      }
      if (this.currentElement.tool === "pen" || this.currentElement.tool === "highlighter") {
        if (this.currentElement.points.length < 2) {
          const p = this.currentElement.points[0];
          this.currentElement.points = [
            { x: p.x, y: p.y, pressure: 0.5 },
            { x: p.x + 0.5, y: p.y + 0.5, pressure: 0.5 }
          ];
        } else {
          this.currentElement.points = this.downsampleStroke(this.currentElement.points, 2);
        }
      }
      this.elements.push(this.currentElement);
      if (this.currentElement.tool === "arrow" || this.currentElement.tool === "line") {
        this.autoBindArrow(this.currentElement);
      }
      this.currentElement = null;
      this.flushLive();
      this.renderStatic();
      this.updateToolbar();
      this.emit("change");
    };
    onWheel = (e) => {
      e.preventDefault();
      const rect = this.liveCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldBefore = this.screenToWorld(sx, sy);
      const delta = -e.deltaY;
      const factor = Math.pow(1.001, delta);
      this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom * factor));
      const worldAfter = this.screenToWorld(sx, sy);
      this.camera.x += worldBefore.x - worldAfter.x;
      this.camera.y += worldBefore.y - worldAfter.y;
      this.graphDirty = true;
      this.renderAll();
      this.updateToolbar();
    };
    onKeyDown = (e) => {
      if (this.textInput) return;
      if (isInInput(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? this.redo() : this.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        this.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        this.zoomTo(this.camera.zoom * 1.1);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        this.zoomTo(this.camera.zoom * 0.9);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        this.resetView();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        this.duplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        this.copySelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        this.pasteClipboard();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault();
        this.copySelected();
        this.deleteSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        this.selectAll();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (this.contextMenu) {
          this.dismissContextMenu();
          return;
        }
        if (this.selectedIds.size > 0) {
          this.selectedIds.clear();
          this.renderAll();
        } else if (this.isDrawing && this.currentElement) {
          this.isDrawing = false;
          this.currentElement = null;
          this.flushLive();
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!this.isSpaceDown) {
          this.isSpaceDown = true;
          this.liveCanvas.style.cursor = "grab";
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.deleteSelected();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const nudge = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.nudgeSelected(-nudge, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          this.nudgeSelected(nudge, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this.nudgeSelected(0, -nudge);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.nudgeSelected(0, nudge);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "]") {
        e.preventDefault();
        if (e.shiftKey) this.bringToFront();
        else this.bringForward();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        if (e.shiftKey) this.sendToBack();
        else this.sendBackward();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "]") {
        e.preventDefault();
        if (this.activeTool === "text") this.setFontSize(this.fontSize + 2);
        else this.setWidth(this.strokeWidth + 1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "[") {
        e.preventDefault();
        if (this.activeTool === "text") this.setFontSize(this.fontSize - 2);
        else this.setWidth(this.strokeWidth - 1);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        this.groupSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") {
        e.preventDefault();
        this.ungroupSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        const svg = this.exportSVG();
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "blackboard.svg";
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        this.exportPNG();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        this.applyStyleToSelected();
        return;
      }
      if (e.shiftKey && e.key === "R") {
        e.preventDefault();
        this.rotateSelected(Math.PI / 12);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        this.showShortcutHelp();
        return;
      }
      const keyToolMap = {
        "v": "select",
        "h": "hand",
        "p": "pen",
        "m": "highlighter",
        "t": "text",
        "l": "line",
        "r": "rect",
        "o": "circle",
        "a": "arrow",
        "e": "eraser",
        "b": "laser",
        "n": "diamond"
      };
      if ((e.ctrlKey || e.metaKey) && !["z", "+", "-", "0", "d", "c", "v", "x", "a", "g", "]", "["].includes(e.key.toLowerCase())) {
        return;
      }
      const tool = keyToolMap[e.key.toLowerCase()];
      if (tool) {
        this.commitText();
        this.setTool(tool);
      }
    };
    onKeyUp = (e) => {
      if (e.key === " ") {
        this.isSpaceDown = false;
        this.setTool(this.activeTool);
      }
    };
    onContextMenu = (e) => {
      e.preventDefault();
      const point = this.getPoint(e);
      const hit = this.hitTest(point);
      if (hit) {
        if (!this.selectedIds.has(hit.id)) {
          this.selectedIds.clear();
          this.selectedIds.add(hit.id);
          this.renderAll();
        }
      }
      this.showContextMenu(e.clientX, e.clientY);
    };
    onDoubleClick = (e) => {
      const point = this.getPoint(e);
      const hit = this.hitTest(point);
      if (hit && (hit.tool === "rect" || hit.tool === "circle" || hit.tool === "diamond")) {
        const shape = hit;
        const bounds = this.getElementBounds(shape);
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;
        if (shape.label) {
          const existingText = this.elements.find((el) => el.tool === "text" && el.content === shape.label);
          if (existingText) {
            this.startTextEdit(existingText.position.x, existingText.position.y, existingText);
            return;
          }
        }
        const world = this.screenToWorld(cx, cy);
        this.startTextEdit(world.x, world.y);
      } else if (hit && (hit.tool === "line" || hit.tool === "arrow")) {
        const shape = hit;
        const mx = (shape.start.x + shape.end.x) / 2;
        const my = (shape.start.y + shape.end.y) / 2;
        const label = prompt("Label for this line/arrow:", shape.label ?? "");
        if (label !== null) {
          this.pushUndo();
          shape.label = label;
          this.renderAll();
          this.emit("change");
        }
      } else if (hit && hit.tool === "katex") {
        const k = hit;
        const newLatex = prompt("Edit LaTeX:", k.latex);
        if (newLatex !== null && newLatex !== k.latex) {
          this.pushUndo();
          k.latex = newLatex;
          this.katexImageCache.clear();
          this.renderAll();
          this.emit("change");
        }
      }
    };
    showContextMenu(clientX, clientY) {
      this.dismissContextMenu();
      const mobile = IS_MOBILE();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuW = mobile ? 150 : 160;
      let left = clientX;
      let top = clientY;
      if (left + menuW > vw) left = vw - menuW - 8;
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      const hasSelection = this.selectedIds.size > 0;
      const hasOne = this.selectedIds.size === 1;
      const menu = document.createElement("div");
      menu.setAttribute("role", "menu");
      menu.style.cssText = `
      position: fixed; left: ${left}px; top: ${top}px;
      background: ${THEMES[this.theme].canvasBg}; border: 1px solid ${THEMES[this.theme].gridColor};
      border-radius: 8px; padding: 4px; z-index: 1000; min-width: ${menuW}px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: system-ui, sans-serif;
      max-height: ${vh - 16}px; overflow-y: auto;
    `;
      const items = [
        { label: "Delete", shortcut: "Del", action: () => this.deleteSelected(), disabled: !hasSelection },
        { label: "Duplicate", shortcut: "Ctrl+D", action: () => this.duplicateSelected(), disabled: !hasSelection },
        { label: "Group", shortcut: "Ctrl+G", action: () => this.groupSelected(), disabled: this.selectedIds.size < 2 },
        { label: "Ungroup", shortcut: "Ctrl+Shift+G", action: () => this.ungroupSelected(), disabled: !hasSelection },
        { type: "separator" },
        { label: "Bring Forward", shortcut: "]", action: () => this.bringForward(), disabled: !hasOne },
        { label: "Send Backward", shortcut: "[", action: () => this.sendBackward(), disabled: !hasOne },
        { label: "Bring to Front", shortcut: "Ctrl+]", action: () => this.bringToFront(), disabled: !hasOne },
        { label: "Send to Back", shortcut: "Ctrl+[", action: () => this.sendToBack(), disabled: !hasOne },
        { type: "separator" },
        { label: "Select All", shortcut: "Ctrl+A", action: () => this.selectAll(), disabled: this.elements.length === 0 }
      ];
      if (hasSelection) {
        items.push(
          { type: "separator" },
          { label: "Export Selected SVG", shortcut: "", action: () => {
            const svg = this.exportSelectedSVG();
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "selection.svg";
            a.click();
            URL.revokeObjectURL(url);
          }, disabled: false },
          { label: "Export Selected PNG", shortcut: "", action: () => this.exportSelectedPNG(), disabled: false }
        );
      }
      let firstItem = null;
      for (const item of items) {
        if (item.type === "separator") {
          const sep = document.createElement("div");
          sep.style.cssText = `height: 1px; background: ${THEMES[this.theme].gridColor}; margin: 4px 0;`;
          menu.appendChild(sep);
          continue;
        }
        const btn = document.createElement("button");
        btn.setAttribute("role", "menuitem");
        if (item.disabled) {
          btn.disabled = true;
          btn.style.cssText = `
          display: flex; justify-content: space-between; align-items: center;
          width: 100%; padding: ${mobile ? 10 : 6}px 12px; border: none; background: transparent;
          cursor: default; font-size: ${mobile ? 15 : 13}px; border-radius: 4px;
          color: ${THEMES[this.theme].gridLabelColor}; opacity: 0.35; font-family: inherit;
        `;
        } else {
          btn.style.cssText = `
          display: flex; justify-content: space-between; align-items: center;
          width: 100%; padding: ${mobile ? 10 : 6}px 12px; border: none; background: transparent;
          cursor: pointer; font-size: ${mobile ? 15 : 13}px; border-radius: 4px;
          color: ${THEMES[this.theme].gridLabelColor}; font-family: inherit;
        `;
          btn.addEventListener("mouseenter", () => {
            btn.style.background = THEMES[this.theme].gridColor;
          });
          btn.addEventListener("mouseleave", () => {
            btn.style.background = "transparent";
          });
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            item.action();
            this.dismissContextMenu();
          });
          if (!firstItem) firstItem = btn;
        }
        btn.innerHTML = `<span>${item.label}</span><span style="font-size: 11px; opacity: 0.5;">${item.shortcut}</span>`;
        menu.appendChild(btn);
      }
      document.body.appendChild(menu);
      this.contextMenu = menu;
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.bottom > vh - 8) {
        menu.style.top = Math.max(8, vh - menuRect.height - 8) + "px";
      }
      if (!firstItem) firstItem = menu.querySelector("button:not([disabled])");
      if (firstItem) firstItem.focus();
      const onKey = (e) => {
        if (e.key === "Escape") {
          this.dismissContextMenu();
          return;
        }
        const btns = [...menu.querySelectorAll("button:not([disabled])")];
        const idx = btns.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          btns[(idx + 1) % btns.length]?.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          btns[(idx - 1 + btns.length) % btns.length]?.focus();
        }
      };
      menu.addEventListener("keydown", onKey);
      this.contextMenuKeyHandler = onKey;
    }
    dismissContextMenu() {
      if (this.contextMenu) {
        if (this.contextMenuKeyHandler) {
          this.contextMenu.removeEventListener("keydown", this.contextMenuKeyHandler);
          this.contextMenuKeyHandler = null;
        }
        this.contextMenu.remove();
        this.contextMenu = null;
      }
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.longPressStart = null;
    }
    onWindowClick = () => {
      this.dismissContextMenu();
    };
    deleteSelected() {
      if (this.selectedIds.size === 0) return;
      this.pushUndo();
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (el && el.tool === "image") this.imageCache.delete(el.src);
      }
      this.elements = this.elements.filter((e) => !this.selectedIds.has(e.id));
      this.selectedIds.clear();
      this.renderAll();
      this.emit("change");
    }
    releasePointerCapture() {
      if (this.activePointerId !== null) {
        try {
          this.liveCanvas.releasePointerCapture(this.activePointerId);
        } catch {
        }
        const upEvt = new PointerEvent("pointerup", { pointerId: this.activePointerId });
        this.onPointerUp(upEvt);
      }
    }
    startTextEdit(worldX, worldY, existing) {
      this.commitText();
      this.editingTextOriginal = existing ? JSON.parse(JSON.stringify(existing)) : null;
      const screen = this.worldToScreen(worldX, worldY);
      const ta = document.createElement("textarea");
      const mobile = IS_MOBILE();
      const fontSize = existing?.fontSize ?? this.fontSize;
      const taFontSize = Math.max(mobile ? 16 : 0, fontSize * this.camera.zoom);
      ta.style.cssText = `
      position: absolute; left: ${screen.x}px; top: ${screen.y}px;
      min-width: ${mobile ? 80 : 60}px; min-height: 28px;
      background: transparent; border: 2px solid ${THEMES[this.theme].selectionColor};
      border-radius: 4px; padding: 4px 6px;
      font-size: ${taFontSize}px;
      font-family: ${existing?.fontFamily ?? this.fontFamily};
      color: ${existing?.color ?? this.strokeColor};
      outline: none; resize: none; overflow: hidden;
      z-index: 10; box-sizing: border-box;
      line-height: 1.4; white-space: pre-wrap;
    `;
      ta.value = existing?.content ?? "";
      ta.addEventListener("blur", () => this.commitText());
      ta.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          this.cancelText();
          return;
        }
        ev.stopPropagation();
      });
      ta.addEventListener("input", () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
        ta.style.width = Math.max(60, ta.scrollWidth + 10) + "px";
        this.renderTextPreview(ta.value, worldX, worldY, fontSize, existing?.fontFamily ?? this.fontFamily, existing?.color ?? this.strokeColor);
      });
      this.canvasWrapper.appendChild(ta);
      this.textInput = ta;
      this.editingTextId = existing?.id ?? null;
      if (existing) {
        this.pushUndo();
        this.elements = this.elements.filter((e) => e.id !== existing.id);
        this.renderStatic();
      }
      setTimeout(() => {
        ta.focus();
        ta.style.height = ta.scrollHeight + "px";
        this.renderTextPreview(ta.value, worldX, worldY, fontSize, existing?.fontFamily ?? this.fontFamily, existing?.color ?? this.strokeColor);
      }, 0);
    }
    cancelText() {
      if (!this.textInput) return;
      const ta = this.textInput;
      this.textInput = null;
      ta.remove();
      this.flushLive();
      if (this.editingTextOriginal) {
        this.elements.push(this.editingTextOriginal);
        this.renderStatic();
        this.emit("change");
      }
      this.editingTextId = null;
      this.editingTextOriginal = null;
    }
    commitText() {
      if (!this.textInput) return;
      const ta = this.textInput;
      const content = ta.value.trim();
      const orig = this.editingTextOriginal;
      this.textInput = null;
      ta.remove();
      this.editingTextOriginal = null;
      this.flushLive();
      if (content) {
        const screenX = parseFloat(ta.style.left);
        const screenY = parseFloat(ta.style.top);
        const world = this.screenToWorld(screenX, screenY);
        const el = {
          id: this.editingTextId ?? uid(),
          tool: "text",
          position: world,
          content,
          fontSize: orig?.fontSize ?? this.fontSize,
          fontFamily: orig?.fontFamily ?? this.fontFamily,
          color: orig?.color ?? ta.style.color,
          width: orig?.width ?? 1,
          opacity: orig?.opacity ?? this.strokeOpacity
        };
        this.pushUndo();
        this.elements.push(el);
        this.renderStatic();
        this.emit("change");
      }
      this.editingTextId = null;
    }
    flush = () => {
      this.animFrameId = null;
      if (!this.dirty) return;
      this.dirty = false;
      this.flushLive();
    };
    renderAll() {
      this.renderStatic();
      this.flushLive();
    }
    hintEl = null;
    renderStatic() {
      const ctx = this.staticCtx;
      const t = THEMES[this.theme];
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = t.canvasBg;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.x, -this.camera.y);
      if (this.graph.enabled) {
        if (this.graphDirty || !this.graphCanvas) {
          this.ensureGraphCanvas();
          this.renderGraphToOffscreen();
        }
        ctx.drawImage(this.graphCanvas, this.camera.x * this.camera.zoom, this.camera.y * this.camera.zoom, this.width, this.height, 0, 0, this.width, this.height);
      }
      for (const el of this.elements) this.drawElement(ctx, el);
      ctx.restore();
      if (this.elements.length === 0 && !this.currentElement) {
        if (!this.hintEl) {
          this.hintEl = document.createElement("div");
          this.hintEl.className = "casuya-hint";
          this.hintEl.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none;font-family:system-ui,sans-serif;`;
          this.canvasWrapper.appendChild(this.hintEl);
        }
        const hintSize = IS_MOBILE() ? 11 : 14;
        this.hintEl.textContent = IS_MOBILE() ? "Tap a tool to start" : "Choose a tool and start drawing";
        this.hintEl.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none;font-family:system-ui,sans-serif;font-size:${hintSize}px;color:${t.hintColor};`;
        this.hintEl.style.display = "";
      } else if (this.hintEl) {
        this.hintEl.style.display = "none";
      }
    }
    ensureGraphCanvas() {
      if (!this.graphCanvas) {
        this.graphCanvas = document.createElement("canvas");
        this.graphCtx = this.graphCanvas.getContext("2d");
      }
      if (this.graphCanvas.width !== this.width * this.dpr || this.graphCanvas.height !== this.height * this.dpr) {
        this.graphCanvas.width = this.width * this.dpr;
        this.graphCanvas.height = this.height * this.dpr;
        this.graphCtx.scale(this.dpr, this.dpr);
        this.graphDirty = true;
      }
    }
    renderGraphToOffscreen() {
      const ctx = this.graphCtx;
      const t = THEMES[this.theme];
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawGraph(ctx);
      this.graphDirty = false;
    }
    flushLive() {
      const ctx = this.liveCtx;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.x, -this.camera.y);
      if (this.currentElement) this.drawElement(ctx, this.currentElement);
      this.drawSelectionIndicators(ctx);
      this.drawAlignmentGuides(ctx);
      this.drawLaserStrokes(ctx);
      this.drawRemoteCursors(ctx);
      if (this.marqueeStart && this.marqueeEnd) {
        const t = THEMES[this.theme];
        const x = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const y = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const w = Math.abs(this.marqueeEnd.x - this.marqueeStart.x);
        const h = Math.abs(this.marqueeEnd.y - this.marqueeStart.y);
        ctx.fillStyle = t.selectionFill;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = t.selectionColor;
        ctx.lineWidth = 1 / this.camera.zoom;
        ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }
      if (this.activeTool === "eraser" && this.lastPointerWorld) {
        const eraserRadius = IS_MOBILE() ? this.strokeWidth * 3.5 : this.strokeWidth * 2.5;
        ctx.beginPath();
        ctx.arc(this.lastPointerWorld.x, this.lastPointerWorld.y, eraserRadius, 0, Math.PI * 2);
        ctx.strokeStyle = THEMES[this.theme].selectionColor;
        ctx.lineWidth = 1 / this.camera.zoom;
        ctx.stroke();
      }
      ctx.restore();
    }
    drawGraph(ctx) {
      const { spacing, showAxes, showLabels } = this.graph;
      const t = THEMES[this.theme];
      const vl = this.camera.x;
      const vt = this.camera.y;
      const vr = this.camera.x + this.width / this.camera.zoom;
      const vb = this.camera.y + this.height / this.camera.zoom;
      const startX = Math.floor(vl / spacing) * spacing;
      const endX = Math.ceil(vr / spacing) * spacing;
      const startY = Math.floor(vt / spacing) * spacing;
      const endY = Math.ceil(vb / spacing) * spacing;
      ctx.strokeStyle = this.graph.color || t.gridColor;
      ctx.lineWidth = 0.5 / this.camera.zoom;
      ctx.beginPath();
      for (let x = startX; x <= endX; x += spacing) {
        ctx.moveTo(x, vt);
        ctx.lineTo(x, vb);
      }
      for (let y = startY; y <= endY; y += spacing) {
        ctx.moveTo(vl, y);
        ctx.lineTo(vr, y);
      }
      ctx.stroke();
      if (showAxes) {
        ctx.strokeStyle = t.gridAxisColor;
        ctx.lineWidth = 1.5 / this.camera.zoom;
        ctx.beginPath();
        if (0 >= vt && 0 <= vb) {
          ctx.moveTo(vl, 0);
          ctx.lineTo(vr, 0);
        }
        if (0 >= vl && 0 <= vr) {
          ctx.moveTo(0, vt);
          ctx.lineTo(0, vb);
        }
        ctx.stroke();
        if (showLabels) {
          ctx.fillStyle = t.gridLabelColor;
          ctx.font = `${10 / this.camera.zoom}px system-ui, sans-serif`;
          const labelOffset = spacing;
          ctx.textAlign = "center";
          if (0 >= vt && 0 <= vb) {
            for (let x = startX; x <= endX; x += spacing * 2) {
              if (Math.abs(x) < labelOffset) continue;
              ctx.fillText(String(x / spacing), x, 14 / this.camera.zoom);
            }
          }
          ctx.textAlign = "right";
          if (0 >= vl && 0 <= vr) {
            for (let y = startY; y <= endY; y += spacing * 2) {
              if (Math.abs(y) < labelOffset) continue;
              ctx.fillText(String(-y / spacing), -6 / this.camera.zoom, y + 4 / this.camera.zoom);
            }
          }
        }
      }
    }
    drawElement(ctx, el) {
      ctx.save();
      ctx.globalAlpha = el.opacity;
      const rotation = el.rotation ?? 0;
      if (rotation !== 0) {
        const center = this.getRotationCenter(el);
        ctx.translate(center.x, center.y);
        ctx.rotate(rotation);
        ctx.translate(-center.x, -center.y);
      }
      if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter") {
        this.drawFreehand(ctx, el);
      } else if (el.tool === "laser") {
      } else if (el.tool === "text") {
        this.drawText(ctx, el);
      } else if (el.tool === "image") {
        this.drawImage(ctx, el);
      } else if (el.tool === "katex") {
        this.drawLaTeX(ctx, el);
      } else {
        this.drawShape(ctx, el);
      }
      ctx.restore();
    }
    drawFreehand(ctx, stroke) {
      const { points, color, width, tool } = stroke;
      if (points.length < 2) return;
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else if (tool === "highlighter") {
        ctx.globalCompositeOperation = "multiply";
        ctx.strokeStyle = color;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const hasPressure = points.some((p) => p.pressure !== void 0 && p.pressure !== 0.5);
      if (hasPressure && tool === "pen") {
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const pressure = curr.pressure ?? 0.5;
          ctx.lineWidth = width * (0.3 + pressure * 1.4);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const mx = (prev.x + curr.x) / 2;
          const my = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    drawText(ctx, el) {
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontSize}px ${el.fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const maxWidth = el.width > 1 ? el.width : 300;
      const rawLines = el.content.split("\n");
      const wrappedLines = [];
      for (const rawLine of rawLines) {
        if (rawLine === "") {
          wrappedLines.push("");
          continue;
        }
        const words = rawLine.split(" ");
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine ? currentLine + " " + word : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        wrappedLines.push(currentLine);
      }
      const lineHeight = el.fontSize * 1.4;
      for (let i = 0; i < wrappedLines.length; i++) {
        ctx.fillText(wrappedLines[i], el.position.x, el.position.y + i * lineHeight);
      }
    }
    drawLaTeX(ctx, el) {
      const cacheKey = `${el.latex}|${el.fontSize}|${el.color}`;
      let img = this.katexImageCache.get(cacheKey);
      if (!img) {
        const rendered = this.renderKaTeXToImage(el.latex, el.fontSize, el.color);
        if (rendered) {
          img = rendered;
          this.katexImageCache.set(cacheKey, img);
        }
      }
      if (img && img.complete && img.naturalWidth > 0) {
        const w = el.width ?? img.naturalWidth;
        const h = el.height ?? img.naturalHeight;
        ctx.drawImage(img, el.position.x, el.position.y, w, h);
      } else {
        ctx.fillStyle = el.color;
        ctx.font = `${el.fontSize}px "Courier New", monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(el.latex, el.position.x, el.position.y);
      }
    }
    renderKaTeXToImage(latex, fontSize, color) {
      try {
        const katex = window.katex;
        if (!katex) return null;
        const html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${fontSize * latex.length * 0.6}" height="${fontSize * 1.8}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSize}px;color:${color};white-space:nowrap;">${html}</div></foreignObject></svg>`;
        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        img.onload = () => {
          URL.revokeObjectURL(url);
          this.renderAll();
        };
        return img;
      } catch {
        return null;
      }
    }
    roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    drawShape(ctx, shape) {
      const effectiveRoughness = shape.roughness !== void 0 ? shape.roughness : this.roughness;
      if (effectiveRoughness > 0) {
        this.drawRoughShape(ctx, shape);
        return;
      }
      const { start, end, color, width } = shape;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      switch (shape.tool) {
        case "line":
          if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          if (shape.dashPattern) ctx.setLineDash([]);
          break;
        case "rect": {
          const rx = Math.min(start.x, end.x);
          const ry = Math.min(start.y, end.y);
          const rw = Math.abs(end.x - start.x);
          const rh = Math.abs(end.y - start.y);
          const cr = shape.cornerRadius ?? 0;
          if (shape.filled) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25 * shape.opacity;
            if (cr > 0) {
              this.roundRect(ctx, rx, ry, rw, rh, cr);
              ctx.fill();
            } else ctx.fillRect(rx, ry, rw, rh);
            ctx.globalAlpha = shape.opacity;
          }
          if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
          if (cr > 0) {
            this.roundRect(ctx, rx, ry, rw, rh, cr);
            ctx.stroke();
          } else ctx.strokeRect(rx, ry, rw, rh);
          if (shape.dashPattern) ctx.setLineDash([]);
          break;
        }
        case "circle": {
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          const rrx = Math.abs(end.x - start.x) / 2;
          const rry = Math.abs(end.y - start.y) / 2;
          if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rrx, rry, 0, 0, Math.PI * 2);
          if (shape.filled) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25 * shape.opacity;
            ctx.fill();
            ctx.globalAlpha = shape.opacity;
          }
          ctx.stroke();
          if (shape.dashPattern) ctx.setLineDash([]);
          break;
        }
        case "arrow": {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const len = Math.hypot(dx, dy);
          if (len < 1) break;
          if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          if (shape.dashPattern) ctx.setLineDash([]);
          const headLen = Math.min(15, len * 0.3);
          const angle = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
          if (shape.label) {
            const mx = (start.x + end.x) / 2;
            const my = (start.y + end.y) / 2;
            ctx.font = `${Math.max(12, width * 4)}px system-ui, sans-serif`;
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(shape.label, mx, my - 4);
          }
          break;
        }
        case "diamond": {
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          const hw = Math.abs(end.x - start.x) / 2;
          const hh = Math.abs(end.y - start.y) / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy - hh);
          ctx.lineTo(cx + hw, cy);
          ctx.lineTo(cx, cy + hh);
          ctx.lineTo(cx - hw, cy);
          ctx.closePath();
          if (shape.filled) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25 * shape.opacity;
            ctx.fill();
            ctx.globalAlpha = shape.opacity;
          }
          if (shape.dashPattern) ctx.setLineDash(shape.dashPattern);
          ctx.stroke();
          if (shape.dashPattern) ctx.setLineDash([]);
          break;
        }
      }
    }
    seededRandom(seed) {
      let s = seed;
      return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }
    drawRoughShape(ctx, shape) {
      const roughLevel = shape.roughness ?? this.roughness;
      const maxOffset = roughLevel * 1.5;
      const passes = roughLevel + 1;
      const seedVal = shape.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const rand = this.seededRandom(seedVal);
      const { start, end, color, width } = shape;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let pass = 0; pass < passes; pass++) {
        const off = () => (rand() - 0.5) * maxOffset;
        ctx.globalAlpha = Math.max(0.3, 1 - pass * 0.15);
        ctx.beginPath();
        switch (shape.tool) {
          case "line": {
            ctx.moveTo(start.x + off(), start.y + off());
            ctx.lineTo(end.x + off(), end.y + off());
            ctx.stroke();
            break;
          }
          case "rect": {
            const rx = Math.min(start.x, end.x);
            const ry = Math.min(start.y, end.y);
            const rw = Math.abs(end.x - start.x);
            const rh = Math.abs(end.y - start.y);
            const pts = [
              { x: rx, y: ry },
              { x: rx + rw, y: ry },
              { x: rx + rw, y: ry + rh },
              { x: rx, y: ry + rh }
            ];
            for (let i = 0; i < 4; i++) {
              const a = pts[i];
              const b = pts[(i + 1) % 4];
              ctx.moveTo(a.x + off(), a.y + off());
              const segs = 4;
              for (let s = 1; s <= segs; s++) {
                const t = s / segs;
                ctx.lineTo(
                  a.x + (b.x - a.x) * t + off(),
                  a.y + (b.y - a.y) * t + off()
                );
              }
            }
            ctx.closePath();
            if (shape.filled) {
              ctx.fillStyle = color;
              const savedAlpha = ctx.globalAlpha;
              ctx.globalAlpha = 0.25 * shape.opacity;
              ctx.fill();
              ctx.globalAlpha = savedAlpha;
            }
            ctx.stroke();
            break;
          }
          case "circle": {
            const cx = (start.x + end.x) / 2;
            const cy = (start.y + end.y) / 2;
            const rrx = Math.abs(end.x - start.x) / 2;
            const rry = Math.abs(end.y - start.y) / 2;
            const segs = 36;
            for (let i = 0; i <= segs; i++) {
              const a = i / segs * Math.PI * 2;
              const px = cx + Math.cos(a) * rrx + off();
              const py = cy + Math.sin(a) * rry + off();
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            if (shape.filled) {
              ctx.fillStyle = color;
              const savedAlpha = ctx.globalAlpha;
              ctx.globalAlpha = 0.25 * shape.opacity;
              ctx.fill();
              ctx.globalAlpha = savedAlpha;
            }
            ctx.stroke();
            break;
          }
          case "arrow": {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len < 1) break;
            ctx.moveTo(start.x + off(), start.y + off());
            ctx.lineTo(end.x + off(), end.y + off());
            ctx.stroke();
            const headLen = Math.min(15, len * 0.3);
            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(end.x + off(), end.y + off());
            ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6) + off(), end.y - headLen * Math.sin(angle - Math.PI / 6) + off());
            ctx.moveTo(end.x + off(), end.y + off());
            ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6) + off(), end.y - headLen * Math.sin(angle + Math.PI / 6) + off());
            ctx.stroke();
            break;
          }
          case "diamond": {
            const dcx = (start.x + end.x) / 2;
            const dcy = (start.y + end.y) / 2;
            const hw = Math.abs(end.x - start.x) / 2;
            const hh = Math.abs(end.y - start.y) / 2;
            const dpts = [
              { x: dcx, y: dcy - hh },
              { x: dcx + hw, y: dcy },
              { x: dcx, y: dcy + hh },
              { x: dcx - hw, y: dcy }
            ];
            for (let i = 0; i < 4; i++) {
              const a = dpts[i];
              const b = dpts[(i + 1) % 4];
              ctx.moveTo(a.x + off(), a.y + off());
              for (let s = 1; s <= 4; s++) {
                const t = s / 4;
                ctx.lineTo(a.x + (b.x - a.x) * t + off(), a.y + (b.y - a.y) * t + off());
              }
            }
            ctx.closePath();
            if (shape.filled) {
              ctx.fillStyle = color;
              const savedAlpha = ctx.globalAlpha;
              ctx.globalAlpha = 0.25 * shape.opacity;
              ctx.fill();
              ctx.globalAlpha = savedAlpha;
            }
            ctx.stroke();
            break;
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    drawSelectionIndicators(ctx) {
      if (this.selectedIds.size === 0) return;
      const t = THEMES[this.theme];
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (!el) continue;
        const bounds = this.getElementBounds(el);
        const local = this.getLocalBounds(el);
        const rotation = el.rotation ?? 0;
        const pad = 6 / this.camera.zoom;
        ctx.save();
        ctx.strokeStyle = t.selectionColor;
        ctx.lineWidth = 1.5 / this.camera.zoom;
        ctx.fillStyle = t.selectionFill;
        if (rotation !== 0) {
          const corners = this.getRotatedCorners({ x: local.x - pad, y: local.y - pad, w: local.w + pad * 2, h: local.h + pad * 2 }, rotation);
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          ctx.lineTo(corners[1].x, corners[1].y);
          ctx.lineTo(corners[2].x, corners[2].y);
          ctx.lineTo(corners[3].x, corners[3].y);
          ctx.closePath();
          ctx.fill();
          ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
          ctx.stroke();
          ctx.setLineDash([]);
          const handles = [
            corners[0],
            { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
            corners[1],
            { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
            corners[2],
            { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
            corners[3],
            { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 }
          ];
          const handleSize = (IS_MOBILE() ? 12 : 8) / this.camera.zoom;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = t.selectionColor;
          ctx.lineWidth = 1.5 / this.camera.zoom;
          for (const c of handles) {
            ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
          }
        } else {
          ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
          ctx.fillRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
          ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
          ctx.setLineDash([]);
          const handleSize = (IS_MOBILE() ? 12 : 8) / this.camera.zoom;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = t.selectionColor;
          ctx.lineWidth = 1.5 / this.camera.zoom;
          const handles = [
            { x: bounds.x - pad, y: bounds.y - pad },
            { x: bounds.x + bounds.w / 2, y: bounds.y - pad },
            { x: bounds.x + bounds.w + pad, y: bounds.y - pad },
            { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h / 2 },
            { x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad },
            { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h + pad },
            { x: bounds.x - pad, y: bounds.y + bounds.h + pad },
            { x: bounds.x - pad, y: bounds.y + bounds.h / 2 }
          ];
          for (const c of handles) {
            ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
          }
        }
        const rotateHandleDist = 28 / this.camera.zoom;
        const rc = this.getRotateHandlePos();
        if (rc) {
          ctx.save();
          ctx.strokeStyle = t.selectionColor;
          ctx.lineWidth = 1.5 / this.camera.zoom;
          const topCenter = { x: bounds.x + bounds.w / 2, y: bounds.y - pad };
          const from = (el.rotation ?? 0) !== 0 ? this.rotatePoint(topCenter, this.getRotationCenter(el), el.rotation ?? 0) : topCenter;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(rc.x, rc.y);
          ctx.stroke();
          const circleR = 5 / this.camera.zoom;
          ctx.beginPath();
          ctx.arc(rc.x, rc.y, circleR, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
    }
    renderTextPreview(content, worldX, worldY, fontSize, fontFamily, color) {
      const ctx = this.liveCtx;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.x, -this.camera.y);
      ctx.fillStyle = color;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = content.split("\n");
      const lineHeight = fontSize * 1.4;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], worldX, worldY + i * lineHeight);
      }
      ctx.restore();
    }
    updateToolbar() {
      updateToolbarState(this.toolbar, this.activeTool, this.strokeColor, this.strokeWidth, this.fillEnabled, this.theme, this.camera.zoom, this.fontSize, this.roughness, this.graph.enabled, this.dashEnabled, this.strokeOpacity, this.fontFamily, this.cornerRadius, this.pixelEraser);
    }
    setTool(tool) {
      this.commitText();
      this.activeTool = tool;
      let cursor = "crosshair";
      if (tool === "select") cursor = "default";
      else if (tool === "hand") cursor = "grab";
      else if (tool === "text") cursor = "text";
      else if (tool === "eraser") cursor = "cell";
      else if (tool === "highlighter") cursor = "crosshair";
      else if (tool === "laser") cursor = "none";
      else if (tool === "diamond") cursor = "crosshair";
      this.liveCanvas.style.cursor = cursor;
      this.updateToolbar();
      this.emit("toolchange");
    }
    getTool() {
      return this.activeTool;
    }
    setColor(color) {
      this.strokeColor = color;
      this.updateToolbar();
    }
    getColor() {
      return this.strokeColor;
    }
    setWidth(width) {
      this.strokeWidth = Math.max(1, Math.min(50, width));
      this.updateToolbar();
    }
    getWidth() {
      return this.strokeWidth;
    }
    getFontSize() {
      return this.fontSize;
    }
    setFontSize(size) {
      this.fontSize = Math.max(8, Math.min(72, size));
      this.updateToolbar();
    }
    getRoughness() {
      return this.roughness;
    }
    setRoughness(level) {
      this.roughness = Math.max(0, Math.min(3, level));
      this.renderAll();
    }
    setFill(enabled) {
      this.fillEnabled = enabled;
      this.updateToolbar();
    }
    getFill() {
      return this.fillEnabled;
    }
    getDashEnabled() {
      return this.dashEnabled;
    }
    setDashEnabled(enabled) {
      this.dashEnabled = enabled;
      this.updateToolbar();
    }
    getOpacity() {
      return this.strokeOpacity;
    }
    setOpacity(opacity) {
      this.strokeOpacity = Math.max(0.05, Math.min(1, opacity));
      this.updateToolbar();
    }
    exportPNG() {
      this.toBlob("image/png").then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "blackboard.png";
        a.click();
        URL.revokeObjectURL(url);
      });
    }
    getFontFamily() {
      return this.fontFamily;
    }
    setFontFamily(family) {
      this.fontFamily = family;
      this.updateToolbar();
    }
    getCornerRadius() {
      return this.cornerRadius;
    }
    setCornerRadius(r) {
      this.cornerRadius = Math.max(0, Math.min(50, r));
      this.updateToolbar();
    }
    getPixelEraser() {
      return this.pixelEraser;
    }
    setPixelEraser(enabled) {
      this.pixelEraser = enabled;
      this.updateToolbar();
    }
    getClipboard() {
      return this.clipboardData;
    }
    setClipboard(data) {
      this.clipboardData = data;
    }
    getTheme() {
      return this.theme;
    }
    setTheme(theme) {
      this.theme = theme;
      this.root.style.background = THEMES[this.theme].canvasBg;
      this.graphDirty = true;
      this.renderAll();
      this.updateToolbar();
    }
    getZoom() {
      return this.camera.zoom;
    }
    zoomTo(level, center) {
      const cx = center?.x ?? this.width / 2;
      const cy = center?.y ?? this.height / 2;
      const worldBefore = this.screenToWorld(cx, cy);
      this.camera.zoom = Math.max(0.1, Math.min(10, level));
      const worldAfter = this.screenToWorld(cx, cy);
      this.camera.x += worldBefore.x - worldAfter.x;
      this.camera.y += worldBefore.y - worldAfter.y;
      this.renderAll();
      this.updateToolbar();
    }
    resetView() {
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.graphDirty = true;
      this.renderAll();
      this.updateToolbar();
    }
    isGraphEnabled() {
      return this.graph.enabled;
    }
    enableGraph(options) {
      this.graph = { ...this.graph, ...options, enabled: true };
      this.graphDirty = true;
      this.renderStatic();
    }
    disableGraph() {
      this.graph.enabled = false;
      this.renderStatic();
    }
    undo() {
      if (this.undoStack.length === 0) return;
      const currentSnapshot = this.elements.map((el) => {
        if (el.tool === "image") {
          const img = el;
          let idx = this.imageSrcToIdx.get(img.src);
          if (idx === void 0) {
            idx = this.imagePool.length;
            this.imagePool.push(img.src);
            this.imageSrcToIdx.set(img.src, idx);
          }
          return { ...img, src: `__img:${idx}` };
        }
        return JSON.parse(JSON.stringify(el));
      });
      this.redoStack.push(currentSnapshot);
      this.elements = this.resolveSnapshot(this.undoStack.pop());
      this.selectedIds.clear();
      this.renderAll();
      this.updateToolbar();
      this.emit("undo");
      this.emit("change");
    }
    redo() {
      if (this.redoStack.length === 0) return;
      const currentSnapshot = this.elements.map((el) => {
        if (el.tool === "image") {
          const img = el;
          let idx = this.imageSrcToIdx.get(img.src);
          if (idx === void 0) {
            idx = this.imagePool.length;
            this.imagePool.push(img.src);
            this.imageSrcToIdx.set(img.src, idx);
          }
          return { ...img, src: `__img:${idx}` };
        }
        return JSON.parse(JSON.stringify(el));
      });
      this.undoStack.push(currentSnapshot);
      this.elements = this.resolveSnapshot(this.redoStack.pop());
      this.selectedIds.clear();
      this.renderAll();
      this.updateToolbar();
      this.emit("redo");
      this.emit("change");
    }
    clear() {
      if (this.elements.length === 0) {
        this.emit("clear");
        return;
      }
      if (!confirm("Clear all elements?")) return;
      this.pushUndo();
      this.elements = [];
      this.selectedIds.clear();
      this.currentElement = null;
      this.imageCache.clear();
      this.renderAll();
      this.updateToolbar();
      this.emit("clear");
      this.emit("change");
    }
    getElements() {
      return this.elements;
    }
    on(event, callback) {
      if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
      this.listeners.get(event).add(callback);
    }
    off(event, callback) {
      this.listeners.get(event)?.delete(callback);
    }
    emit(event) {
      const set = this.listeners.get(event);
      if (!set) return;
      if (event === "change") this.dirtySinceSave = true;
      const payload = { elements: this.elements, tool: this.activeTool };
      set.forEach((cb) => cb(payload));
    }
    bringForward() {
      if (this.selectedIds.size !== 1) return;
      const id = this.selectedIds.values().next().value;
      const idx = this.elements.findIndex((e) => e.id === id);
      if (idx < 0 || idx >= this.elements.length - 1) return;
      this.pushUndo();
      [this.elements[idx], this.elements[idx + 1]] = [this.elements[idx + 1], this.elements[idx]];
      this.renderAll();
      this.emit("change");
    }
    sendBackward() {
      if (this.selectedIds.size !== 1) return;
      const id = this.selectedIds.values().next().value;
      const idx = this.elements.findIndex((e) => e.id === id);
      if (idx <= 0) return;
      this.pushUndo();
      [this.elements[idx], this.elements[idx - 1]] = [this.elements[idx - 1], this.elements[idx]];
      this.renderAll();
      this.emit("change");
    }
    bringToFront() {
      if (this.selectedIds.size !== 1) return;
      const id = this.selectedIds.values().next().value;
      const idx = this.elements.findIndex((e) => e.id === id);
      if (idx < 0 || idx >= this.elements.length - 1) return;
      this.pushUndo();
      const [el] = this.elements.splice(idx, 1);
      this.elements.push(el);
      this.renderAll();
      this.emit("change");
    }
    sendToBack() {
      if (this.selectedIds.size !== 1) return;
      const id = this.selectedIds.values().next().value;
      const idx = this.elements.findIndex((e) => e.id === id);
      if (idx <= 0) return;
      this.pushUndo();
      const [el] = this.elements.splice(idx, 1);
      this.elements.unshift(el);
      this.renderAll();
      this.emit("change");
    }
    nudgeSelected(dx, dy) {
      if (this.selectedIds.size === 0) return;
      this.pushUndo();
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (!el) continue;
        if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter") {
          const s = el;
          s.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
        } else if (el.tool === "text") {
          el.position = { x: el.position.x + dx, y: el.position.y + dy };
        } else if (el.tool === "image") {
          el.position = { x: el.position.x + dx, y: el.position.y + dy };
        } else {
          const s = el;
          s.start = { x: s.start.x + dx, y: s.start.y + dy };
          s.end = { x: s.end.x + dx, y: s.end.y + dy };
        }
      }
      this.renderAll();
      this.emit("change");
    }
    showShortcutHelp() {
      if (this.helpOverlay) {
        this.helpOverlay.remove();
        this.helpOverlay = null;
        return;
      }
      const t = THEMES[this.theme];
      const overlay = document.createElement("div");
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;`;
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) {
          overlay.remove();
          this.helpOverlay = null;
        }
      });
      const panel = document.createElement("div");
      panel.style.cssText = `background:${t.canvasBg};color:${t.gridLabelColor};border:1px solid ${t.gridColor};border-radius:12px;padding:20px 24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;font-family:system-ui,sans-serif;font-size:13px;line-height:1.6;`;
      const shortcuts = [
        ["P", "Pen"],
        ["M", "Highlighter"],
        ["T", "Text"],
        ["L", "Line"],
        ["R", "Rect"],
        ["O", "Circle"],
        ["A", "Arrow"],
        ["E", "Eraser"],
        ["V", "Select"],
        ["H", "Hand"],
        ["B", "Laser"],
        ["N", "Diamond"],
        ["Space+Drag", "Pan"],
        ["Esc", "Deselect / Cancel"],
        ["Del", "Delete selected"],
        ["Arrow keys", "Nudge (Shift=10px)"],
        ["Ctrl+Z", "Undo"],
        ["Ctrl+Y", "Redo"],
        ["Ctrl+D", "Duplicate"],
        ["Ctrl+C", "Copy"],
        ["Ctrl+V", "Paste"],
        ["Ctrl+X", "Cut"],
        ["Ctrl+A", "Select all"],
        ["Ctrl+G", "Group"],
        ["Ctrl+Shift+G", "Ungroup"],
        ["Ctrl+]", "Bring forward"],
        ["Ctrl+[", "Send backward"],
        ["Shift+R", "Rotate 15\xB0"],
        ["[/]", "Width +/\u2212 (text: fontSize)"],
        ["Ctrl+Shift+S", "Export SVG"],
        ["Ctrl+Shift+P", "Export PNG"],
        ["Ctrl+Shift+F", "Apply style to selection"],
        ["?", "This help"]
      ];
      let html = `<div style="font-size:16px;font-weight:600;margin-bottom:12px;color:${t.gridAxisColor}">Keyboard Shortcuts</div>`;
      for (const [key, desc] of shortcuts) html += `<div style="display:flex;justify-content:space-between;padding:2px 0"><kbd style="background:${t.gridColor};padding:1px 6px;border-radius:4px;font-size:12px;min-width:90px;text-align:center">${key}</kbd><span>${desc}</span></div>`;
      panel.innerHTML = html;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      this.helpOverlay = overlay;
    }
    duplicateSelected() {
      if (this.selectedIds.size === 0) return;
      this.pushUndo();
      const newIds = /* @__PURE__ */ new Set();
      const groupMap = /* @__PURE__ */ new Map();
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (!el) continue;
        const clone = JSON.parse(JSON.stringify(el));
        clone.id = uid();
        if (el.groupId) {
          if (!groupMap.has(el.groupId)) groupMap.set(el.groupId, uid());
          clone.groupId = groupMap.get(el.groupId);
        } else {
          clone.groupId = void 0;
        }
        if ("start" in clone) {
          clone.start = { x: clone.start.x + 20, y: clone.start.y + 20 };
          clone.end = { x: clone.end.x + 20, y: clone.end.y + 20 };
        }
        if ("position" in clone) {
          clone.position = { x: clone.position.x + 20, y: clone.position.y + 20 };
        }
        if ("points" in clone) {
          clone.points = clone.points.map((p) => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure }));
        }
        this.elements.push(clone);
        newIds.add(clone.id);
      }
      this.selectedIds = newIds;
      this.renderAll();
      this.emit("change");
    }
    rotateSelected(angle) {
      if (this.selectedIds.size === 0) return;
      this.pushUndo();
      const ids = [...this.selectedIds];
      if (ids.length === 1) {
        const el = this.elements.find((e) => e.id === ids[0]);
        if (el) el.rotation = ((el.rotation ?? 0) + angle) % (Math.PI * 2);
      } else {
        let cx = 0, cy = 0, count = 0;
        for (const id of ids) {
          const el = this.elements.find((e) => e.id === id);
          if (!el) continue;
          const b = this.getLocalBounds(el);
          cx += b.x + b.w / 2;
          cy += b.y + b.h / 2;
          count++;
        }
        if (count > 0) {
          cx /= count;
          cy /= count;
        }
        const center = { x: cx, y: cy };
        for (const id of ids) {
          const el = this.elements.find((e) => e.id === id);
          if (!el) continue;
          if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter") {
            const s = el;
            s.points = s.points.map((p) => this.rotatePoint(p, center, angle));
          } else if (el.tool === "text") {
            el.position = this.rotatePoint(el.position, center, angle);
          } else if (el.tool === "image") {
            el.position = this.rotatePoint(el.position, center, angle);
          } else {
            const s = el;
            s.start = this.rotatePoint(s.start, center, angle);
            s.end = this.rotatePoint(s.end, center, angle);
          }
        }
      }
      this.renderAll();
      this.emit("change");
    }
    getSelectedRotation() {
      if (this.selectedIds.size !== 1) return 0;
      const id = this.selectedIds.values().next().value;
      const el = this.elements.find((e) => e.id === id);
      return el ? el.rotation ?? 0 : 0;
    }
    copySelected() {
      if (this.selectedIds.size === 0) return;
      this.clipboard = [];
      const data = [];
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (!el) continue;
        const clone = JSON.parse(JSON.stringify(el));
        clone.id = uid();
        this.clipboard.push(clone);
        data.push(clone);
      }
      this.clipboardData = JSON.stringify(data);
      try {
        navigator.clipboard.writeText(this.clipboardData);
      } catch {
      }
    }
    pasteClipboard() {
      if (this.clipboard.length === 0 && this.clipboardData) {
        try {
          const parsed = JSON.parse(this.clipboardData);
          if (Array.isArray(parsed)) {
            this.clipboard = parsed;
          }
        } catch {
        }
      }
      if (this.clipboard.length === 0) {
        try {
          navigator.clipboard.readText().then((text) => {
            if (!text) return;
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].tool) {
                this.clipboard = parsed;
                this.pasteClipboard();
              }
            } catch {
            }
          }).catch(() => {
          });
        } catch {
        }
        return;
      }
      this.pushUndo();
      const newIds = /* @__PURE__ */ new Set();
      const groupMap = /* @__PURE__ */ new Map();
      for (const el of this.clipboard) {
        const clone = JSON.parse(JSON.stringify(el));
        clone.id = uid();
        if (clone.groupId) {
          if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, uid());
          clone.groupId = groupMap.get(clone.groupId);
        }
        if ("start" in clone) {
          clone.start = { x: clone.start.x + 20, y: clone.start.y + 20 };
          clone.end = { x: clone.end.x + 20, y: clone.end.y + 20 };
        }
        if ("position" in clone) {
          clone.position = { x: clone.position.x + 20, y: clone.position.y + 20 };
        }
        if ("points" in clone) {
          clone.points = clone.points.map((p) => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure }));
        }
        this.elements.push(clone);
        newIds.add(clone.id);
      }
      this.selectedIds = newIds;
      this.clipboard = this.clipboard.map((c) => JSON.parse(JSON.stringify(c)));
      this.renderAll();
      this.emit("change");
    }
    selectAll() {
      this.selectedIds = new Set(this.elements.map((el) => el.id));
      this.renderAll();
      this.emit("change");
    }
    applyStyleToSelected() {
      if (this.selectedIds.size === 0) return;
      this.pushUndo();
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (!el) continue;
        if (el.tool !== "image") el.color = this.strokeColor;
        el.opacity = this.strokeOpacity;
        if ("width" in el && el.tool !== "text") el.width = this.strokeWidth;
        if ("filled" in el) el.filled = this.fillEnabled;
        if ("roughness" in el) el.roughness = this.roughness;
      }
      this.renderAll();
      this.emit("change");
    }
    toDataURL(type = "image/png", quality = 1) {
      const c = document.createElement("canvas");
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      const ctx = c.getContext("2d");
      ctx.drawImage(this.staticCanvas, 0, 0);
      return c.toDataURL(type, quality);
    }
    toBlob(type = "image/png", quality = 1) {
      return new Promise((resolve) => {
        const c = document.createElement("canvas");
        c.width = this.width * this.dpr;
        c.height = this.height * this.dpr;
        const ctx = c.getContext("2d");
        ctx.drawImage(this.staticCanvas, 0, 0);
        c.toBlob(resolve, type, quality);
      });
    }
    exportJSON() {
      return { elements: JSON.parse(JSON.stringify(this.elements)), width: this.width, height: this.height, camera: { ...this.camera }, graph: { ...this.graph }, theme: this.theme };
    }
    importJSON(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.elements)) {
        this.showToast("Invalid snapshot data");
        return;
      }
      const validTools = /* @__PURE__ */ new Set(["pen", "eraser", "highlighter", "laser", "line", "rect", "circle", "arrow", "diamond", "text", "image", "katex"]);
      const valid = snapshot.elements.filter((el) => {
        if (!el || typeof el.id !== "string" || !validTools.has(el.tool)) return false;
        if ((el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter" || el.tool === "laser") && !Array.isArray(el.points)) return false;
        if ((el.tool === "line" || el.tool === "rect" || el.tool === "circle" || el.tool === "arrow" || el.tool === "diamond") && (!el.start || !el.end)) return false;
        if (el.tool === "text" && (!el.position || typeof el.content !== "string")) return false;
        if (el.tool === "image" && (!el.position || typeof el.src !== "string")) return false;
        if (el.tool === "katex" && (!el.position || typeof el.latex !== "string")) return false;
        return true;
      });
      this.elements = valid;
      this.undoStack = [];
      this.redoStack = [];
      this.imageCache.clear();
      if (snapshot.camera) this.camera = snapshot.camera;
      if (snapshot.graph) this.graph = { ...this.graph, ...snapshot.graph };
      if (snapshot.theme) this.setTheme(snapshot.theme);
      this.selectedIds.clear();
      this.renderAll();
      this.emit("load");
      this.emit("change");
      if (valid.length < snapshot.elements.length) {
        this.showToast(`Loaded ${valid.length} of ${snapshot.elements.length} elements`);
      }
    }
    resize(width, height) {
      this.width = width;
      this.height = height;
      this.dpr = window.devicePixelRatio || 1;
      this.graphDirty = true;
      this.setupCanvases();
      this.renderAll();
    }
    saveToStorage(key = "casuya-blackboard") {
      this.cleanImagePool();
      const data = JSON.stringify(this.exportJSON());
      if (data.length > 4 * 1024 * 1024) {
        this.showToast("\u26A0\uFE0F Large data \u2014 some images may not persist");
      }
      try {
        localStorage.setItem(key, data);
        this.emit("save");
      } catch {
        this.showToast("\u26A0\uFE0F Storage full \u2014 clear browser data");
      }
    }
    cleanImagePool() {
      const used = /* @__PURE__ */ new Set();
      const collectFromElements = (els) => {
        for (const el of els) {
          if (el.tool === "image") {
            const src = el.src;
            if (src.startsWith("__img:")) used.add(src);
          }
        }
      };
      collectFromElements(this.elements);
      for (const snap of this.undoStack) collectFromElements(snap);
      for (const snap of this.redoStack) collectFromElements(snap);
      if (used.size === 0) {
        this.imagePool = [];
        this.imageSrcToIdx.clear();
        return;
      }
      const newPool = [];
      const newMap = /* @__PURE__ */ new Map();
      for (let i = 0; i < this.imagePool.length; i++) {
        const ref = `__img:${i}`;
        if (used.has(ref)) {
          const idx = newPool.length;
          newPool.push(this.imagePool[i]);
          newMap.set(this.imagePool[i], idx);
        }
      }
      const remap = (els) => {
        for (const el of els) {
          if (el.tool === "image") {
            const img = el;
            if (img.src.startsWith("__img:")) {
              const oldIdx = parseInt(img.src.slice(6));
              const realSrc = this.imagePool[oldIdx];
              if (realSrc !== void 0) {
                const newIdx = newMap.get(realSrc);
                if (newIdx !== void 0) img.src = `__img:${newIdx}`;
              }
            }
          }
        }
      };
      remap(this.elements);
      for (const snap of this.undoStack) remap(snap);
      for (const snap of this.redoStack) remap(snap);
      this.imagePool = newPool;
      this.imageSrcToIdx = newMap;
    }
    loadFromStorage(key = "casuya-blackboard") {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        this.importJSON(JSON.parse(raw));
        return true;
      } catch {
        return false;
      }
    }
    showToast(msg) {
      const existing = this.root.querySelector(".casuya-toast");
      if (existing) existing.remove();
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
        this.toastTimeout = null;
      }
      const mobile = IS_MOBILE();
      const toast = document.createElement("div");
      toast.className = "casuya-toast";
      toast.textContent = msg;
      toast.style.cssText = `
      position: absolute; bottom: ${mobile ? 8 : 16}px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: white; padding: ${mobile ? 6 : 8}px ${mobile ? 12 : 16}px; border-radius: ${mobile ? 6 : 8}px;
      font-size: ${mobile ? 11 : 13}px; z-index: 100; pointer-events: none; white-space: nowrap;
      animation: fadeInOut 2s ease forwards;
    `;
      if (!document.getElementById("casuya-toast-keyframes")) {
        const style = document.createElement("style");
        style.id = "casuya-toast-keyframes";
        style.textContent = `@keyframes fadeInOut { 0% { opacity: 0; transform: translateX(-50%) translateY(8px); } 15% { opacity: 1; transform: translateX(-50%) translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }`;
        document.head.appendChild(style);
      }
      this.root.appendChild(toast);
      this.toastTimeout = setTimeout(() => {
        toast.remove();
      }, 2e3);
    }
    handleImagePaste(e) {
      if (this.textInput) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result;
            const img = new Image();
            img.onload = () => {
              const centerX = this.width / 2;
              const centerY = this.height / 2;
              const world = this.screenToWorld(centerX, centerY);
              const el = {
                id: uid(),
                tool: "image",
                position: { x: world.x - img.width / 2, y: world.y - img.height / 2 },
                width: img.width,
                height: img.height,
                src,
                opacity: 1
              };
              this.pushUndo();
              this.elements.push(el);
              this.renderAll();
              this.emit("change");
            };
            img.src = src;
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
    handleDragOver(e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    }
    handleFileDrop(e) {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files) return;
      const rect = this.liveCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      this.pushUndo();
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result;
          const img = new Image();
          img.onload = () => {
            const el = {
              id: uid(),
              tool: "image",
              position: { x: world.x - img.width / 2, y: world.y - img.height / 2 },
              width: img.width,
              height: img.height,
              src,
              opacity: 1
            };
            this.elements.push(el);
            this.renderAll();
            this.emit("change");
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      }
    }
    drawImage(ctx, el) {
      let cached = this.imageCache.get(el.src);
      if (!cached) {
        cached = new Image();
        cached.src = el.src;
        this.imageCache.set(el.src, cached);
        if (!cached.complete) {
          cached.onload = () => this.renderAll();
        }
      }
      if (cached.complete && cached.naturalWidth > 0) {
        ctx.drawImage(cached, el.position.x, el.position.y, el.width, el.height);
      }
    }
    groupSelected() {
      if (this.selectedIds.size < 2) return;
      this.pushUndo();
      const groupId = uid();
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (el) el.groupId = groupId;
      }
      this.renderAll();
      this.emit("change");
    }
    ungroupSelected() {
      if (this.selectedIds.size === 0) return;
      this.pushUndo();
      for (const id of this.selectedIds) {
        const el = this.elements.find((e) => e.id === id);
        if (el) el.groupId = void 0;
      }
      this.renderAll();
      this.emit("change");
    }
    exportSVG() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of this.elements) {
        const b = this.getElementBounds(el);
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.w > maxX) maxX = b.x + b.w;
        if (b.y + b.h > maxY) maxY = b.y + b.h;
      }
      if (minX === Infinity) {
        minX = 0;
        minY = 0;
        maxX = this.width;
        maxY = this.height;
      }
      const pad = 10;
      const vx = minX - pad;
      const vy = minY - pad;
      const vw = maxX - minX + pad * 2;
      const vh = maxY - minY + pad * 2;
      const parts = [];
      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`);
      for (const el of this.elements) {
        parts.push(this.elementToSVG(el));
      }
      parts.push("</svg>");
      return parts.join("\n");
    }
    exportSelectedSVG() {
      if (this.selectedIds.size === 0) return this.exportSVG();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const selected = this.elements.filter((e) => this.selectedIds.has(e.id));
      for (const el of selected) {
        const b = this.getElementBounds(el);
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.w > maxX) maxX = b.x + b.w;
        if (b.y + b.h > maxY) maxY = b.y + b.h;
      }
      if (minX === Infinity) return "";
      const pad = 10;
      const vx = minX - pad, vy = minY - pad;
      const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
      const parts = [];
      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`);
      for (const el of selected) parts.push(this.elementToSVG(el));
      parts.push("</svg>");
      return parts.join("\n");
    }
    exportSelectedPNG() {
      if (this.selectedIds.size === 0) {
        this.exportPNG();
        return;
      }
      const selected = this.elements.filter((e) => this.selectedIds.has(e.id));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of selected) {
        const b = this.getElementBounds(el);
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.w > maxX) maxX = b.x + b.w;
        if (b.y + b.h > maxY) maxY = b.y + b.h;
      }
      if (minX === Infinity) return;
      const pad = 10;
      const vx = minX - pad, vy = minY - pad;
      const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
      const c = document.createElement("canvas");
      c.width = vw * this.dpr;
      c.height = vh * this.dpr;
      const ctx = c.getContext("2d");
      ctx.scale(this.dpr, this.dpr);
      ctx.fillStyle = THEMES[this.theme].canvasBg;
      ctx.fillRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(-vx, -vy);
      for (const el of selected) this.drawElement(ctx, el);
      ctx.restore();
      c.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "selection.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
    elementToSVG(el) {
      const rotation = el.rotation ?? 0;
      const op = el.opacity !== void 0 ? ` opacity="${el.opacity}"` : "";
      if (el.tool === "pen" || el.tool === "eraser" || el.tool === "highlighter") {
        const stroke = el;
        if (stroke.points.length < 2) return "";
        const pts = stroke.points;
        let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const mx = ((prev.x + curr.x) / 2).toFixed(2);
          const my = ((prev.y + curr.y) / 2).toFixed(2);
          d += ` Q${prev.x.toFixed(2)},${prev.y.toFixed(2)} ${mx},${my}`;
        }
        d += ` L${pts[pts.length - 1].x.toFixed(2)},${pts[pts.length - 1].y.toFixed(2)}`;
        const strokeColor = stroke.tool === "eraser" ? "none" : stroke.color;
        const fillColor = stroke.tool === "eraser" ? "none" : stroke.color;
        const opAttr = stroke.tool === "highlighter" ? ` opacity="0.3"` : op;
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"${rot}${opAttr}/>`;
      }
      if (el.tool === "line") {
        const s = el;
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(",")}"` : "";
        return `<line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}${rot}${op}/>`;
      }
      if (el.tool === "rect") {
        const s = el;
        const rx = Math.min(s.start.x, s.end.x);
        const ry = Math.min(s.start.y, s.end.y);
        const rw = Math.abs(s.end.x - s.start.x);
        const rh = Math.abs(s.end.y - s.start.y);
        const cr = s.cornerRadius ? ` rx="${s.cornerRadius}" ry="${s.cornerRadius}"` : "";
        const fill = s.filled ? ` fill="${s.color}" fill-opacity="0.25"` : ' fill="none"';
        const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(",")}"` : "";
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"${cr} stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
      }
      if (el.tool === "circle") {
        const s = el;
        const cx = (s.start.x + s.end.x) / 2;
        const cy = (s.start.y + s.end.y) / 2;
        const rrx = Math.abs(s.end.x - s.start.x) / 2;
        const rry = Math.abs(s.end.y - s.start.y) / 2;
        const fill = s.filled ? ` fill="${s.color}" fill-opacity="0.25"` : ' fill="none"';
        const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(",")}"` : "";
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rrx}" ry="${rry}" stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
      }
      if (el.tool === "arrow") {
        const s = el;
        const dx = s.end.x - s.start.x;
        const dy = s.end.y - s.start.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return "";
        const headLen = Math.min(15, len * 0.3);
        const angle = Math.atan2(dy, dx);
        const ax1 = s.end.x - headLen * Math.cos(angle - Math.PI / 6);
        const ay1 = s.end.y - headLen * Math.sin(angle - Math.PI / 6);
        const ax2 = s.end.x - headLen * Math.cos(angle + Math.PI / 6);
        const ay2 = s.end.y - headLen * Math.sin(angle + Math.PI / 6);
        const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(",")}"` : "";
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<g${rot}${op}><line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}/><line x1="${s.end.x}" y1="${s.end.y}" x2="${ax1}" y2="${ay1}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}/><line x1="${s.end.x}" y1="${s.end.y}" x2="${ax2}" y2="${ay2}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round"${dash}/></g>`;
      }
      if (el.tool === "diamond") {
        const s = el;
        const dcx = (s.start.x + s.end.x) / 2;
        const dcy = (s.start.y + s.end.y) / 2;
        const hw = Math.abs(s.end.x - s.start.x) / 2;
        const hh = Math.abs(s.end.y - s.start.y) / 2;
        const fill = s.filled ? ` fill="${s.color}" fill-opacity="0.25"` : ' fill="none"';
        const dash = s.dashPattern ? ` stroke-dasharray="${s.dashPattern.join(",")}"` : "";
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<polygon points="${dcx},${dcy - hh} ${dcx + hw},${dcy} ${dcx},${dcy + hh} ${dcx - hw},${dcy}" stroke="${s.color}" stroke-width="${s.width}"${fill}${dash}${rot}${op}/>`;
      }
      if (el.tool === "katex") {
        const k = el;
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<text x="${k.position.x}" y="${k.position.y}" font-size="${k.fontSize}" font-family="'Courier New', monospace" fill="${k.color}" dominant-baseline="hanging"${rot}${op}>${k.latex.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`;
      }
      if (el.tool === "text") {
        const t = el;
        const lines = this.wordWrapTextForSVG(t.content, t.fontSize, t.width > 1 ? t.width : 300, t.fontFamily);
        const lineHeight = t.fontSize * 1.4;
        const tspans = lines.map(
          (line, i) => `<tspan x="${t.position.x}" dy="${i === 0 ? 0 : lineHeight}">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</tspan>`
        ).join("");
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<text x="${t.position.x}" y="${t.position.y}" font-size="${t.fontSize}" font-family="${t.fontFamily}" fill="${t.color}" dominant-baseline="hanging"${rot}${op}>${tspans}</text>`;
      }
      if (el.tool === "image") {
        const img = el;
        const rot = rotation !== 0 ? ` transform="rotate(${rotation * 180 / Math.PI}, ${this.getRotationCenter(el).x}, ${this.getRotationCenter(el).y})"` : "";
        return `<image href="${img.src}" x="${img.position.x}" y="${img.position.y}" width="${img.width}" height="${img.height}"${rot}${op}/>`;
      }
      return "";
    }
    wordWrapTextForSVG(text, fontSize, maxWidth, fontFamily = "system-ui, -apple-system, sans-serif") {
      const rawLines = text.split("\n");
      const wrappedLines = [];
      const ctx = this.staticCtx;
      ctx.font = `${fontSize}px ${fontFamily}`;
      for (const rawLine of rawLines) {
        if (rawLine === "") {
          wrappedLines.push("");
          continue;
        }
        const words = rawLine.split(" ");
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine ? currentLine + " " + word : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        wrappedLines.push(currentLine);
      }
      return wrappedLines;
    }
    exportPDF() {
      const c = document.createElement("canvas");
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      const ctx = c.getContext("2d");
      ctx.scale(this.dpr, this.dpr);
      ctx.fillStyle = THEMES[this.theme].canvasBg;
      ctx.fillRect(0, 0, this.width, this.height);
      for (const el of this.elements) this.drawElement(ctx, el);
      c.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const pdfW = this.width * 0.75;
          const pdfH = this.height * 0.75;
          const pdfParts = [];
          pdfParts.push("%PDF-1.4");
          const obj = [];
          obj.push("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj");
          obj.push("2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj");
          obj.push(`3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pdfW} ${pdfH}]/Contents 4 0 R/Resources<</XObject<</Img 5 0 R>>>>>>endobj`);
          const contentStream = `q ${pdfW} 0 0 ${pdfH} 0 0 cm /Img Do Q`;
          obj.push(`4 0 obj<</Length ${contentStream.length}>>
stream
${contentStream}
endstream
endobj`);
          const dataUrl = c.toDataURL("image/jpeg", 0.92);
          const base64 = dataUrl.split(",")[1];
          obj.push(`5 0 obj<</Type/XObject/Subtype/Image/Width ${c.width}/Height ${c.height}/ColorSpace/DeviceRGB/Length ${base64.length}/Filter/DCTDecode>>
stream
${base64}
endstream
endobj`);
          let offset = 0;
          const offsets = [];
          for (const o of obj) {
            offsets.push(offset);
            offset += o.length + 1;
          }
          let pdf = obj.join("\n") + "\n";
          const xrefOffset = pdf.length;
          pdf += "xref\n";
          pdf += `0 ${obj.length + 1}
`;
          pdf += "0000000000 65535 f \n";
          for (const off of offsets) {
            pdf += String(off).padStart(10, "0") + " 00000 n \n";
          }
          pdf += "trailer\n";
          pdf += `<</Size ${obj.length + 1}/Root 1 0 R>>
`;
          pdf += "startxref\n";
          pdf += `${xrefOffset}
`;
          pdf += "%%EOF";
          const pdfBlob = new Blob([pdf], { type: "application/pdf" });
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const a = document.createElement("a");
          a.href = pdfUrl;
          a.download = "blackboard.pdf";
          a.click();
          URL.revokeObjectURL(pdfUrl);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }, "image/png");
    }
    startPresentation() {
      if (this.elements.length === 0) return;
      this.presenterMode = true;
      this.presenterStep = 0;
      this.showPresenterView();
      this.showToast("Presentation mode \u2014 use arrow keys or click to advance");
    }
    stopPresentation() {
      this.presenterMode = false;
      this.presenterStep = 0;
      if (this.presenterOverlay) {
        this.presenterOverlay.remove();
        this.presenterOverlay = null;
      }
      this.renderAll();
    }
    isPresenting() {
      return this.presenterMode;
    }
    presentNext() {
      if (!this.presenterMode) return;
      if (this.presenterStep < this.elements.length - 1) {
        this.presenterStep++;
        this.showPresenterView();
      } else {
        this.showToast("End of presentation");
      }
    }
    presentPrev() {
      if (!this.presenterMode) return;
      if (this.presenterStep > 0) {
        this.presenterStep--;
        this.showPresenterView();
      }
    }
    showPresenterView() {
      if (!this.presenterOverlay) {
        this.presenterOverlay = document.createElement("div");
        this.presenterOverlay.style.cssText = "position:fixed;inset:0;z-index:3000;background:#000;display:flex;align-items:center;justify-content:center;";
        this.presenterOverlay.addEventListener("click", (e) => {
          if (e.target === this.presenterOverlay) this.presentNext();
        });
        this.presenterOverlay.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight" || e.key === " ") this.presentNext();
          else if (e.key === "ArrowLeft") this.presentPrev();
          else if (e.key === "Escape") this.stopPresentation();
        });
        document.body.appendChild(this.presenterOverlay);
        this.presenterOverlay.tabIndex = 0;
        this.presenterOverlay.focus();
      }
      const visible = this.elements.slice(0, this.presenterStep + 1);
      const c = document.createElement("canvas");
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      c.style.cssText = "max-width:95vw;max-height:90vh;object-fit:contain;";
      const ctx = c.getContext("2d");
      ctx.scale(this.dpr, this.dpr);
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(0, 0, this.width, this.height);
      for (const el of visible) this.drawElement(ctx, el);
      this.presenterOverlay.innerHTML = "";
      this.presenterOverlay.appendChild(c);
      const counter = document.createElement("div");
      counter.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#888;font:14px system-ui;background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:8px;";
      counter.textContent = `${this.presenterStep + 1} / ${this.elements.length}`;
      this.presenterOverlay.appendChild(counter);
    }
    insertLaTeX(latex) {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const world = this.screenToWorld(centerX, centerY);
      const el = {
        id: uid(),
        tool: "katex",
        position: world,
        latex,
        fontSize: 24,
        color: this.strokeColor,
        opacity: this.strokeOpacity,
        createdAt: Date.now()
      };
      this.pushUndo();
      this.elements.push(el);
      this.katexImageCache.clear();
      this.renderAll();
      this.emit("change");
      this.showToast("LaTeX inserted \u2014 double-click to edit");
    }
    getCollabState() {
      return this.collabState;
    }
    connectCollaboration(adapter, roomId, userName) {
      this.collabAdapter = adapter;
      const userId = uid();
      const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const user = { id: userId, name: userName, color };
      adapter.connect(roomId, user);
      adapter.onElementsUpdate((elements) => {
        this.elements = elements;
        this.renderAll();
        this.emit("change");
      });
      adapter.onCursorUpdate((uid2, cursor) => {
        const u = this.collabState?.users.find((u2) => u2.id === uid2);
        if (u) this.remoteCursors.set(uid2, { user: u, cursor });
        this.flushLive();
      });
      adapter.onUserJoin((u) => {
        if (this.collabState) this.collabState.users.push(u);
        this.showToast(`${u.name} joined`);
      });
      adapter.onUserLeave((uid2) => {
        if (this.collabState) this.collabState.users = this.collabState.users.filter((u) => u.id !== uid2);
        this.remoteCursors.delete(uid2);
        this.flushLive();
      });
      this.collabState = { connected: true, roomId, users: [user], localUser: user };
      this.showToast("Connected to collaboration room");
    }
    disconnectCollaboration() {
      this.collabAdapter?.disconnect();
      this.collabAdapter = null;
      this.collabState = null;
      this.remoteCursors.clear();
      this.flushLive();
    }
    destroy() {
      this.detachEvents();
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (this.autosaveTimer) {
        clearInterval(this.autosaveTimer);
        this.autosaveTimer = null;
      }
      if (this.boundBeforeUnload) {
        window.removeEventListener("beforeunload", this.boundBeforeUnload);
        this.boundBeforeUnload = null;
      }
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
        this.toastTimeout = null;
      }
      this.dismissContextMenu();
      this.imageCache.clear();
      this.root.remove();
    }
  };
  return __toCommonJS(browser_core_exports);
})();
//# sourceMappingURL=blackboard.umd.js.map