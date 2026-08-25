export class DependencyResolver {
  constructor(options = {}) {
    this._options = {
      loader: null,
      maxDepth: 5,
      ...options
    };
  }

  async resolve(pkg, loadedPackages) {
    const deps = pkg.manifest?.dependencies;
    if (!deps || deps.length === 0) {
      pkg.resolvedDependencies = {};
      return;
    }

    this._checkCircular(pkg, loadedPackages);
    const resolved = {};

    for (const dep of deps) {
      const existing = loadedPackages?.get(dep.id);
      if (existing) {
        if (!this._satisfies(existing.version, dep.version)) {
          throw new Error(
            `Dependency "${dep.id}@${dep.version}" required, but loaded version is ${existing.version}`
          );
        }
        resolved[dep.id] = existing;
        continue;
      }

      if (dep.url) {
        const loaded = await this._options.loader.load(dep.url);
        resolved[dep.id] = loaded;
      } else if (dep.bundled && pkg.resources) {
        const resourceKey = `dependencies/${dep.id}/manifest.json`;
        const resourceBytes = pkg.resources[resourceKey] || pkg.resources[`deps/${dep.id}/manifest.json`];
        if (resourceBytes) {
          const manifestStr = new TextDecoder().decode(resourceBytes);
          const bundledPkg = {
            manifest: JSON.parse(manifestStr),
            resources: this._extractBundledResources(pkg.resources, dep.id)
          };
          resolved[dep.id] = bundledPkg;
        } else {
          throw new Error(`Bundled dependency "${dep.id}" not found in package resources`);
        }
      } else {
        throw new Error(`Cannot resolve dependency "${dep.id}": no URL and not bundled`);
      }
    }

    pkg.resolvedDependencies = resolved;
  }

  _checkCircular(pkg, loadedPackages) {
    if (!loadedPackages) return;
    const deps = pkg.manifest?.dependencies || [];
    for (const dep of deps) {
      if (dep.id === pkg.manifest?.id) {
        throw new Error(`Circular dependency detected: package "${pkg.manifest.id}" depends on itself`);
      }
      if (loadedPackages.has(dep.id)) {
        const loaded = loadedPackages.get(dep.id);
        const loadedDeps = loaded.manifest?.dependencies || [];
        if (loadedDeps.some(d => d.id === pkg.manifest?.id)) {
          throw new Error(`Circular dependency detected between "${pkg.manifest.id}" and "${dep.id}"`);
        }
      }
    }
  }

  _satisfies(version, range) {
    if (range === '*' || range === 'x') return true;
    const cmp = this._compareSemver(version, range.replace(/^[><=!~^]+/, ''));
    const op = range.match(/^([<>=!~^]+)/)?.[1] || '=';
    switch (op) {
      case '>=': return cmp >= 0;
      case '<=': return cmp <= 0;
      case '>': return cmp > 0;
      case '<': return cmp < 0;
      case '~': return this._compareSemver(version.split('.').slice(0, 2).join('.'), range.replace('~', '').split('.').slice(0, 2).join('.')) === 0;
      case '^': return version.split('.')[0] === range.replace('^', '').split('.')[0] && cmp >= 0;
      case '=':
      default: return cmp === 0;
    }
  }

  _compareSemver(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  _extractBundledResources(resources, depId) {
    const depResources = {};
    const prefixes = [`dependencies/${depId}/`, `deps/${depId}/`];
    for (const [key, value] of Object.entries(resources)) {
      for (const prefix of prefixes) {
        if (key.startsWith(prefix)) {
          depResources[key.substring(prefix.length)] = value;
          break;
        }
      }
    }
    return depResources;
  }
}
