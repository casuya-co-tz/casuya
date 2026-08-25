export class CSSRenderer {
  constructor(options = {}) {
    this._options = {
      security: null,
      ...options
    };
    this._styleElements = [];
  }

  inject(css, scope) {
    const style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    if (scope) {
      style.setAttribute('data-casuya-scope', scope);
      css = this._scopeCSS(css, scope);
    }
    style.textContent = this._options.security?.sanitizeCSS(css) || css;
    document.head.appendChild(style);
    this._styleElements.push(style);
    return style;
  }

  injectIntoIframe(css, iframeDoc, scope) {
    if (!iframeDoc) return;
    const style = iframeDoc.createElement('style');
    style.setAttribute('type', 'text/css');
    if (scope) {
      style.setAttribute('data-casuya-scope', scope);
      css = this._scopeCSS(css, scope);
    }
    style.textContent = css;
    iframeDoc.head.appendChild(style);
  }

  remove(scope) {
    const toRemove = [];
    for (const el of this._styleElements) {
      if (el.getAttribute('data-casuya-scope') === scope) {
        toRemove.push(el);
      }
    }
    for (const el of toRemove) {
      el.remove();
      const idx = this._styleElements.indexOf(el);
      if (idx >= 0) this._styleElements.splice(idx, 1);
    }
  }

  _scopeCSS(css, scope) {
    return css.replace(/([^\s{;,]+)\s*\{/g, (match, selector) => {
      if (selector.startsWith('@') || selector.startsWith(':')) return match;
      return `[data-casuya-scope="${scope}"] ${selector} {`;
    });
  }

  destroy() {
    for (const el of this._styleElements) {
      el.remove();
    }
    this._styleElements = [];
  }
}
