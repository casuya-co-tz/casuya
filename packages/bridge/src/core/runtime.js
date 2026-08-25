/** Wires up all subsystems (storage, sync, progress, connectivity,
 * network recovery) into a single running instance. */

import { resolveConfig } from './config.js';
import { EventBus } from './events.js';
import { HookRegistry } from './hooks.js';
import { createStore } from '../storage/indexeddb.js';
import { createEncryption } from '../storage/encryption.js';
import { ManifestStore } from '../storage/manifests.js';
import { PackageStore } from '../storage/packages.js';
import { AssetStore } from '../storage/assets.js';
import { SyncQueue } from '../sync/queue.js';
import { SyncEngine } from '../sync/sync-engine.js';
import { ConflictResolver } from '../sync/conflicts.js';
import { registerBackgroundSync } from '../sync/background-sync.js';
import { ConnectivityMonitor } from '../network/connectivity.js';
import { NetworkRecovery } from '../network/recovery.js';
import { ProgressTracker } from '../progress/tracker.js';

export function createRuntime(overrides = {}) {
  const config = resolveConfig(overrides);
  const bus = new EventBus();
  const hooks = new HookRegistry();

  const db = createStore(config.dbName, config.dbVersion);
  const encryption = createEncryption(config.encryptionKey);
  const manifestStore = new ManifestStore(db);
  const packageStore = new PackageStore(db);
  const assetStore = new AssetStore(db);
  const queue = new SyncQueue(db);
  const conflictResolver = new ConflictResolver();

  const connectivity = new ConnectivityMonitor(bus);
  const recovery = new NetworkRecovery({ bus, config });
  const syncEngine = new SyncEngine({ bus, queue, manifestStore, packageStore, config });
  const progress = new ProgressTracker({ db, bus, queue });

  let unregisterBackgroundSync = null;

  return {
    config,
    bus,
    hooks,
    db,
    encryption,
    manifestStore,
    packageStore,
    assetStore,
    queue,
    conflictResolver,
    connectivity,
    recovery,
    syncEngine,
    progress,

    start() {
      connectivity.start();
      recovery.start();
      syncEngine.start();
      unregisterBackgroundSync = registerBackgroundSync(bus, syncEngine);
    },

    stop() {
      connectivity.stop();
      recovery.stop();
      syncEngine.stop();
      unregisterBackgroundSync?.();
    },
  };
}