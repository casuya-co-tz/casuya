import type { Shape, LaTeXElement, TextElement, ImageElement } from '../../types';
import { IS_MOBILE, uid } from '../../utils';
import { THEMES } from '../../theme';
import { BlackboardBase, Constructor } from '../base';

export const ToolsDefsMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class ToolsDefsTrait extends Base {
startTextEdit(worldX: number, worldY: number, existing?: TextElement): void {
    this.commitText();
    this.editingTextOriginal = existing ? JSON.parse(JSON.stringify(existing)) : null;
    const screen = this.worldToScreen(worldX, worldY);
    const ta = document.createElement('textarea');
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
    ta.value = existing?.content ?? '';
    ta.addEventListener('blur', () => this.commitText());
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        this.cancelText();
        return;
      }
      ev.stopPropagation();
    });
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      ta.style.width = Math.max(60, ta.scrollWidth + 10) + 'px';
      this.renderTextPreview(ta.value, worldX, worldY, fontSize, existing?.fontFamily ?? this.fontFamily, existing?.color ?? this.strokeColor);
    });
    this.canvasWrapper.appendChild(ta);
    this.textInput = ta;
    this.editingTextId = existing?.id ?? null;
    this.editingTextIndex = existing ? this.elements.findIndex(e => e.id === existing.id) : -1;
    if (existing) {
      this.elements = this.elements.filter(e => e.id !== existing.id);
      this.renderStatic();
    } else {
      this.pushUndo();
    }
    setTimeout(() => { ta.focus(); ta.style.height = ta.scrollHeight + 'px'; this.renderTextPreview(ta.value, worldX, worldY, fontSize, existing?.fontFamily ?? this.fontFamily, existing?.color ?? this.strokeColor); }, 0);
  }

cancelText(): void {
    if (!this.textInput) return;
    const ta = this.textInput;
    this.textInput = null;
    ta.remove();
    this.flushLive();
    if (this.editingTextOriginal) {
      this.elements.push(this.editingTextOriginal);
      this.renderStatic();
      this.emit('change');
    }
    this.editingTextId = null;
    this.editingTextOriginal = null;
    this.editingShapeId = null;
  }

commitText(): void {
    if (!this.textInput) return;
    const ta = this.textInput;
    const content = ta.value.trim();
    const orig = this.editingTextOriginal;
    const shapeId = this.editingShapeId;
    const index = this.editingTextIndex;
    this.textInput = null;
    ta.remove();
    this.editingTextOriginal = null;
    this.editingShapeId = null;
    this.editingTextIndex = -1;
    this.flushLive();
    if (content) {
      const screenX = parseFloat(ta.style.left);
      const screenY = parseFloat(ta.style.top);
      const world = this.screenToWorld(screenX, screenY);
      const el: TextElement = {
        id: this.editingTextId ?? uid(),
        tool: 'text',
        position: world,
        content,
        fontSize: orig?.fontSize ?? this.fontSize,
        fontFamily: orig?.fontFamily ?? this.fontFamily,
        color: orig?.color ?? ta.style.color,
        width: orig?.width ?? 1,
        opacity: orig?.opacity ?? this.strokeOpacity,
      };
      if (index < 0) {
        this.pushUndo();
      }
      if (index >= 0) {
        this.elements.splice(index, 0, el);
      } else {
        this.elements.push(el);
      }
      if (shapeId) {
        const shape = this.elements.find(e => e.id === shapeId) as Shape | undefined;
        if (shape) shape.label = content;
      }
      this.renderStatic();
      this.emit('change');
    }
    this.editingTextId = null;
  }

wordWrapTextForSVG(text: string, fontSize: number, maxWidth: number, fontFamily = 'system-ui, -apple-system, sans-serif'): string[] {
    const rawLines = text.split('\n');
    const wrappedLines: string[] = [];
    const ctx = this.staticCtx;
    ctx.font = `${fontSize}px ${fontFamily}`;
    for (const rawLine of rawLines) {
      if (rawLine === '') { wrappedLines.push(''); continue; }
      const words = rawLine.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
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

insertLaTeX(latex: string): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const world = this.screenToWorld(centerX, centerY);
    const el: LaTeXElement = {
      id: uid(),
      tool: 'katex',
      position: world,
      latex,
      fontSize: 24,
      color: this.strokeColor,
      opacity: this.strokeOpacity,
      createdAt: Date.now(),
    };
    this.pushUndo();
    this.elements.push(el);
    this.katexImageCache.clear();
    this.renderAll();
    this.emit('change');
    this.showToast('LaTeX inserted — double-click to edit');
  }

handleImagePaste(e: ClipboardEvent): void {
    if (this.textInput) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const world = this.screenToWorld(centerX, centerY);
            const el: ImageElement = {
              id: uid(),
              tool: 'image',
              position: { x: world.x - img.width / 2, y: world.y - img.height / 2 },
              width: img.width,
              height: img.height,
              src,
              opacity: 1,
            };
            this.pushUndo();
            this.elements.push(el);
            this.renderAll();
            this.emit('change');
          };
          img.src = src;
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  }
};