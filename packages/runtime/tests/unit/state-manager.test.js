import { jest } from '@jest/globals';
import { StateManager } from '../../src/state-manager/state-manager.js';

describe('StateManager', () => {
  let sm;

  beforeEach(() => {
    sm = new StateManager();
    sm.initialize({ manifest: { id: 'test', version: '1.0.0' } });
  });

  afterEach(() => {
    sm.reset();
  });

  test('should initialize with default state', () => {
    const state = sm.get();
    expect(state.packageId).toBe('test');
    expect(state.startedAt).toBeDefined();
    expect(state.completed).toBe(false);
  });

  test('should get and set state values', () => {
    sm.set('currentSlide', 'slide-1');
    expect(sm.get('currentSlide')).toBe('slide-1');
  });

  test('should support nested keys', () => {
    sm.set('quizAnswers.q1', 'A');
    expect(sm.get('quizAnswers.q1')).toBe('A');
  });

  test('should merge updates', () => {
    sm.merge({ currentSlide: 'slide-2', completedSlides: ['slide-1'] });
    expect(sm.get('currentSlide')).toBe('slide-2');
    expect(sm.get('completedSlides')).toEqual(['slide-1']);
  });

  test('should create snapshots', () => {
    sm.set('currentSlide', 'slide-5');
    const snap = sm.snapshot();
    expect(snap.id).toBeDefined();
    expect(snap.state.currentSlide).toBe('slide-5');
  });

  test('should restore from snapshot', () => {
    sm.set('currentSlide', 'slide-original');
    const snap = sm.snapshot();
    sm.set('currentSlide', 'slide-changed');
    sm.restore(snap);
    expect(sm.get('currentSlide')).toBe('slide-original');
  });

  test('should enforce max snapshots', () => {
    sm._options.maxSnapshots = 2;
    sm.snapshot();
    sm.snapshot();
    sm.snapshot();
    expect(sm.getSnapshots().length).toBe(2);
  });

  test('should watch state changes', () => {
    const watcher = jest.fn();
    sm.watch('currentSlide', watcher);
    sm.set('currentSlide', 'slide-10');
    expect(watcher).toHaveBeenCalled();
  });

  test('should unwatch state changes', () => {
    const watcher = jest.fn();
    const unwatch = sm.watch('currentSlide', watcher);
    unwatch();
    sm.set('currentSlide', 'slide-11');
    expect(watcher).not.toHaveBeenCalled();
  });

  test('should reset state', () => {
    sm.set('currentSlide', 'slide-final');
    sm.reset();
    expect(sm.get('currentSlide')).toBeUndefined();
  });

  test('should serialize to JSON', () => {
    sm.set('testKey', 'testValue');
    const json = sm.toJSON();
    expect(json.testKey).toBe('testValue');
  });
});
