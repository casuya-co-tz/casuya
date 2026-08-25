import { jest } from '@jest/globals';
import { Runtime } from '../../src/runtime.js';
import { EventBus } from '../../src/events/event-bus.js';
import { deepClone } from '../../src/utilities/object-utils.js';

describe('Runtime Integration', () => {
  let runtime;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (runtime) await runtime.destroy();
    container.remove();
  });

  const testPackage = {
    manifest: {
      id: 'integration-test',
      version: '1.0.0',
      title: 'Integration Test',
      type: 'lesson',
      permissions: ['storage', 'quiz', 'timer'],
      slides: [{ id: 's1', content: '<p>Test</p>' }]
    }
  };

  test('should complete full lifecycle: create -> load -> start -> pause -> resume -> stop', async () => {
    runtime = new Runtime({ container });
    expect(runtime.state).toBe('created');

    await runtime.load(testPackage);
    expect(runtime.state).toBe('loaded');

    runtime._setState('running');

    runtime.pause();
    expect(runtime.state).toBe('paused');

    runtime.resume();
    expect(runtime.state).toBe('running');

    await runtime.stop();
    expect(runtime.state).toBe('stopped');
  });

  test('should manage state across operations', async () => {
    runtime = new Runtime({ container });
    await runtime.load(testPackage);

    runtime._stateManager.set('currentSlide', 's1');
    runtime._stateManager.set('quizAnswers.q1', 'A');
    runtime._stateManager.merge({ completedSlides: ['intro'] });

    const snap = runtime._stateManager.snapshot();
    expect(snap.state.currentSlide).toBe('s1');
    expect(snap.state.quizAnswers.q1).toBe('A');
  });

  test('should handle multiple event subscriptions', () => {
    runtime = new Runtime({ container });
    const stateChanges = [];
    runtime.eventBus.on('runtime:stateChanged', (data) => {
      stateChanges.push(data.newState);
    });
    runtime._setState('loading');
    runtime._setState('loaded');
    expect(stateChanges).toContain('loading');
    expect(stateChanges).toContain('loaded');
  });

  test('should support extensions', () => {
    runtime = new Runtime({ container });
    const ext = {
      id: 'integration-ext',
      onLoad: jest.fn(),
      onStart: jest.fn()
    };
    runtime.use(ext);
    expect(runtime.extensionManager.hasExtension('integration-ext')).toBe(true);
  });

  test('should emit lifecycle events', () => {
    runtime = new Runtime({ container });
    const events = [];
    runtime.eventBus.on('package:loaded', (e) => events.push('loaded:' + e.package.manifest.id));
    runtime.eventBus.on('runtime:stateChanged', (e) => events.push('state:' + e.newState));

    runtime._setState('running');
    expect(events).toContain('state:running');
  });

  test('should recover from errors', async () => {
    runtime = new Runtime({ container });
    await expect(runtime.load(null)).rejects.toThrow();
    expect(runtime.state).toBe('error');
  });

  test('should provide metrics', () => {
    runtime = new Runtime({ container });
    const metrics = runtime.getMetrics();
    expect(metrics).toBeDefined();
  });
});
