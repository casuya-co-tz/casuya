import { jest } from '@jest/globals';
import { SessionManager } from '../../src/session-manager/session-manager.js';

describe('SessionManager', () => {
  let sm;

  beforeEach(() => {
    sm = new SessionManager({ timeout: 5000 });
  });

  afterEach(() => {
    sm.destroy();
  });

  test('should create a session', () => {
    const session = sm.create({ packageId: 'test-pkg', version: '1.0.0' });
    expect(session.id).toBeDefined();
    expect(session.packageId).toBe('test-pkg');
    expect(session.status).toBe('active');
  });

  test('should get current session', () => {
    sm.create({ packageId: 'test' });
    const current = sm.getCurrent();
    expect(current).toBeDefined();
    expect(current.packageId).toBe('test');
  });

  test('should get session by id', () => {
    const created = sm.create({ packageId: 'test' });
    const retrieved = sm.get(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(created.id);
  });

  test('should pause and resume sessions', () => {
    const session = sm.create({ packageId: 'test' });
    sm.pause(session.id);
    expect(sm.get(session.id).status).toBe('paused');
    sm.resume(session.id);
    expect(sm.get(session.id).status).toBe('active');
  });

  test('should end a session', async () => {
    const session = sm.create({ packageId: 'test' });
    await sm.end(session.id);
    expect(sm.get(session.id)).toBeNull();
  });

  test('should track active sessions', () => {
    sm.create({ packageId: 'a' });
    sm.create({ packageId: 'b' });
    expect(sm.getActiveSessions().length).toBe(2);
  });

  test('should touch to update activity', () => {
    const session = sm.create({ packageId: 'test' });
    const oldActivity = session.lastActivity;
    sm.touch(session.id);
    expect(sm.getCurrent().lastActivity).toBeGreaterThanOrEqual(oldActivity);
  });

  test('should save session data', async () => {
    const session = sm.create({ packageId: 'test' });
    const result = await sm.save(session.id, { progress: { slide: 5 } });
    expect(result).toBe(true);
    expect(sm.getCurrent().progress.slide).toBe(5);
  });

  test('should emit lifecycle events', () => {
    const bus = { emit: jest.fn() };
    const sm2 = new SessionManager({ eventBus: bus, timeout: 5000 });
    sm2.create({ packageId: 'test' });
    expect(bus.emit).toHaveBeenCalledWith('session:created', expect.any(Object));
    sm2.destroy();
  });
});
