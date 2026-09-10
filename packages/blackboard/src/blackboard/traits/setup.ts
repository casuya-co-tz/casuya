import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const SetupMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class SetupTrait extends Base {
  constructor(...args: any[]) {
    super(...args);
    const options = args[0] as BlackboardOptions;
    BlackboardBase.instanceCount++;
    this.container = options.container;
    this.autosaveKey = `casuya-blackboard-${BlackboardBase.instanceCount}`;
    this.width = options.width || this.container.clientWidth || 800;
    this.height = options.height || this.container.clientHeight || 600;
    this.dpr = window.devicePixelRatio || 1;
    this.theme = options.theme || 'light';

    injectMobileStyles();

    this.boundHandleImagePaste = this.handleImagePaste.bind(this);
    this.boundHandleDragOver = this.handleDragOver.bind(this);
    this.boundHandleFileDrop = this.handleFileDrop.bind(this);

    this.graph = {
      enabled: options.graph?.enabled ?? false,
      spacing: options.graph?.spacing ?? 25,
      color: options.graph?.color ?? '#e2e8f0',
      showAxes: options.graph?.showAxes ?? true,
      showLabels: options.graph?.showLabels ?? true,
    };
    this.strokeColor = options.color || this.strokeColor;
    this.strokeWidth = options.strokeWidth || this.strokeWidth;
    if (options.width) this.width = options.width;
    if (options.height) this.height = options.height;
    this.dpr = window.devicePixelRatio || 1;

    const mobile = IS_MOBILE();
    this.root = document.createElement('div');
    this.root.className = 'casuya-blackboard';
    this.root.style.cssText = `
      display: flex;
      flex-direction: column;
      border-radius: ${mobile ? 8 : 12}px;
      overflow: hidden;
      box-shadow: ${mobile ? '0 2px 8px rgba(0,0,0,0.06)' : '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'};
      background: ${THEMES[this.theme].canvasBg};
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      width: 100%;
      height: 100%;
      touch-action: none;
      -webkit-touch-callout: none;
    `;

    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.style.cssText = 'position: relative; overflow: hidden; flex: 1;';

    this.staticCanvas = document.createElement('canvas');
    this.liveCanvas = document.createElement('canvas');

    [this.staticCanvas, this.liveCanvas].forEach(c => {
      c.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        touch-action: none;
      `;
    });

    this.staticCanvas.style.zIndex = '0';
    this.liveCanvas.style.zIndex = '1';

    this.canvasWrapper.appendChild(this.staticCanvas);
    this.canvasWrapper.appendChild(this.liveCanvas);

    this.toolbar = createToolbar(this);
    this.root.appendChild(this.toolbar.bar);
    this.root.appendChild(this.canvasWrapper);
    this.container.appendChild(this.root);

    this.editingTextIndex = -1;

    if (!this.container.style.position) {
      this.container.style.position = 'relative';
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            this.resize(Math.floor(w), Math.floor(h));
          }
        }
      });
      this.resizeObserver.observe(this.canvasWrapper);
    }

    this.staticCtx = this.staticCanvas.getContext('2d')!;
    this.liveCtx = this.liveCanvas.getContext('2d')!;

    this.setupCanvases();
    this.attachEvents();
    this.setTool('pen');
    this.renderAll();
    this.updateToolbar();

    this.autosaveTimer = setInterval(() => {
      if (this.dirtySinceSave) {
        this.saveToStorage(this.autosaveKey);
        this.dirtySinceSave = false;
      }
    }, 30000);

    this.boundBeforeUnload = (e: BeforeUnloadEvent) => {
      if (this.dirtySinceSave) {
        this.saveToStorage(this.autosaveKey);
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    this.loadFromStorage(this.autosaveKey);

    setTimeout(() => this.showToast('Select a tool and start drawing'), 600);
  }
};
