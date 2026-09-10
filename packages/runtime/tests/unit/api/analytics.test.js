import { jest } from '@jest/globals';
import { AnalyticsAPI } from '../../../src/api/analytics-api.js';

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