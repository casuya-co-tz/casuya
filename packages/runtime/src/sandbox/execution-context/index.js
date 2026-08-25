import { deepFreeze } from '../../utilities/object-utils.js';

export class ExecutionContext {
  constructor(options = {}) {
    this._options = {
      packageId: null,
      permissions: [],
      allowedGlobals: [],
      securityPolicies: null,
      eventBus: null,
      ...options
    };
    this._window = null;
    this._variables = new Map();
    this._contextData = {
      packageId: this._options.packageId,
      runtimeVersion: '1.0.0',
      permissions: deepFreeze([...this._options.permissions]),
      startedAt: Date.now(),
      sandboxed: true
    };
    this._frozen = false;
  }

  setWindow(win) {
    this._window = win;
    if (win) {
      win.__CASUYA_CONTEXT__ = this._getContextAPI();
    }
  }

  get(key) {
    if (key === '__CASUYA_CONTEXT__') {
      return this._getContextAPI();
    }
    if (this._variables.has(key)) {
      return this._variables.get(key);
    }
    return this._contextData[key];
  }

  set(key, value) {
    if (this._frozen && key !== 'userVariables') {
      throw new Error(`Cannot set "${key}": context is frozen`);
    }
    this._variables.set(key, value);
  }

  hasPermission(permission) {
    return this._options.permissions.includes(permission);
  }

  getAllowedGlobals() {
    return [...this._options.allowedGlobals];
  }

  getContextData() {
    return { ...this._contextData };
  }

  freeze() {
    this._frozen = true;
  }

  unfreeze() {
    this._frozen = false;
  }

  isFrozen() {
    return this._frozen;
  }

  getSecurityPolicies() {
    return this._options.securityPolicies;
  }

  _getContextAPI() {
    return {
      getPackageId: () => this._options.packageId,
      getRuntimeVersion: () => '1.0.0',
      getPermissions: () => [...this._options.permissions],
      hasPermission: (perm) => this.hasPermission(perm),
      getElapsedTime: () => Date.now() - this._contextData.startedAt,
      isSandboxed: () => true,
      getVariable: (key) => this._variables.get(key),
      setVariable: (key, value) => this.set(key, value)
    };
  }

  destroy() {
    this._window = null;
    this._variables.clear();
    this._frozen = false;
  }
}
