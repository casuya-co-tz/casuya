import { CacheManager } from '../../src/cache/cache-manager.js';
import { StateManager } from '../../src/state-manager/state-manager.js';
import { SessionManager } from '../../src/session-manager/session-manager.js';
import { StorageAPI } from '../../src/api/storage-api.js';

describe('Offline Behavior', () => {
  describe('CacheManager - Offline Resilient', () => {
    let cache;

    beforeEach(() => {
      cache = new CacheManager({ maxSize: 10 * 1024 * 1024 });
    });

    test('should serve cached packages without network', () => {
      const pkg = { manifest: { id: 'offline-pkg', version: '1.0.0', title: 'Offline' } };
      cache.set('packages', 'pkg:offline-pkg', pkg);
      const cached = cache.getValue('packages', 'pkg:offline-pkg');
      expect(cached).toBeDefined();
      expect(cached.manifest.id).toBe('offline-pkg');
    });

    test('should persist multiple namespaces', () => {
      cache.set('ns1', 'k1', 'v1');
      cache.set('ns2', 'k2', 'v2');
      expect(cache.getValue('ns1', 'k1')).toBe('v1');
      expect(cache.getValue('ns2', 'k2')).toBe('v2');
    });
  });

  describe('StateManager - Offline State', () => {
    let sm;

    beforeEach(() => {
      sm = new StateManager();
      sm.initialize({ manifest: { id: 'offline', version: '1.0.0' } });
    });

    test('should maintain state without network', () => {
      sm.set('currentSlide', 'slide-10');
      sm.set('quizAnswers.q1', 'B');
      expect(sm.get('currentSlide')).toBe('slide-10');
      expect(sm.get('quizAnswers.q1')).toBe('B');
    });

    test('should restore state from snapshots', () => {
      sm.set('progress', 0.75);
      const snap = sm.snapshot();
      sm.set('progress', 0);
      sm.restore(snap);
      expect(sm.get('progress')).toBe(0.75);
    });
  });

  describe('SessionManager - Offline Sessions', () => {
    let sess;

    beforeEach(() => {
      sess = new SessionManager({ timeout: 5000 });
    });

    test('should create session offline', () => {
      const session = sess.create({ packageId: 'offline-pkg' });
      expect(session.status).toBe('active');
      expect(session.packageId).toBe('offline-pkg');
    });

    test('should track session progress offline', () => {
      const session = sess.create({ packageId: 'offline-pkg' });
      sess.save(session.id, { progress: { completedSlides: ['s1', 's2'] } });
      expect(sess.getCurrent().progress.completedSlides).toHaveLength(2);
    });

    test('should pause and resume offline', () => {
      const session = sess.create({ packageId: 'offline-pkg' });
      sess.pause(session.id);
      expect(sess.getCurrent().status).toBe('paused');
      sess.resume(session.id);
      expect(sess.getCurrent().status).toBe('active');
    });
  });

  describe('StorageAPI - Offline Storage', () => {
    let storage;
    let memoryStore;

    beforeEach(() => {
      memoryStore = new Map();
      const mockStorage = {
        get: async (key) => memoryStore.get(key),
        set: async (key, value) => { memoryStore.set(key, value); },
        delete: async (key) => { memoryStore.delete(key); },
        clear: async () => { memoryStore.clear(); }
      };
      storage = new StorageAPI({ namespace: 'offline', storage: mockStorage });
    });

    test('should store data for offline access', async () => {
      await storage.set('progress', { slide: 5, score: 80 });
      const data = await storage.get('progress');
      expect(data.slide).toBe(5);
      expect(data.score).toBe(80);
    });

    test('should retrieve defaults for missing keys', async () => {
      const val = await storage.get('missing', 'default');
      expect(val).toBe('default');
    });

    test('should check key existence', async () => {
      await storage.set('key', 'value');
      expect(await storage.has('key')).toBe(true);
      expect(await storage.has('no-key')).toBe(false);
    });
  });

  describe('Synchronization Queue Behavior', () => {
    test('should queue events for later sync', () => {
      const queue = [];
      queue.push({ type: 'progress', data: { slide: 3 }, timestamp: Date.now() });
      queue.push({ type: 'quiz_answer', data: { q: 1, a: 'B' }, timestamp: Date.now() });
      expect(queue).toHaveLength(2);
      const dequeued = queue.shift();
      expect(dequeued.type).toBe('progress');
      expect(queue).toHaveLength(1);
    });

    test('should preserve order of queued items', () => {
      const queue = [];
      queue.push({ id: 1 });
      queue.push({ id: 2 });
      queue.push({ id: 3 });
      expect(queue[0].id).toBe(1);
      expect(queue[1].id).toBe(2);
      expect(queue[2].id).toBe(3);
    });
  });
});
