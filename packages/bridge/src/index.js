/** casuya-bridge — offline-first student runtime and synchronization engine
 * for Casuya's compiled HTML lessons. */

export { CasuyaBridge } from './core/bridge.js';
export { createRuntime } from './core/runtime.js';
export { resolveConfig } from './core/config.js';
export { EventBus } from './core/events.js';
export { EVENTS, STORES, BRIDGE_VERSION, DEFAULT_CONFIG } from './core/constants.js';
export * from './core/errors.js';

export { createStore, MemoryStore, IndexedDBStore } from './storage/indexeddb.js';
export { createEncryption } from './storage/encryption.js';
export { ManifestStore } from './storage/manifests.js';
export { PackageStore } from './storage/packages.js';
export { AssetStore } from './storage/assets.js';
export { CacheFirstReader } from './storage/cache.js';
export { getItem, setItem, removeItem, clearAll } from './storage/localstorage.js';

export { SyncQueue } from './sync/queue.js';
export { SyncEngine } from './sync/sync-engine.js';
export { ConflictResolver, CONFLICT_STRATEGIES } from './sync/conflicts.js';
export { toBatches } from './sync/batch.js';
export { backoffDelayMs, shouldRetry } from './sync/retry.js';
export { uploadBatch } from './sync/uploads.js';
export { downloadManifests, downloadPackage } from './sync/downloads.js';

export { ProgressTracker } from './progress/tracker.js';
export { LessonSession } from './progress/sessions.js';
export { computeCompletion } from './progress/completion.js';
export { computeScore, letterGrade } from './progress/scores.js';
export { summarizeSessions } from './progress/analytics.js';

export { ConnectivityMonitor } from './network/connectivity.js';
export { NetworkRecovery } from './network/recovery.js';
export { Heartbeat } from './network/heartbeat.js';
export { NetworkTierDetector, NETWORK_TIERS } from './network/network-tier.js';
export { AdaptiveLoader } from './network/adaptive-loader.js';
export { downloadManifestsTiered, downloadPackageTiered, downloadAssetTiered } from './network/tiered-downloads.js';
export { fetchWithTimeout } from './network/fetcher.js';
export { normalizeResponse } from './network/responses.js';
export { buildJsonRequest } from './network/requests.js';

export { signPayload, verifySignature, verifyOrThrow } from './security/signatures.js';
export { sha256Hex, verifyContentHash, verifyContentHashOrThrow } from './security/integrity.js';
export { validatePackageShape, validatePackageShapeOrThrow } from './security/validation.js';
export { stripScripts, stripAllTags, toPlainTextSnippet } from './security/sanitization.js';

export { AnalyticsCollector } from './analytics/collectors/index.js';
export { AnalyticsAggregator } from './analytics/aggregators/index.js';
export { uploadAnalytics } from './analytics/uploaders/index.js';

export { compress, decompress } from './compression/index.js';
export { MigrationEngine } from './migrations/index.js';

export { uuid } from './utils/uuid.js';
export { createLogger } from './utils/logger.js';
export { debounce, throttle, sleep, chunk, deepMerge, isPlainObject } from './utils/helpers.js';
export { serialize, deserialize, clone } from './utils/serializer.js';
export { parseLessonMeta, parseQueryParams } from './utils/parser.js';