import { jest } from '@jest/globals';
import { ExtensionManager } from '../../src/extensions/extension-manager.js';

describe('ExtensionManager', () => {
  let em;

  beforeEach(() => {
    em = new ExtensionManager();
  });

  test('should register extensions', () => {
    const ext = { id: 'test-ext', onLoad: jest.fn() };
    em.register(ext);
    expect(em.hasExtension('test-ext')).toBe(true);
  });

  test('should reject extensions without id', () => {
    expect(() => em.register({})).toThrow();
  });

  test('should trigger lifecycle hooks', () => {
    const ext = {
      id: 'test',
      onStart: jest.fn(),
      onStop: jest.fn()
    };
    em.register(ext);
    em.triggerHook('onStart', { data: 1 });
    expect(ext.onStart).toHaveBeenCalledWith({ data: 1 });
    em.triggerHook('onStop', { data: 2 });
    expect(ext.onStop).toHaveBeenCalledWith({ data: 2 });
  });

  test('should unregister extensions', () => {
    const ext = { id: 'remove-me', onLoad: jest.fn() };
    em.register(ext);
    em.unregister('remove-me');
    expect(em.hasExtension('remove-me')).toBe(false);
  });

  test('should get extension by id', () => {
    const ext = { id: 'get-me' };
    em.register(ext);
    expect(em.getExtension('get-me')).toBe(ext);
  });

  test('should list all extensions', () => {
    em.register({ id: 'a' });
    em.register({ id: 'b' });
    expect(em.getExtensions()).toHaveLength(2);
  });

  test('should return registered hooks count', () => {
    em.register({ id: 'a', onStart: jest.fn(), onStop: jest.fn() });
    const hooks = em.getRegisteredHooks();
    expect(hooks.onStart).toBe(1);
  });

  test('should handle hook errors gracefully', () => {
    const ext = { id: 'error', onStart: () => { throw new Error('hook error'); } };
    expect(() => em.register(ext)).not.toThrow();
    expect(() => em.triggerHook('onStart', {})).not.toThrow();
  });

  test('should destroy and trigger onDestroy', () => {
    const ext = { id: 'destroy', onDestroy: jest.fn() };
    em.register(ext);
    em.destroy();
    expect(ext.onDestroy).toHaveBeenCalled();
    expect(em.getExtensions()).toHaveLength(0);
  });
});
