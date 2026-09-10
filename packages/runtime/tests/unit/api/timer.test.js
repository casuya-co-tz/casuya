import { TimerAPI } from '../../../src/api/timer-api.js';

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