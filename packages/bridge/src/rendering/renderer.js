/** Renders a cached lesson package into a mount element. */

import { EVENTS } from '../core/constants.js';
import { rewriteHtmlDependencies } from './dependencies.js';
import { RENDER_STATES, RenderStateManager } from './state.js';

const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms';

export class LessonRenderer {
  constructor({ packageStore, bus, config, hooks } = {}) {
    this._packageStore = packageStore;
    this._bus = bus;
    this._config = config || {};
    this._hooks = hooks;
    this._state = new RenderStateManager(bus);
    this._mounted = null;
  }

  get state() {
    return this._state.state;
  }

  async render(slug, mountEl) {
    if (!mountEl) {
      throw new TypeError('renderLesson requires a mount element');
    }

    const payload = { slug };
    this._state.set(RENDER_STATES.LOADING, payload);
    this._bus?.emit(EVENTS.LESSON_LOADED, payload);

    try {
      const pkg = await this._packageStore?.get(slug);
      const rawHtml = pkg?.body_html;
      if (!rawHtml) {
        const err = new Error(`Lesson package '${slug}' is not cached`);
        this._fail(payload, err);
        throw err;
      }

      let html = rewriteHtmlDependencies(rawHtml, this._config.apiBaseUrl);
      if (this._hooks) {
        const ctx = await this._hooks.run('beforeRender', { slug, html, package: pkg });
        if (ctx?.html != null) html = ctx.html;
      }

      this._clear(mountEl);
      const mode = this._config.sandboxMode === 'shadow-dom' ? 'shadow-dom' : 'iframe';
      if (mode === 'shadow-dom') this._mountShadow(mountEl, html);
      else this._mountIframe(mountEl, html);

      const ready = { slug, mode };
      this._state.set(RENDER_STATES.READY, ready);
      this._bus?.emit(EVENTS.LESSON_READY, ready);
      if (this._hooks) await this._hooks.run('afterRender', ready);
      return ready;
    } catch (err) {
      if (this._state.state !== RENDER_STATES.ERROR) this._fail(payload, err);
      throw err;
    }
  }

  _fail(payload, err) {
    const errorPayload = { ...payload, error: err };
    this._state.set(RENDER_STATES.ERROR, errorPayload);
    this._bus?.emit(EVENTS.LESSON_ERROR, errorPayload);
  }

  _clear(el) {
    if (typeof el.replaceChildren === 'function') el.replaceChildren();
    else el.innerHTML = '';
    this._mounted = null;
  }

  _mountIframe(el, html) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      el.innerHTML = html;
      this._mounted = { mode: 'iframe', el };
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', IFRAME_SANDBOX);
    iframe.setAttribute('title', 'Lesson');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.srcdoc = html;
    el.appendChild(iframe);
    this._mounted = iframe;
  }

  _mountShadow(el, html) {
    if (typeof el.attachShadow === 'function') {
      const host = typeof document !== 'undefined' && document.createElement
        ? document.createElement('div')
        : el;
      const shadow = (host === el ? el : host).attachShadow({ mode: 'open' });
      shadow.innerHTML = html;
      if (host !== el) el.appendChild(host);
      this._mounted = shadow;
      return;
    }
    el.innerHTML = html;
    this._mounted = { mode: 'shadow-dom', el };
  }
}
