export class SecurityPolicies {
  constructor(options = {}) {
    this._options = {
      security: null,
      ...options
    };
    this._policies = [];
    this._active = true;
  }

  addPolicy(policy) {
    this._policies.push(policy);
  }

  checkAccess(property, context) {
    if (!this._active) return true;
    const blocked = [
      'constructor', '__proto__', '__defineGetter__', '__defineSetter__',
      '__lookupGetter__', '__lookupSetter__', 'caller', 'callee', 'arguments'
    ];
    if (blocked.includes(property)) {
      return false;
    }
    for (const policy of this._policies) {
      if (!policy(property, context)) {
        return false;
      }
    }
    return true;
  }

  checkAPI(apiName, method) {
    if (!this._active) return true;
    const blockedAPIs = [
      'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
      'Worker', 'SharedWorker', 'ServiceWorker',
      'localStorage', 'sessionStorage', 'indexedDB',
      'openDatabase', 'webkitStorageInfo',
      'Notification', 'PushManager',
      'USB', 'Bluetooth', 'Serial', 'HID',
      'clipboard', 'credentials', 'networkInformation',
      'geolocation', 'getUserMedia'
    ];
    if (blockedAPIs.includes(apiName)) {
      return false;
    }
    return true;
  }

  validateResourceAccess(url) {
    if (!this._active) return true;
    if (this._options.security) {
      return this._options.security.checkURL(url);
    }
    const blocked = ['file:', 'ftp:', 'javascript:', 'data:'];
    try {
      const parsed = new URL(url);
      if (blocked.includes(parsed.protocol)) return false;
      return true;
    } catch {
      return false;
    }
  }

  setActive(active) {
    this._active = active;
  }

  getPolicies() {
    return [...this._policies];
  }

  clearPolicies() {
    this._policies = [];
  }

  destroy() {
    this.clearPolicies();
    this._active = false;
  }

  static defaultPolicies() {
    return [
      (prop) => !prop.startsWith('__'),
      (prop) => prop !== 'eval' && prop !== 'Function',
      (prop) => prop !== 'fetch' && prop !== 'XMLHttpRequest'
    ];
  }
}
