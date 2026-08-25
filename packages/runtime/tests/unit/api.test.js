import { jest } from '@jest/globals';
import { QuizAPI } from '../../src/api/quiz-api.js';
import { GameAPI } from '../../src/api/game-api.js';
import { StorageAPI } from '../../src/api/storage-api.js';
import { TimerAPI } from '../../src/api/timer-api.js';
import { EventAPI } from '../../src/api/event-api.js';
import { AnalyticsAPI } from '../../src/api/analytics-api.js';
import { MediaAPI } from '../../src/api/media-api.js';

describe('QuizAPI', () => {
  let quiz;

  beforeEach(() => {
    quiz = new QuizAPI();
  });

  test('should submit and retrieve answers', () => {
    quiz.submitAnswer('q1', 'A');
    expect(quiz.getAnswer('q1').answer).toBe('A');
  });

  test('should require questionId', () => {
    expect(() => quiz.submitAnswer()).toThrow();
  });

  test('should score quizzes', () => {
    const result = quiz.scoreQuiz('quiz1', 8, 10);
    expect(result.score).toBe(8);
    expect(result.percentage).toBe(80);
  });

  test('should return all answers', () => {
    quiz.submitAnswer('q1', 'A');
    quiz.submitAnswer('q2', 'B');
    const all = quiz.getAllAnswers();
    expect(Object.keys(all)).toHaveLength(2);
  });

  test('should return null for unscored quizzes', () => {
    expect(quiz.getScore('nonexistent')).toBeNull();
  });

  test('should reset answers', () => {
    quiz.submitAnswer('q1', 'A');
    quiz.submitAnswer('q2', 'B');
    quiz.reset('q1');
    expect(quiz.getAnswer('q1')).toBeNull();
    expect(quiz.getAnswer('q2')).not.toBeNull();
  });

  test('should emit events', () => {
    const listener = jest.fn();
    quiz.on('quiz:answer', listener);
    quiz.submitAnswer('q1', 'C');
    expect(listener).toHaveBeenCalled();
  });
});

describe('GameAPI', () => {
  let game;

  beforeEach(() => {
    game = new GameAPI();
  });

  test('should manage game state', () => {
    game.setState('level', 3);
    expect(game.getState('level')).toBe(3);
  });

  test('should increment score', () => {
    game.incrementScore(10);
    game.incrementScore(5);
    expect(game.getScore()).toBe(15);
  });

  test('should set score directly', () => {
    game.setScore(100);
    expect(game.getScore()).toBe(100);
  });

  test('should manage lives', () => {
    game.setLives(5);
    expect(game.getLives()).toBe(5);
    game.setLives(0);
    expect(game.getLives()).toBe(0);
  });

  test('should manage health within bounds', () => {
    game.setHealth(150);
    expect(game.getHealth()).toBe(100);
    game.setHealth(-10);
    expect(game.getHealth()).toBe(0);
  });

  test('should add and spend coins', () => {
    game.addCoins(100);
    expect(game.getCoins()).toBe(100);
    expect(game.spendCoins(30)).toBe(true);
    expect(game.getCoins()).toBe(70);
    expect(game.spendCoins(100)).toBe(false);
  });

  test('should track completed levels', () => {
    game.completeLevel(1);
    game.completeLevel(2);
    expect(game.isCompleted(1)).toBe(true);
    expect(game.isCompleted(3)).toBe(false);
    expect(game.getCompletedLevels()).toHaveLength(2);
  });

  test('should submit to leaderboard', () => {
    game.submitScore('leader1', 100);
    game.submitScore('leader1', 200);
    expect(game.getLeaderboard('leader1')).toHaveLength(2);
  });

  test('should reset game state', () => {
    game.setState('level', 5);
    game.incrementScore(100);
    game.reset();
    expect(game.getState('level')).toBeUndefined();
    expect(game.getScore()).toBe(0);
  });
});

describe('StorageAPI', () => {
  let storage;

  beforeEach(() => {
    storage = new StorageAPI({ namespace: 'test' });
  });

  test('should set and get values', async () => {
    await storage.set('key1', 'value1');
    expect(await storage.get('key1')).toBe('value1');
  });

  test('should return default for missing keys', async () => {
    expect(await storage.get('missing', 'default')).toBe('default');
  });

  test('should check key existence', async () => {
    await storage.set('exists', 'yes');
    expect(await storage.has('exists')).toBe(true);
    expect(await storage.has('no')).toBe(false);
  });

  test('should delete values', async () => {
    await storage.set('delete-me', 'value');
    await storage.delete('delete-me');
    expect(await storage.get('delete-me')).toBeNull();
  });

  test('should serialize complex objects', async () => {
    const obj = { a: 1, b: [2, 3], c: { d: 4 } };
    await storage.set('obj', obj);
    const retrieved = await storage.get('obj');
    expect(retrieved).toEqual(obj);
  });

  test('should set and get namespace', () => {
    storage.setNamespace('custom');
  });
});

describe('TimerAPI', () => {
  let timer;

  beforeEach(() => {
    timer = new TimerAPI();
  });

  afterEach(() => {
    timer.destroy();
  });

  test('should create a timer', () => {
    const id = timer.create(1000, { autostart: false });
    expect(id).toBeDefined();
    expect(timer.isRunning(id)).toBe(false);
  });

  test('should start and stop timers', () => {
    const id = timer.create(5000, { autostart: false });
    timer.start(id);
    expect(timer.isRunning(id)).toBe(true);
    timer.stop(id);
    expect(timer.isRunning(id)).toBe(false);
  });

  test('should return time info', () => {
    const id = timer.create(10000, { autostart: false });
    const time = timer.getTime(id);
    expect(time.duration).toBe(10000);
    expect(time.remaining).toBe(10000);
  });

  test('should pause and resume', () => {
    const id = timer.create(5000, { autostart: false });
    timer.start(id);
    timer.pause(id);
    expect(timer.isRunning(id)).toBe(false);
    timer.resume(id);
    expect(timer.isRunning(id)).toBe(true);
  });

  test('should handle finish event', (done) => {
    const id = timer.create(50, { autostart: true, onFinish: () => {
      expect(timer.isFinished(id)).toBe(true);
      done();
    }});
  });

  test('should manage all timers', () => {
    timer.create(5000, { autostart: false });
    timer.create(10000, { autostart: false });
    timer.pauseAll();
    timer.resumeAll();
    timer.stopAll();
    timer.removeAll();
    expect(timer.getAllTimers()).toEqual({});
  });
});

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

describe('AnalyticsAPI', () => {
  let analytics;

  beforeEach(() => {
    analytics = new AnalyticsAPI();
  });

  afterEach(() => {
    analytics.destroy();
  });

  test('should track events', () => {
    const entry = analytics.track('page_view', { page: '/lesson/1' });
    expect(entry.event).toBe('page_view');
    expect(entry.data.page).toBe('/lesson/1');
    expect(analytics.getEventCount()).toBe(1);
  });

  test('should sanitize sensitive data', () => {
    analytics.track('test', { password: 'secret', token: 'abc', safe: 'ok' });
    const events = analytics.getEvents();
    expect(events[0].data.password).toBeUndefined();
    expect(events[0].data.token).toBeUndefined();
    expect(events[0].data.safe).toBe('ok');
  });

  test('should track page views, interactions, progress', () => {
    analytics.trackPageView('/lesson/1');
    analytics.trackInteraction('click', 'button-start');
    analytics.trackProgress('lesson-1', 0.5);
    expect(analytics.getEventCount()).toBe(3);
  });

  test('should flush events', async () => {
    analytics.track('test', {});
    await analytics.flush();
    expect(analytics.getEventCount()).toBe(0);
  });

  test('should clear events', () => {
    analytics.track('test', {});
    analytics.clear();
    expect(analytics.getEventCount()).toBe(0);
  });

  test('should handle flush errors gracefully', async () => {
    const failingCollector = { send: jest.fn().mockRejectedValue(new Error('Network')) };
    const a2 = new AnalyticsAPI({ collector: failingCollector });
    a2.track('test', {});
    await a2.flush();
    expect(a2.getEventCount()).toBeGreaterThan(0);
    a2.destroy();
  });
});
