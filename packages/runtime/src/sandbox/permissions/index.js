export class PermissionManager {
  constructor(options = {}) {
    this._options = {
      defaultPermissions: [],
      strictMode: true,
      ...options
    };
    this._permissions = new Set(this._options.defaultPermissions);
    this._requested = new Set();
    this._denied = new Set();
    this._listeners = new Map();
  }

  configure(permissions) {
    this._permissions = new Set(permissions);
    this._requested.clear();
    this._denied.clear();
  }

  hasPermission(permission) {
    if (this._denied.has(permission)) return false;
    return this._permissions.has(permission);
  }

  hasAll(permissions) {
    return permissions.every(p => this.hasPermission(p));
  }

  hasAny(permissions) {
    return permissions.some(p => this.hasPermission(p));
  }

  request(permission) {
    this._requested.add(permission);
    const allowed = this._isAllowed(permission);
    if (!allowed) {
      this._denied.add(permission);
    }
    this._emit('permission:requested', { permission, allowed });
    return allowed;
  }

  requestMultiple(permissions) {
    return permissions.map(p => this.request(p));
  }

  grant(permission) {
    this._permissions.add(permission);
    this._denied.delete(permission);
    this._emit('permission:granted', { permission });
  }

  deny(permission) {
    this._denied.add(permission);
    this._emit('permission:denied', { permission });
  }

  revoke(permission) {
    this._permissions.delete(permission);
    this._emit('permission:revoked', { permission });
  }

  getGranted() {
    return Array.from(this._permissions);
  }

  getDenied() {
    return Array.from(this._denied);
  }

  getRequested() {
    return Array.from(this._requested);
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
  }

  reset() {
    this._permissions = new Set(this._options.defaultPermissions);
    this._requested.clear();
    this._denied.clear();
  }

  destroy() {
    this._listeners.clear();
    this.reset();
  }

  _isAllowed(permission) {
    const alwaysAllowed = ['storage', 'timer', 'event'];
    const requiresConsent = ['geolocation', 'microphone', 'camera'];
    if (alwaysAllowed.includes(permission)) return true;
    if (requiresConsent.includes(permission)) return false;
    return this._options.strictMode ? false : true;
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch {}
      }
    }
  }
}
