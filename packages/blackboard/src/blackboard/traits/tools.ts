import type { Tool, GraphConfig, ImageElement } from '../../types';
import { uid } from '../../utils';
import { BlackboardBase, Constructor } from '../base';

export const ToolsMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class ToolsTrait extends Base {

setTool(tool: Tool): void {
    this.commitText();
    this.activeTool = tool;
    let cursor = 'crosshair';
    if (tool === 'select') cursor = 'default';
    else if (tool === 'hand') cursor = 'grab';
    else if (tool === 'text') cursor = 'text';
    else if (tool === 'eraser') cursor = 'cell';
    else if (tool === 'highlighter') cursor = 'crosshair';
    else if (tool === 'laser') cursor = 'none';
    else if (tool === 'diamond') cursor = 'crosshair';
    this.liveCanvas.style.cursor = cursor;
    this.updateToolbar();
    this.emit('toolchange');
  }

getTool(): Tool { return this.activeTool; }

setColor(color: string): void {
    this.strokeColor = color;
    this.updateToolbar();
  }

getColor(): string { return this.strokeColor; }

setFill(enabled: boolean): void {
    this.fillEnabled = enabled;
    this.updateToolbar();
  }

getFill(): boolean { return this.fillEnabled; }

getPixelEraser(): boolean { return this.pixelEraser; }

setPixelEraser(enabled: boolean): void { this.pixelEraser = enabled; this.updateToolbar(); }

getClipboard(): string { return this.clipboardData; }

setClipboard(data: string): void { this.clipboardData = data; }

isGraphEnabled(): boolean { return this.graph.enabled; }

enableGraph(options?: Partial<GraphConfig>): void {
    this.graph = { ...this.graph, ...options, enabled: true };
    this.graphDirty = true;
    this.renderStatic();
  }

disableGraph(): void {
    this.graph.enabled = false;
    this.renderStatic();
  }

copySelected(): void {
    if (this.selectedIds.size === 0) return;
    this.clipboard = [];
    const data: any[] = [];
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (!el) continue;
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = uid();
      this.clipboard.push(clone);
      data.push(clone);
    }
    this.clipboardData = JSON.stringify(data);
    try { navigator.clipboard.writeText(this.clipboardData); } catch {}
  }

pasteClipboard(): void {
    if (this.clipboard.length === 0 && this.clipboardData) {
      try {
        const parsed = JSON.parse(this.clipboardData);
        if (Array.isArray(parsed)) {
          this.clipboard = parsed;
        }
      } catch {}
    }
    if (this.clipboard.length === 0) {
      try {
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].tool) {
              this.clipboard = parsed;
              this.pasteClipboard();
            }
          } catch {}
        }).catch(() => {});
      } catch {}
      return;
    }
    this.pushUndo();
    const newIds = new Set<string>();
    const groupMap = new Map<string, string>();
    for (const el of this.clipboard) {
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = uid();
      if (clone.groupId) {
        if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, uid());
        clone.groupId = groupMap.get(clone.groupId);
      }
      if ('start' in clone) { clone.start = { x: clone.start.x + 20, y: clone.start.y + 20 }; clone.end = { x: clone.end.x + 20, y: clone.end.y + 20 }; }
      if ('position' in clone) { clone.position = { x: clone.position.x + 20, y: clone.position.y + 20 }; }
      if ('points' in clone) { clone.points = clone.points.map((p: any) => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure })); }
      this.elements.push(clone);
      newIds.add(clone.id);
    }
    this.selectedIds = newIds;
    this.clipboard = this.clipboard.map(c => JSON.parse(JSON.stringify(c)));
    this.renderAll();
    this.emit('change');
  }

resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = window.devicePixelRatio || 1;
    this.graphDirty = true;
    this.setupCanvases();
    this.renderAll();
  }

deleteSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    for (const id of this.selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (el && el.tool === 'image') this.imageCache.delete((el as ImageElement).src);
    }
    this.elements = this.elements.filter(e => !this.selectedIds.has(e.id));
    this.selectedIds.clear();
    this.renderAll();
    this.emit('change');
  }
};