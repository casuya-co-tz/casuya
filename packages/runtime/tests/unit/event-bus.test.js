import { jest } from '@jest/globals';
import { EventBus } from '../../src/events/event-bus.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.destroy();
  });

  test('should emit and receive events', () => {
    const listener = jest.fn();
    bus.on('test:event', listener);
    bus.emit('test:event', { data: 123 });
    expect(listener).toHaveBeenCalledWith({ data: 123 });
  });

  test('should support once listeners', () => {
    const listener = jest.fn();
    bus.once('test:once', listener);
    bus.emit('test:once', {});
    bus.emit('test:once', {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('should remove listeners with off()', () => {
    const listener = jest.fn();
    bus.on('test:off', listener);
    bus.off('test:off', listener);
    bus.emit('test:off', {});
    expect(listener).not.toHaveBeenCalled();
  });

  test('should support wildcard listeners', () => {
    const listener = jest.fn();
    bus.onAny(listener);
    bus.emit('any:event', { a: 1 });
    bus.emit('another:event', { b: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('should handle listener errors gracefully', () => {
    const errorListener = jest.fn(() => { throw new Error('boom'); });
    const goodListener = jest.fn();
    bus.on('test:error', errorListener);
    bus.on('test:error', goodListener);
    expect(() => bus.emit('test:error', {})).not.toThrow();
    expect(goodListener).toHaveBeenCalled();
  });

  test('should clear all listeners', () => {
    bus.on('a', jest.fn());
    bus.on('b', jest.fn());
    bus.clear();
    expect(bus.listenerCount('a')).toBe(0);
    expect(bus.listenerCount('b')).toBe(0);
  });

  test('should enforce max listeners', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    bus._maxListeners = 2;
    bus.on('test', jest.fn());
    bus.on('test', jest.fn());
    bus.on('test', jest.fn());
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('should return event names', () => {
    bus.on('a', jest.fn());
    bus.on('b', jest.fn());
    const names = bus.eventNames();
    expect(names).toContain('a');
    expect(names).toContain('b');
  });

  test('should return listeners for an event', () => {
    const fn = jest.fn();
    bus.on('test', fn);
    const listeners = bus.listeners('test');
    expect(listeners).toHaveLength(1);
    expect(listeners[0]).toBe(fn);
  });

  test('should not add non-function listeners', () => {
    bus.on('test', 'not-a-function');
    expect(bus.listenerCount('test')).toBe(0);
  });
});
