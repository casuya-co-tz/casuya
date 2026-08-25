/** Storage of lesson manifests (metadata describing each downloaded package). */

import { STORES } from '../core/constants.js';

export class ManifestStore {
  constructor(db) {
    this._db = db;
  }

  async save(slug, manifest) {
    return this._db.put(STORES.MANIFESTS, slug, manifest);
  }

  async get(slug) {
    return this._db.get(STORES.MANIFESTS, slug);
  }

  async has(slug) {
    return (await this.get(slug)) !== null;
  }

  async list() {
    return this._db.values(STORES.MANIFESTS);
  }

  async remove(slug) {
    return this._db.delete(STORES.MANIFESTS, slug);
  }

  /** Returns manifests whose content_hash differs from what's stored,
   * i.e. lessons that need re-downloading. */
  async findStale(remoteManifests) {
    const stale = [];
    for (const remote of remoteManifests) {
      const local = await this.get(remote.metadata?.slug ?? remote.slug);
      if (!local || local.content_hash !== remote.content_hash) {
        stale.push(remote);
      }
    }
    return stale;
  }
}
