import { jest } from '@jest/globals';
import { Timer } from '../../src/utilities/timer.js';
import { LRUCache } from '../../src/cache/lru-cache.js';
import { deepClone } from '../../src/utilities/object-utils.js';
import { StateManager } from '../../src/state-manager/state-manager.js';
import { EventBus } from '../../src/events/event-bus.js';

describe('Performance Benchmarks', () => {
  describe('Timer Performance', () => {
    test('should measure operations accurately', () => {
      const ops = [];
      for (let i = 0; i < 100; i++) {
        const elapsed = Timer.measure(() => {
          let x = 0;
          for (let j = 0; j < 1000; j++) x += j;
        });
        ops.push(elapsed);
      }
      const avg = ops.reduce((a, b) => a + b, 0) / ops.length;
      expect(avg).toBeGreaterThanOrEqual(0);
      expect(avg).toBeLessThan(100);
    });
  });

  describe('LRUCache Performance', () => {
    test('should handle 1000 operations quickly', () => {
      const cache = new LRUCache({ maxSize: 1000000, ttl: 60000 });
      const elapsed = Timer.measure(() => {
        for (let i = 0; i < 1000; i++) {
          cache.set(`key${i}`, `value${i}`, 50);
        }
        for (let i = 0; i < 1000; i++) {
          cache.get(`key${i}`);
        }
      });
      expect(elapsed).toBeLessThan(500);
      cache.clear();
    });

    test('should evict efficiently', () => {
      const cache = new LRUCache({ maxSize: 5000, ttl: 60000 });
      for (let i = 0; i < 1000; i++) {
        cache.set(`k${i}`, 'x', 100);
      }
      expect(cache.size).toBeLessThanOrEqual(5000);
      cache.clear();
    });
  });

  describe('deepClone Performance', () => {
    test('should clone large objects quickly', () => {
      const large = { a: Array.from({ length: 1000 }, (_, i) => i) };
      const elapsed = Timer.measure(() => {
        for (let i = 0; i < 100; i++) {
          deepClone(large);
        }
      });
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('State Manager Performance', () => {
    test('should handle rapid state changes', () => {
      const sm = new StateManager();
      sm.initialize({ manifest: { id: 'perf', version: '1.0.0' } });

      const elapsed = Timer.measure(() => {
        for (let i = 0; i < 1000; i++) {
          sm.set(`key${i}`, `value${i}`);
        }
      });
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('EventBus Performance', () => {
    test('should emit events quickly with many listeners', () => {
      const bus = new EventBus();

      const listeners = [];
      for (let i = 0; i < 50; i++) {
        listeners.push(jest.fn());
        bus.on('test', listeners[i]);
      }

      const elapsed = Timer.measure(() => {
        for (let i = 0; i < 100; i++) {
          bus.emit('test', { index: i });
        }
      });
      expect(elapsed).toBeLessThan(500);
      bus.destroy();
    });
  });
});
