export class CanvasRenderer {
  constructor(options = {}) {
    this._options = {
      parent: null,
      ...options
    };
    this._canvases = new Map();
    this._animations = new Map();
    this._paused = false;
  }

  initialize(slideData) {
    if (!slideData?.canvas) return null;
    const { id, width, height, context } = slideData.canvas;
    const canvas = document.createElement('canvas');
    canvas.id = id || `casuya-canvas-${Date.now()}`;
    canvas.width = width || 800;
    canvas.height = height || 600;
    canvas.setAttribute('data-casuya-canvas', '');
    (this._options.parent || document.body).appendChild(canvas);
    const ctx = canvas.getContext(context || '2d');
    this._canvases.set(canvas.id, { canvas, ctx });
    return { canvas, ctx };
  }

  getCanvas(id) {
    return this._canvases.get(id) || null;
  }

  startAnimation(id, renderFn, fps = 60) {
    if (this._animations.has(id)) {
      this.stopAnimation(id);
    }
    let lastTime = performance.now();
    const interval = 1000 / fps;
    const loop = (time) => {
      if (this._paused) {
        this._animations.get(id)?.rafId || requestAnimationFrame(loop);
        return;
      }
      const delta = time - lastTime;
      if (delta >= interval) {
        const canvas = this._canvases.get(id);
        if (canvas) {
          renderFn(canvas.ctx, delta / 1000, time);
        }
        lastTime = time - (delta % interval);
      }
      const anim = this._animations.get(id);
      if (anim) {
        anim.rafId = requestAnimationFrame(loop);
      }
    };
    const rafId = requestAnimationFrame(loop);
    this._animations.set(id, { rafId, renderFn, fps });
  }

  stopAnimation(id) {
    const anim = this._animations.get(id);
    if (anim?.rafId) {
      cancelAnimationFrame(anim.rafId);
    }
    this._animations.delete(id);
  }

  pauseAll() {
    this._paused = true;
  }

  resumeAll() {
    this._paused = false;
  }

  clearCanvas(id) {
    const entry = this._canvases.get(id);
    if (entry) {
      entry.ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
    }
  }

  removeCanvas(id) {
    this.stopAnimation(id);
    const entry = this._canvases.get(id);
    if (entry) {
      entry.canvas.remove();
      this._canvases.delete(id);
    }
  }

  destroy() {
    for (const id of this._animations.keys()) {
      this.stopAnimation(id);
    }
    for (const id of this._canvases.keys()) {
      this.removeCanvas(id);
    }
  }
}
