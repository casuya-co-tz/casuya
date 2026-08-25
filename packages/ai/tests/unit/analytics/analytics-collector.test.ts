import { AnalyticsCollector } from '../../../src/analytics/analytics-collector';

describe('AnalyticsCollector', () => {
  let collector: AnalyticsCollector;

  beforeEach(() => {
    collector = new AnalyticsCollector();
  });

  afterEach(() => {
    collector.destroy();
  });

  it('should record an event', () => {
    collector.track({
      type: 'tutoring_session',
      properties: { studentId: 'student-1', duration: 300 },
    });
    const summary = collector.getSummary();
    expect(summary.totalEvents).toBe(1);
  });

  it('should record multiple events', () => {
    collector.track({ type: 'lesson_start', properties: { lessonId: 'lesson-1' } });
    collector.track({ type: 'lesson_complete', properties: { lessonId: 'lesson-1', score: 0.9 } });
    collector.track({ type: 'quiz_attempt', properties: { quizId: 'quiz-1', score: 0.85 } });
    const summary = collector.getSummary();
    expect(summary.totalEvents).toBe(3);
  });

  it('should track unique students', () => {
    collector.track({ type: 'a', properties: {}, studentId: 's1' });
    collector.track({ type: 'b', properties: {}, studentId: 's2' });
    collector.track({ type: 'a', properties: {}, studentId: 's1' });
    const summary = collector.getSummary();
    expect(summary.totalEvents).toBe(3);
    expect(summary.uniqueStudents).toBe(2);
  });

  it('should flush events on demand', async () => {
    collector.track({ type: 'test', properties: {} });
    await expect(collector.flush()).resolves.toBeUndefined();
    const summary = collector.getSummary();
    expect(summary.totalEvents).toBe(0);
  });

  it('should handle flush with no events', async () => {
    await expect(collector.flush()).resolves.toBeUndefined();
  });

  it('should call custom flush handler', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const customCollector = new AnalyticsCollector(handler);
    customCollector.track({ type: 'custom', properties: {} });
    await customCollector.flush();
    expect(handler).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'custom' })
      ])
    );
    customCollector.destroy();
  });

  it('should return top event types', () => {
    collector.track({ type: 'start', properties: {} });
    collector.track({ type: 'start', properties: {} });
    collector.track({ type: 'complete', properties: {} });
    const summary = collector.getSummary();
    const startEntry = summary.topEventTypes.find(e => e.type === 'start');
    const completeEntry = summary.topEventTypes.find(e => e.type === 'complete');
    expect(startEntry!.count).toBe(2);
    expect(completeEntry!.count).toBe(1);
  });

  it('should return empty summary for empty collector', () => {
    const summary = collector.getSummary();
    expect(summary.totalEvents).toBe(0);
    expect(summary.topEventTypes).toEqual([]);
    expect(summary.uniqueStudents).toBe(0);
  });
});
