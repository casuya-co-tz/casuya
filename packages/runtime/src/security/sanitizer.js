export class Sanitizer {
  constructor(options = {}) {
    this._options = {
      allowedTags: ['math', 'eq', 'chem', 'reaction', 'graph', 'physics-diagram', 'unit-conversion', 'svg', 'g', 'text', 'line', 'circle', 'rect', 'polyline', 'polygon', 'marker', 'defs', 'ellipse', 'path', 'clippath', 'lineargradient', 'radialgradient', 'a', 'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'caption', 'pre', 'code', 'blockquote', 'sub', 'sup', 'hr', 'figure', 'figcaption', 'video', 'audio', 'source', 'canvas', 'details', 'summary', 'label', 'input', 'button', 'select', 'option', 'textarea', 'progress', 'meter', 'nav', 'section', 'article', 'aside', 'header', 'footer', 'main', 'mark', 'time', 'small'],
      allowedAttributes: {
        'a': ['href', 'target', 'rel'],
        'img': ['src', 'alt', 'width', 'height', 'loading'],
        'video': ['src', 'controls', 'width', 'height', 'autoplay', 'loop', 'muted', 'poster'],
        'audio': ['src', 'controls', 'autoplay', 'loop'],
        'source': ['src', 'type'],
        'canvas': ['id', 'width', 'height'],
        'input': ['type', 'name', 'value', 'placeholder', 'disabled', 'checked', 'min', 'max', 'step'],
        'button': ['type', 'disabled'],
        'select': ['name', 'disabled'],
        'option': ['value', 'disabled', 'selected'],
        'textarea': ['name', 'rows', 'cols', 'disabled', 'placeholder'],
        'progress': ['value', 'max'],
        'meter': ['value', 'min', 'max', 'low', 'high', 'optimum'],
        'time': ['datetime'],
        'td': ['colspan', 'rowspan'],
        'th': ['colspan', 'rowspan'],
        'svg': ['width', 'height', 'viewBox', 'xmlns', 'class', 'role', 'aria-label'],
        'g': ['class', 'transform'],
        'text': ['x', 'y', 'text-anchor', 'fill', 'font-size', 'font-weight', 'transform'],
        'line': ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-dasharray', 'marker-end'],
        'circle': ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
        'rect': ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'rx', 'opacity'],
        'polyline': ['points', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin'],
        'polygon': ['points', 'fill', 'opacity'],
        'path': ['d', 'fill', 'stroke', 'stroke-width'],
        'ellipse': ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
        'marker': ['id', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient'],
        'defs': [],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      ...options
    };
    this._tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    this._attrRegex = /\s*([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    this._scriptRegex = /<script[\s\S]*?<\/script>/gi;
    this._onEventRegex = /\son\w+\s*=\s*["'][^"']*["']/gi;
    this._jsProtocolRegex = /javascript\s*:/gi;
  }

  sanitize(html) {
    if (typeof html !== 'string') return '';
    let cleaned = html;
    cleaned = cleaned.replace(this._scriptRegex, '');
    cleaned = cleaned.replace(this._onEventRegex, '');
    cleaned = cleaned.replace(this._jsProtocolRegex, 'forbidden:');
    cleaned = cleaned.replace(this._tagRegex, (match, tagName) => {
      const lowerTag = tagName.toLowerCase();
      if (!this._options.allowedTags.includes(lowerTag)) {
        return '';
      }
      return match;
    });
    cleaned = cleaned.replace(this._tagRegex, (match, tagName) => {
      const lowerTag = tagName.toLowerCase();
      if (!this._options.allowedTags.includes(lowerTag)) {
        return '';
      }
      const allowedAttrs = this._options.allowedAttributes[lowerTag] || [];
      const safeMatch = match.replace(this._attrRegex, (attrMatch, attrName, dqVal, sqVal, noQuoteVal) => {
        const lowerAttr = attrName.toLowerCase();
        if (lowerAttr.startsWith('on')) return '';
        if (!allowedAttrs.includes(lowerAttr)) return '';
        const val = dqVal !== undefined ? dqVal : (sqVal !== undefined ? sqVal : (noQuoteVal !== undefined ? noQuoteVal : ''));
        if ((lowerAttr === 'href' || lowerAttr === 'src' || lowerAttr === 'poster') && val) {
          const scheme = val.match(/^([a-zA-Z][a-zA-Z0-9]*):/);
          if (scheme && !this._options.allowedSchemes.includes(scheme[1].toLowerCase())) {
            return '';
          }
        }
        return ` ${lowerAttr}="${val}"`;
      });
      return safeMatch;
    });
    return cleaned;
  }

  sanitizeCSS(css) {
    if (typeof css !== 'string') return '';
    const dangerous = [
      /expression\s*\(/gi,
      /javascript\s*:/gi,
      /url\s*\(\s*['"]?javascript/gi,
      /behavior\s*:/gi,
      /-moz-binding\s*:/gi
    ];
    let cleaned = css;
    for (const pattern of dangerous) {
      cleaned = cleaned.replace(pattern, '');
    }
    return cleaned;
  }

  sanitizeURL(url) {
    if (typeof url !== 'string') return '';
    const dangerous = ['javascript:', 'data:', 'file:', 'vbscript:', 'ftp:'];
    for (const prefix of dangerous) {
      if (url.trim().toLowerCase().startsWith(prefix)) {
        return '';
      }
    }
    const onEvent = /^\s*on\w+\s*=/i;
    if (onEvent.test(url.trim())) {
      return '';
    }
    return url;
  }

  sanitizeFileName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\./g, '');
  }
}
