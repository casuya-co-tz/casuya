export class HTMLRenderer {
  constructor(options = {}) {
    this._options = {
      parent: null,
      sanitizer: null,
      ...options
    };
    this._elements = [];
  }

  render(html, container) {
    const target = container || this._options.parent;
    if (!target) throw new Error('HTMLRenderer requires a container');
    const sanitized = this._options.sanitizer?.sanitize(html) || html;
    target.innerHTML = sanitized;
    return target;
  }

  append(html, container) {
    const target = container || this._options.parent;
    if (!target) return;
    const temp = document.createElement('div');
    temp.innerHTML = this._options.sanitizer?.sanitize(html) || html;
    while (temp.firstChild) {
      target.appendChild(temp.firstChild);
    }
  }

  injectScript(js, container) {
    const target = container || this._options.parent;
    if (!target) return;
    const script = document.createElement('script');
    script.textContent = js;
    script.setAttribute('data-casuya-injected', '');
    target.appendChild(script);
  }

  destroy() {
    this._elements = [];
  }
}
