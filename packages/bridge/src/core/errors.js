/** Error hierarchy for casuya-bridge. */

export class BridgeError extends Error {
  constructor(message, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
  }
}

export class StorageError extends BridgeError {}
export class SyncError extends BridgeError {}
export class ConflictError extends SyncError {}
export class NetworkError extends BridgeError {}
export class SecurityError extends BridgeError {}
export class ValidationError extends BridgeError {}
export class ConfigError extends BridgeError {}
export class CompressionError extends BridgeError {}
export class MigrationError extends BridgeError {}
