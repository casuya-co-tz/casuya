import { readZipDirectory, readZipEntry } from './zip-reader.js';

export class PackageParser {
  constructor() {
    this._magicBytes = new Uint8Array([0x43, 0x53, 0x59, 0x50]); // CSYP
    this._supportedFormats = ['application/zip', 'application/x-casuya-package'];
    this._maxTotalBytes = 64 * 1024 * 1024;
  }

  async parse(buffer) {
    const bytes = new Uint8Array(buffer);
    if (this._isCompressedPackage(bytes)) {
      return this._parseCompressed(bytes);
    }
    return this._parseJSON(buffer);
  }

  async parseFromObject(obj) {
    if (!obj.manifest) {
      throw new Error('Invalid package object: manifest is required');
    }
    const pkg = {
      id: obj.manifest.id,
      version: obj.manifest.version,
      manifest: this._parseManifest(obj.manifest),
      resources: obj.resources || {},
      signature: obj.signature || null,
      metadata: obj.metadata || {}
    };
    return pkg;
  }

  _isCompressedPackage(bytes) {
    if (bytes.length < 4) return false;
    return bytes[0] === 0x50 && bytes[1] === 0x4B; // PK zip header
  }

  async _parseCompressed(bytes) {
    const manifestStr = await this._extractManifestFromZip(bytes);
    if (!manifestStr) {
      throw new Error('No manifest.json found in package');
    }
    const manifest = this._parseManifest(JSON.parse(manifestStr));
    const resources = await this._extractResources(bytes, manifest);
    return {
      id: manifest.id,
      version: manifest.version,
      manifest,
      resources,
      signature: resources['signature.json'] ? JSON.parse(new TextDecoder().decode(resources['signature.json'])) : null,
      metadata: manifest.metadata || {}
    };
  }

  async _parseJSON(buffer) {
    const text = new TextDecoder().decode(buffer);
    const data = JSON.parse(text);
    if (data.manifest) {
      return this.parseFromObject(data);
    }
    return this.parseFromObject({ manifest: data });
  }

  _parseManifest(data) {
    const required = ['id', 'version', 'title'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Manifest missing required field: "${field}"`);
      }
    }
    if (!/^\d+\.\d+\.\d+$/.test(data.version)) {
      throw new Error(`Invalid version format: "${data.version}". Expected semver (e.g. 1.0.0)`);
    }
    return {
      id: data.id,
      version: data.version,
      title: data.title,
      description: data.description || '',
      author: data.author || '',
      language: data.language || 'en',
      type: data.type || 'lesson',
      runtimeVersion: data.runtimeVersion || '>=1.0.0',
      permissions: data.permissions || [],
      slides: data.slides || [],
      quizzes: data.quizzes || [],
      games: data.games || [],
      assets: data.assets || [],
      dependencies: data.dependencies || [],
      metadata: data.metadata || {},
      entry: data.entry || data.start || 'index.html',
      theme: data.theme || {},
      offline: data.offline !== false
    };
  }

  async _extractManifestFromZip(bytes) {
    try {
      const entries = readZipDirectory(bytes);
      for (const entry of entries) {
        if (entry.filename === 'manifest.json' || entry.filename === 'package.json') {
          const data = await readZipEntry(bytes, entry);
          return new TextDecoder().decode(data);
        }
      }
      return null;
    } catch {
      return this._fallbackExtractManifest(bytes);
    }
  }

  _fallbackExtractManifest(bytes) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const manifestPatterns = [
      /"manifest"\s*:\s*\{/,
      /\{"id"\s*:/,
      /"id"\s*:\s*"[^"]+"\s*,\s*"version"/
    ];
    for (const pattern of manifestPatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const start = Math.max(0, match.index - 10);
          const chunk = text.substring(start, start + 65536);
          const braceMatch = chunk.match(/\{[\s\S]*\}/);
          if (braceMatch) {
            return braceMatch[0];
          }
        } catch {}
      }
    }
    return null;
  }

  async _extractResources(bytes, manifest) {
    const resources = {};
    resources['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    try {
      const entries = readZipDirectory(bytes);
      let totalBytes = 0;
      for (const entry of entries) {
        if (entry.filename === 'manifest.json') continue;
        totalBytes += entry.size;
        if (totalBytes > this._maxTotalBytes) {
          throw new Error('ZIP package exceeds size limit');
        }
        resources[entry.filename] = await readZipEntry(bytes, entry);
      }
    } catch {
      // ZIP parsing failed (corrupt archive or unsupported method).
      // No heuristic fallback: surface an empty resource set rather than
      // guessing, so corrupt packages fail loudly.
    }
    return resources;
  }
}
