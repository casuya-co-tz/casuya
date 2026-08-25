import { PackageParser } from './parser.js';
import { PackageValidator } from './validator.js';
import { DependencyResolver } from './resolver.js';

export class PackageLoader {
  constructor(options = {}) {
    this._options = {
      cache: null,
      security: null,
      eventBus: null,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };
    this._parser = new PackageParser();
    this._validator = new PackageValidator({ security: options.security });
    this._resolver = new DependencyResolver({ loader: this });
    this._loadedPackages = new Map();
  }

  async load(source) {
    if (typeof source === 'string') {
      return this._loadFromURL(source);
    }
    if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
      return this._loadFromBuffer(source);
    }
    if (source && source.manifest) {
      return this._loadFromObject(source);
    }
    if (source && source.blob) {
      return this._loadFromBlob(source.blob);
    }
    throw new Error(`Unsupported package source type: ${typeof source}`);
  }

  async _loadFromURL(url) {
    const cacheKey = `package:url:${url}`;
    const cached = this._options.cache?.getValue('packages', cacheKey);
    if (cached) {
      this._options.eventBus?.emit('package:cacheHit', { url });
      return cached;
    }

    this._options.eventBus?.emit('package:loading', { url, source: 'url' });
    const response = await this._fetchWithRetry(url);
    const buffer = await response.arrayBuffer();
    const pkg = await this._loadFromBuffer(buffer);
    this._options.cache?.set('packages', cacheKey, pkg);
    this._loadedPackages.set(pkg.id || url, pkg);
    return pkg;
  }

  async _loadFromBuffer(buffer) {
    const pkg = await this._parser.parse(buffer);
    await this._validator.validate(pkg);
    await this._resolver.resolve(pkg, this._loadedPackages);
    this._loadedPackages.set(pkg.id || pkg.manifest?.id, pkg);
    this._options.eventBus?.emit('package:loaded', { package: pkg });
    return pkg;
  }

  async _loadFromBlob(blob) {
    const buffer = await blob.arrayBuffer();
    return this._loadFromBuffer(buffer);
  }

  async _loadFromObject(obj) {
    const pkg = await this._parser.parseFromObject(obj);
    await this._validator.validate(pkg);
    this._loadedPackages.set(pkg.id || pkg.manifest?.id, pkg);
    this._options.eventBus?.emit('package:loaded', { package: pkg });
    return pkg;
  }

  async _fetchWithRetry(url, retries = this._options.maxRetries) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      } catch (err) {
        lastError = err;
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, this._options.retryDelay * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }

  getLoadedPackage(id) {
    return this._loadedPackages.get(id) || null;
  }

  getLoadedPackages() {
    return Array.from(this._loadedPackages.values());
  }

  unload(id) {
    this._loadedPackages.delete(id);
  }

  clear() {
    this._loadedPackages.clear();
  }

  destroy() {
    this.clear();
  }
}
