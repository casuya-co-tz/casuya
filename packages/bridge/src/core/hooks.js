/** Lightweight lifecycle-hook registry (beforeRender, afterRender, etc). */

export class HookRegistry {
  constructor() {
    this._hooks = new Map();
  }

  register(name, fn) {
    if (!this._hooks.has(name)) this._hooks.set(name, []);
    this._hooks.get(name).push(fn);
  }

  /** Run all hooks for `name` sequentially, awaiting async hooks, passing
   * the accumulated context through each one. */
  async run(name, context) {
    const fns = this._hooks.get(name) ?? [];
    let ctx = context;
    for (const fn of fns) {
      const result = await fn(ctx);
      if (result !== undefined) ctx = result;
    }
    return ctx;
  }

  clear(name) {
    if (name) this._hooks.delete(name);
    else this._hooks.clear();
  }
}
