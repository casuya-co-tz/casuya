import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const UiMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class UiTrait extends Base {
findAlignmentGuides(movingBounds: { x: number; y: number; w: number; h: number }, excludeId?: string): { x?: number; y?: number } {
    const guides: { x?: number; y?: number } = {};
    const threshold = 5 / this.camera.zoom;
    const movingEdges = {
      left: movingBounds.x,
      right: movingBounds.x + movingBounds.w,
      cx: movingBounds.x + movingBounds.w / 2,
      top: movingBounds.y,
      bottom: movingBounds.y + movingBounds.h,
      cy: movingBounds.y + movingBounds.h / 2,
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
        cy: b.y + b.h / 2,
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

drawAlignmentGuides(ctx: CanvasRenderingContext2D): void {
    if (!this.alignmentGuides.x && !this.alignmentGuides.y) return;
    const vl = this.camera.x;
    const vt = this.camera.y;
    const vr = this.camera.x + this.width / this.camera.zoom;
    const vb = this.camera.y + this.height / this.camera.zoom;
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
    if (this.alignmentGuides.x !== undefined) {
      const x = this.alignmentGuides.x;
      ctx.beginPath();
      ctx.moveTo(x, vt);
      ctx.lineTo(x, vb);
      ctx.stroke();
    }
    if (this.alignmentGuides.y !== undefined) {
      const y = this.alignmentGuides.y;
      ctx.beginPath();
      ctx.moveTo(vl, y);
      ctx.lineTo(vr, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

showContextMenu(clientX: number, clientY: number): void {
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
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.style.cssText = `
      position: fixed; left: ${left}px; top: ${top}px;
      background: ${THEMES[this.theme].canvasBg}; border: 1px solid ${THEMES[this.theme].gridColor};
      border-radius: 8px; padding: 4px; z-index: 1000; min-width: ${menuW}px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: system-ui, sans-serif;
      max-height: ${vh - 16}px; overflow-y: auto;
    `;
    const items = [
      { label: 'Delete', shortcut: 'Del', action: () => this.deleteSelected(), disabled: !hasSelection },
      { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => this.duplicateSelected(), disabled: !hasSelection },
      { label: 'Group', shortcut: 'Ctrl+G', action: () => this.groupSelected(), disabled: this.selectedIds.size < 2 },
      { label: 'Ungroup', shortcut: 'Ctrl+Shift+G', action: () => this.ungroupSelected(), disabled: !hasSelection },
      { type: 'separator' as const },
      { label: 'Bring Forward', shortcut: ']', action: () => this.bringForward(), disabled: !hasOne },
      { label: 'Send Backward', shortcut: '[', action: () => this.sendBackward(), disabled: !hasOne },
      { label: 'Bring to Front', shortcut: 'Ctrl+]', action: () => this.bringToFront(), disabled: !hasOne },
      { label: 'Send to Back', shortcut: 'Ctrl+[', action: () => this.sendToBack(), disabled: !hasOne },
      { type: 'separator' as const },
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => this.selectAll(), disabled: this.elements.length === 0 },
    ];
    if (hasSelection) {
      items.push(
        { type: 'separator' as const },
        { label: 'Export Selected SVG', shortcut: '', action: () => { const svg = this.exportSelectedSVG(); const blob = new Blob([svg], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'selection.svg'; a.click(); URL.revokeObjectURL(url); }, disabled: false },
        { label: 'Export Selected PNG', shortcut: '', action: () => this.exportSelectedPNG(), disabled: false },
      );
    }
    let firstItem: HTMLButtonElement | null = null;
    for (const item of items) {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.style.cssText = `height: 1px; background: ${THEMES[this.theme].gridColor}; margin: 4px 0;`;
        menu.appendChild(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.setAttribute('role', 'menuitem');
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
        btn.addEventListener('mouseenter', () => { btn.style.background = THEMES[this.theme].gridColor; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); item.action(); this.dismissContextMenu(); });
        if (!firstItem) firstItem = btn;
      }
      btn.innerHTML = `<span>${item.label}</span><span style="font-size: 11px; opacity: 0.5;">${item.shortcut}</span>`;
      menu.appendChild(btn);
    }
    document.body.appendChild(menu);
    this.contextMenu = menu;

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > vh - 8) {
      menu.style.top = Math.max(8, vh - menuRect.height - 8) + 'px';
    }
    if (!firstItem) firstItem = menu.querySelector('button:not([disabled])') as HTMLButtonElement | null;
    if (firstItem) firstItem.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.dismissContextMenu(); return; }
      const btns = [...menu.querySelectorAll('button:not([disabled])')] as HTMLButtonElement[];
      const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(idx + 1) % btns.length]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(idx - 1 + btns.length) % btns.length]?.focus(); }
    };
    menu.addEventListener('keydown', onKey);
    this.contextMenuKeyHandler = onKey;
  }

dismissContextMenu(): void {
    if (this.contextMenu) {
      if (this.contextMenuKeyHandler) {
        this.contextMenu.removeEventListener('keydown', this.contextMenuKeyHandler);
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

updateToolbar(): void {
    updateToolbarState(this.toolbar, this.activeTool, this.strokeColor, this.strokeWidth, this.fillEnabled, this.theme, this.camera.zoom, this.fontSize, this.roughness, this.graph.enabled, this.dashEnabled, this.strokeOpacity, this.fontFamily, this.cornerRadius, this.pixelEraser);
  }

getTheme(): 'light' | 'dark' { return this.theme; }

setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.root.style.background = THEMES[this.theme].canvasBg;
    this.graphDirty = true;
    this.renderAll();
    this.updateToolbar();
  }

showShortcutHelp(): void {
    if (this.helpOverlay) { this.helpOverlay.remove(); this.helpOverlay = null; return; }
    const t = THEMES[this.theme];
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;`;
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) { overlay.remove(); this.helpOverlay = null; } });
    const panel = document.createElement('div');
    panel.style.cssText = `background:${t.canvasBg};color:${t.gridLabelColor};border:1px solid ${t.gridColor};border-radius:12px;padding:20px 24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;font-family:system-ui,sans-serif;font-size:13px;line-height:1.6;`;
    const shortcuts = [
      ['P','Pen'],['M','Highlighter'],['T','Text'],['L','Line'],['R','Rect'],['O','Circle'],['A','Arrow'],['E','Eraser'],['V','Select'],['H','Hand'],['B','Laser'],['N','Diamond'],
      ['Space+Drag','Pan'],['Esc','Deselect / Cancel'],['Del','Delete selected'],
      ['Arrow keys','Nudge (Shift=10px)'],['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],
      ['Ctrl+D','Duplicate'],['Ctrl+C','Copy'],['Ctrl+V','Paste'],['Ctrl+X','Cut'],['Ctrl+A','Select all'],
      ['Ctrl+G','Group'],['Ctrl+Shift+G','Ungroup'],['Ctrl+]','Bring forward'],['Ctrl+[','Send backward'],
      ['Shift+R','Rotate 15°'],['[/]','Width +/− (text: fontSize)'],['Ctrl+Shift+S','Export SVG'],['Ctrl+Shift+P','Export PNG'],['Ctrl+Shift+F','Apply style to selection'],['?','This help'],
    ];
    let html = `<div style="font-size:16px;font-weight:600;margin-bottom:12px;color:${t.gridAxisColor}">Keyboard Shortcuts</div>`;
    for (const [key, desc] of shortcuts) html += `<div style="display:flex;justify-content:space-between;padding:2px 0"><kbd style="background:${t.gridColor};padding:1px 6px;border-radius:4px;font-size:12px;min-width:90px;text-align:center">${key}</kbd><span>${desc}</span></div>`;
    panel.innerHTML = html;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.helpOverlay = overlay;
  }

showToast(msg: string): void {
    const existing = this.root.querySelector('.casuya-toast');
    if (existing) existing.remove();
    if (this.toastTimeout) { clearTimeout(this.toastTimeout); this.toastTimeout = null; }
    const mobile = IS_MOBILE();
    const toast = document.createElement('div');
    toast.className = 'casuya-toast';
    toast.textContent = msg;
    toast.style.cssText = `
      position: absolute; bottom: ${mobile ? 8 : 16}px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: white; padding: ${mobile ? 6 : 8}px ${mobile ? 12 : 16}px; border-radius: ${mobile ? 6 : 8}px;
      font-size: ${mobile ? 11 : 13}px; z-index: 100; pointer-events: none; white-space: nowrap;
      animation: fadeInOut 2s ease forwards;
    `;
    if (!document.getElementById('casuya-toast-keyframes')) {
      const style = document.createElement('style');
      style.id = 'casuya-toast-keyframes';
      style.textContent = `@keyframes fadeInOut { 0% { opacity: 0; transform: translateX(-50%) translateY(8px); } 15% { opacity: 1; transform: translateX(-50%) translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }`;
      document.head.appendChild(style);
    }
    this.root.appendChild(toast);
    this.toastTimeout = setTimeout(() => { toast.remove(); }, 2000);
  }

};
