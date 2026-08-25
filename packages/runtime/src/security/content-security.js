export class ContentSecurityPolicy {
  constructor(options = {}) {
    this._options = {
      reportOnly: false,
      reportURI: null,
      ...options
    };
    this._defaultDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'media-src': ["'self'", 'blob:'],
      'frame-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    };
  }

  generate(directives = {}) {
    const merged = { ...this._defaultDirectives };
    for (const [key, value] of Object.entries(directives)) {
      if (value === null) {
        delete merged[key];
      } else if (Array.isArray(value)) {
        merged[key] = value;
      }
    }

    const parts = [];
    for (const [key, values] of Object.entries(merged)) {
      if (values && values.length > 0) {
        parts.push(`${key} ${values.join(' ')}`);
      }
    }

    return parts.join('; ');
  }

  apply(doc, directives) {
    if (!doc || !doc.head) return;
    const policy = this.generate(directives);
    const meta = doc.createElement('meta');
    meta.httpEquiv = this._options.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    meta.content = policy;
    doc.head.appendChild(meta);
  }

  generateForSandbox(additionalPermissions = []) {
    const directives = {
      'default-src': ["'none'"],
      'script-src': ["'unsafe-inline'"],
      'style-src': ["'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'media-src': ["'self'", 'blob:'],
      'connect-src': ["'self'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"]
    };
    if (additionalPermissions.includes('canvas')) {
      directives['img-src'].push("'self'");
    }
    if (additionalPermissions.includes('audio')) {
      directives['media-src'].push('blob:');
    }
    return this.generate(directives);
  }
}
