import { ContentSecurityPolicy } from './content-security.js';
import { Sanitizer } from './sanitizer.js';
import { SignatureVerifier } from './signature-verifier.js';

export class SecurityManager {
  constructor(options = {}) {
    this._options = options;
    this._csp = new ContentSecurityPolicy(options.csp);
    this._sanitizer = new Sanitizer(options.sanitize);
    this._signatureVerifier = new SignatureVerifier(options.signatures);
    this._permissions = new Map();
  }

  validatePackage(pkg) {
    if (!pkg || !pkg.manifest) {
      throw new Error('Invalid package: missing manifest');
    }
    if (pkg.manifest.version) {
      const versionPattern = /^\d+\.\d+\.\d+$/;
      if (!versionPattern.test(pkg.manifest.version)) {
        throw new Error(`Invalid package version format: ${pkg.manifest.version}`);
      }
    }
    if (pkg.signature) {
      const valid = this._signatureVerifier.verify(pkg);
      if (!valid) {
        throw new Error('Package signature verification failed');
      }
    }
    if (pkg.manifest.permissions) {
      for (const perm of pkg.manifest.permissions) {
        this._validatePermission(perm);
      }
    }
    return true;
  }

  validatePermissionRequest(permission) {
    return this._validatePermission(permission);
  }

  _validatePermission(permission) {
    const allowed = ['storage', 'media', 'quiz', 'game', 'analytics', 'timer', 'canvas', 'audio', 'video', 'geolocation', 'microphone'];
    if (!allowed.includes(permission)) {
      throw new Error(`Permission "${permission}" is not allowed`);
    }
    return true;
  }

  sanitizeHTML(html) {
    return this._sanitizer.sanitize(html);
  }

  sanitizeCSS(css) {
    return this._sanitizer.sanitizeCSS(css);
  }

  sanitizeURL(url) {
    return this._sanitizer.sanitizeURL(url);
  }

  generateCSP(directives = {}) {
    return this._csp.generate(directives);
  }

  applyCSP(doc, directives) {
    this._csp.apply(doc, directives);
  }

  generateSandboxAttributes(permissions) {
    const defaults = ['allow-scripts', 'allow-same-origin'];
    const extras = [];
    if (permissions.includes('media') || permissions.includes('audio')) {
      extras.push('allow-scripts');
    }
    return [...defaults, ...extras].join(' ');
  }

  checkURL(url) {
    const blockedProtocols = ['file:', 'ftp:', 'javascript:', 'data:', 'vbscript:'];
    try {
      const parsed = new URL(url);
      if (blockedProtocols.includes(parsed.protocol)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  destroy() {
    this._permissions.clear();
  }
}
