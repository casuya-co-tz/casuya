/** Storage of full lesson packages (compiled HTML + assets). */

import { STORES } from '../core/constants.js';

export class PackageStore {
  constructor(db) {
    this._db = db;
  }

  async save(slug, packageData) {
    return this._db.put(STORES.PACKAGES, slug, packageData);
  }

  async get(slug) {
    return this._db.get(STORES.PACKAGES, slug);
  }

  async has(slug) {
    return (await this.get(slug)) !== null;
  }

  async remove(slug) {
    return this._db.delete(STORES.PACKAGES, slug);
  }

  async list() {
    return this._db.keys(STORES.PACKAGES);
  }

  async sizeEstimateBytes() {
    const packages = await this._db.values(STORES.PACKAGES);
    return packages.reduce((total, pkg) => {
      const body = pkg?.body_html ?? '';
      return total + new TextEncoder().encode(body).length;
    }, 0);
  }
}
