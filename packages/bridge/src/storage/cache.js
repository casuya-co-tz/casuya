/** Cache-first read-through helper composing PackageStore/AssetStore with a
 * network fetcher, mirroring the service-worker cache-first strategy. */

export class CacheFirstReader {
  constructor({ store, fetcher, keyFn = (k) => k }) {
    this._store = store;
    this._fetcher = fetcher;
    this._keyFn = keyFn;
  }

  async read(identifier) {
    const key = this._keyFn(identifier);
    const cached = await this._store.get(key);
    if (cached !== null && cached !== undefined) {
      return { value: cached, source: 'cache' };
    }
    const fresh = await this._fetcher(identifier);
    await this._store.save(key, fresh);
    return { value: fresh, source: 'network' };
  }
}
