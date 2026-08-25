import { HTMLRenderer } from './html-renderer/index.js';
import { CSSRenderer } from './css-renderer/index.js';
import { CanvasRenderer } from './canvas-renderer/index.js';
import { MediaRenderer } from './media-renderer/index.js';
import { isLowEndDevice } from '../utilities/device-detect.js';

export class Renderer {
  constructor(options = {}) {
    this._options = {
      container: null,
      sandbox: null,
      security: null,
      eventBus: null,
      monitor: null,
      iframeAttributes: {
        sandbox: 'allow-scripts allow-same-origin',
        loading: 'lazy'
      },
      lowEndOptimizations: true,
      ...options
    };
    this._container = this._options.container;
    this._iframe = null;
    this._initialized = false;
    this._paused = false;
    this._subRenderers = {};
    this._isLowEnd = isLowEndDevice();
  }

  initialize() {
    if (this._initialized) return;
    if (!this._container) {
      throw new Error('Renderer requires a container element');
    }
    this._container.style.position = 'relative';
    this._container.style.overflow = 'hidden';
    this._container.style.width = '100%';
    this._container.style.height = '100%';
    this._container.setAttribute('data-casuya-runtime', '');

    this._subRenderers.html = new HTMLRenderer({ parent: this._container });
    this._subRenderers.css = new CSSRenderer({ security: this._options.security });
    this._subRenderers.canvas = new CanvasRenderer({ parent: this._container });
    this._subRenderers.media = new MediaRenderer({ parent: this._container });

    this._initialized = true;
    this._options.eventBus?.emit('renderer:initialized', {});
  }

  render(pkg, session) {
    if (!this._initialized) {
      this.initialize();
    }
    this._options.monitor?.startMark('render');

    const entryFile = pkg.manifest?.entry || 'index.html';
    const htmlContent = this._getResourceContent(pkg.resources, entryFile);

    if (htmlContent) {
      this._renderHTMLContent(htmlContent, pkg);
    }

    const styles = this._collectStyles(pkg);
    if (styles.length > 0) {
      for (const css of styles) {
        this._subRenderers.css.inject(css, pkg.manifest?.id);
      }
    }

    this._renderCanvasElements(pkg);
    this._renderMediaElements(pkg);

    this._options.monitor?.endMark('render');
    this._options.eventBus?.emit('renderer:rendered', {
      package: pkg.manifest?.id,
      entry: entryFile
    });
  }

  _renderHTMLContent(html, pkg) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', this._options.iframeAttributes.sandbox);
    iframe.setAttribute('loading', this._options.iframeAttributes.loading || 'lazy');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';

    if (this._isLowEnd) {
      iframe.setAttribute('importance', 'low');
    }

    this._options.security?.applyCSP(iframe.contentDocument || iframe.contentWindow?.document, {
      'default-src': ["'none'"],
      'script-src': ["'unsafe-inline'"],
      'style-src': ["'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'media-src': ["'self'", 'blob:'],
      'connect-src': ["'self'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"]
    });

    this._container.innerHTML = '';
    this._container.appendChild(iframe);

    iframe.onload = () => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        this._options.eventBus?.emit('renderer:iframeLoaded', {});
      }
    };

    this._iframe = iframe;
  }

  _collectStyles(pkg) {
    const styles = [];
    const manifest = pkg.manifest || {};
    const theme = manifest.theme || {};
    if (theme.styles) {
      styles.push(...theme.styles);
    }
    if (manifest.assets) {
      for (const asset of manifest.assets) {
        if (asset.type === 'css' && asset.src && pkg.resources?.[asset.src]) {
          const content = new TextDecoder().decode(pkg.resources[asset.src]);
          styles.push(content);
        }
      }
    }
    return styles;
  }

  _renderCanvasElements(pkg) {
    const slides = pkg.manifest?.slides || [];
    for (const slide of slides) {
      if (slide.type === 'canvas' || (slide.content && slide.content.includes('<canvas'))) {
        this._subRenderers.canvas.initialize(slide);
      }
    }
  }

  _renderMediaElements(pkg) {
    const assets = pkg.manifest?.assets || [];
    for (const asset of assets) {
      if (asset.type === 'mp3' || asset.type === 'mp4' || asset.type === 'webm' || asset.type === 'ogg') {
        const bytes = pkg.resources?.[asset.src];
        if (bytes) {
          this._subRenderers.media.preload(asset.src, bytes, asset.type);
        }
      }
    }
  }

  _getResourceContent(resources, path) {
    if (!resources || !path) return null;
    if (resources[path]) {
      return new TextDecoder().decode(resources[path]);
    }
    for (const [key, value] of Object.entries(resources)) {
      if (key.endsWith('/' + path) || key.endsWith('\\' + path)) {
        return new TextDecoder().decode(value);
      }
    }
    return null;
  }

  getIframe() {
    return this._iframe;
  }

  getFrameWindow() {
    return this._iframe?.contentWindow || null;
  }

  getFrameDocument() {
    return this._iframe?.contentDocument || this._iframe?.contentWindow?.document || null;
  }

  pause() {
    this._paused = true;
    this._subRenderers.media?.pauseAll();
    this._subRenderers.canvas?.pauseAll();
  }

  resume() {
    this._paused = false;
    this._subRenderers.media?.resumeAll();
    this._subRenderers.canvas?.resumeAll();
  }

  destroy() {
    if (this._iframe) {
      this._iframe.src = 'about:blank';
      this._iframe.remove();
      this._iframe = null;
    }
    for (const key of Object.keys(this._subRenderers)) {
      this._subRenderers[key]?.destroy?.();
    }
    this._subRenderers = {};
    if (this._container) {
      this._container.innerHTML = '';
    }
    this._initialized = false;
  }

  resize() {
    if (this._iframe) {
      this._iframe.style.width = '100%';
      this._iframe.style.height = '100%';
    }
  }
}
