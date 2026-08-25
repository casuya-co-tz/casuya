import { jest } from '@jest/globals';
import { Runtime } from '../../src/runtime.js';

describe('Runtime', () => {
  let runtime;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'runtime-container';
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.destroy();
    }
    container.remove();
  });

  test('should create with default options', () => {
    runtime = new Runtime({ container });
    expect(runtime.state).toBe('created');
    expect(runtime.version).toBe('1.0.0');
  });

  test('should merge options correctly', () => {
    runtime = new Runtime({
      container,
      permissions: ['storage', 'quiz'],
      maxCacheSize: 1024 * 1024
    });
    expect(runtime.state).toBe('created');
  });

  test('should have required sub-modules', () => {
    runtime = new Runtime({ container });
    expect(runtime.eventBus).toBeDefined();
    expect(runtime.sandbox).toBeDefined();
    expect(runtime.renderer).toBeDefined();
    expect(runtime.stateManager).toBeDefined();
    expect(runtime.sessionManager).toBeDefined();
    expect(runtime.monitor).toBeDefined();
    expect(runtime.extensionManager).toBeDefined();
  });

  test('should transition states correctly', async () => {
    runtime = new Runtime({ container });
    expect(runtime.state).toBe('created');

    const pkg = {
      manifest: {
        id: 'test-lesson',
        version: '1.0.0',
        title: 'Test Lesson',
        type: 'lesson'
      }
    };

    await runtime.load(pkg);
    expect(runtime.state).toBe('loaded');
    expect(runtime.currentPackage).toBeDefined();
  });

  test('should handle load errors gracefully', async () => {
    runtime = new Runtime({ container });
    await expect(runtime.load(null)).rejects.toThrow();
  });

  test('should support use() for extensions', () => {
    runtime = new Runtime({ container });
    const extension = {
      id: 'test-extension',
      onLoad: jest.fn()
    };
    runtime.use(extension);
    expect(runtime.extensionManager.hasExtension('test-extension')).toBe(true);
  });

  test('should provide getAPIs and getMetrics', () => {
    runtime = new Runtime({ container });
    expect(typeof runtime.getAPIs).toBe('function');
    expect(typeof runtime.getMetrics).toBe('function');
  });

  test('should handle pause/resume lifecycle', () => {
    runtime = new Runtime({ container });
    runtime._setState('running');
    expect(() => runtime.pause()).not.toThrow();
    expect(runtime.state).toBe('paused');
    expect(() => runtime.resume()).not.toThrow();
    expect(runtime.state).toBe('running');
  });

  test('should stop and clean up', async () => {
    runtime = new Runtime({ container });
    await runtime.load({
      manifest: { id: 'test', version: '1.0.0', title: 'Test' }
    });
    runtime._setState('running');
    await runtime.stop();
    expect(runtime.state).toBe('stopped');
  });

  test('should destroy completely', async () => {
    runtime = new Runtime({ container });
    await runtime.destroy();
    expect(runtime.state).toBe('destroyed');
  });
});
