/** Wires connectivity changes to sync attempts, and registers the Background
 * Sync API when available (falls back to the SyncEngine's own timer otherwise). */

import { EVENTS } from '../core/constants.js';

export function registerBackgroundSync(bus, syncEngine, { swRegistration } = {}) {
  const trigger = () => {
    syncEngine.syncNow().catch(() => {
      // SyncEngine already emits SYNC_FAILURE; nothing further to do here.
    });
  };

  bus.on(EVENTS.CONNECTIVITY_ONLINE, trigger);

  if (swRegistration?.sync) {
    swRegistration.sync.register('casuya-bridge-sync').catch(() => {
      // Background Sync registration is best-effort; the interval-based
      // SyncEngine timer remains the fallback.
    });
  }

  return () => bus.off(EVENTS.CONNECTIVITY_ONLINE, trigger);
}
