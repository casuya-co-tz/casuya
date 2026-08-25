/** Shared constants for casuya-bridge. */

export const BRIDGE_VERSION = '0.1.0';
export const DB_NAME = 'casuya-bridge';
export const DB_VERSION = 1;

export const STORES = {
  PACKAGES: 'packages',
  ASSETS: 'assets',
  MANIFESTS: 'manifests',
  PROGRESS: 'progress',
  QUEUE: 'sync-queue',
  META: 'meta',
};

export const EVENTS = {
  PROGRESS_UPDATED: 'progress:updated',
  LESSON_COMPLETED: 'lesson:completed',
  SYNC_STARTED: 'sync:started',
  SYNC_SUCCESS: 'sync:success',
  SYNC_FAILURE: 'sync:failure',
  CONNECTIVITY_ONLINE: 'connectivity:online',
  CONNECTIVITY_OFFLINE: 'connectivity:offline',
  QUEUE_DRAINED: 'queue:drained',
  STORAGE_QUOTA_EXCEEDED: 'storage:quota_exceeded',
  CONFLICT_DETECTED: 'conflict:detected',
  NETWORK_TIER_CHANGED: 'network:tier_changed',
};

export const DEFAULT_CONFIG = {
  apiBaseUrl: '',
  dbName: DB_NAME,
  dbVersion: DB_VERSION,
  syncIntervalMs: 30_000,
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  batchSize: 20,
  encryptionKey: null,
  compressionEnabled: true,
  maxStorageBytes: 50 * 1024 * 1024,
  bridgeSharedKey: null,
};

export const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
