import { jest } from '@jest/globals';
import { EventAPI } from '../../../src/api/event-api.js';

describe('EventAPI', () => {
  let eventAPI;

  beforeEach(() => {
    eventAPI = new EventAPI();
  });

  test('should emit and receive events', () => {
    const listener = jest.fn();
    eventAPI.on('test', listener);
    eventAPI.emit('test', { data: 1 });
    expect(listener).toHaveBeenCalledWith({ data: 1 });
  });

  test('should support once', () => {
    const listener = jest.fn();
    eventAPI.once('test', listener);
    eventAPI.emit('test', {});
    eventAPI.emit('test', {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('should remove listeners', () => {
    const listener = jest.fn();
    const unsubscribe = eventAPI.on('test', listener);
    unsubscribe();
    eventAPI.emit('test', {});
    expect(listener).not.toHaveBeenCalled();
  });

  test('should return registered events', () => {
    eventAPI.on('a', jest.fn());
    eventAPI.on('b', jest.fn());
    const events = eventAPI.getRegisteredEvents();
    expect(events).toContain('a');
    expect(events).toContain('b');
  });

  test('should clear all', () => {
    eventAPI.on('test', jest.fn());
    eventAPI.clear();
    expect(eventAPI.getRegisteredEvents()).toHaveLength(0);
  });
});