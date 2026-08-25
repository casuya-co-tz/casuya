export class JavaScriptEngine {
  constructor(options = {}) {
    this._options = {
      maxExecutionTime: 10000,
      maxMemory: 128 * 1024 * 1024,
      ...options
    };
    this._executionTimers = new Map();
    this._paused = false;
    this._executionCount = 0;
  }

  execute(js, sandboxWindow) {
    if (this._paused) {
      throw new Error('JavaScript execution is paused');
    }
    if (!js || typeof js !== 'string') {
      return undefined;
    }
    this._executionCount++;
    const executionId = this._executionCount;
    const timeout = setTimeout(() => {
      throw new Error(`Script execution timeout exceeded (${this._options.maxExecutionTime}ms)`);
    }, this._options.maxExecutionTime);
    this._executionTimers.set(executionId, timeout);
    try {
      const sandboxedFn = this._createSandboxedFunction(js, sandboxWindow);
      const result = sandboxedFn();
      return result;
    } catch (err) {
      throw new Error(`Script execution error: ${err.message}`);
    } finally {
      clearTimeout(timeout);
      this._executionTimers.delete(executionId);
    }
  }

  async executeAsync(js, sandboxWindow) {
    if (this._paused) {
      throw new Error('JavaScript execution is paused');
    }
    if (!js || typeof js !== 'string') {
      return undefined;
    }
    this._executionCount++;
    const executionId = this._executionCount;
    const timeout = setTimeout(() => {
      throw new Error(`Script execution timeout exceeded (${this._options.maxExecutionTime}ms)`);
    }, this._options.maxExecutionTime);
    this._executionTimers.set(executionId, timeout);
    try {
      const sandboxedFn = this._createSandboxedFunction(js, sandboxWindow);
      const result = await sandboxedFn();
      return result;
    } catch (err) {
      throw new Error(`Script execution error: ${err.message}`);
    } finally {
      clearTimeout(timeout);
      this._executionTimers.delete(executionId);
    }
  }

  evaluate(expression, sandboxWindow) {
    return this.execute(expression, sandboxWindow);
  }

  createContext(sandboxWindow) {
    const context = {};
    for (const key of Object.keys(sandboxWindow)) {
      Object.defineProperty(context, key, {
        get: () => sandboxWindow[key],
        set: (val) => { sandboxWindow[key] = val; },
        enumerable: true,
        configurable: false
      });
    }
    return context;
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
  }

  getExecutionCount() {
    return this._executionCount;
  }

  destroy() {
    for (const [id, timer] of this._executionTimers) {
      clearTimeout(timer);
    }
    this._executionTimers.clear();
    this._paused = false;
  }

  _createSandboxedFunction(js, sandboxWindow) {
    const paramNames = Object.keys(sandboxWindow);
    const paramValues = paramNames.map(k => sandboxWindow[k]);
    try {
      const fn = new Function(...paramNames, js);
      return fn.bind(null, ...paramValues);
    } catch (err) {
      return () => { throw new Error(`Failed to compile script: ${err.message}`); };
    }
  }
}
