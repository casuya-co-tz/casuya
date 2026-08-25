import { RecommendationEngine } from '../../../src/recommendations/recommendation-engine';
import type { RecommendationRequest } from '../../../src/types/recommendations';

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;

  beforeEach(() => {
    engine = new RecommendationEngine();
  });

  const createRequest = (overrides: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
    studentId: 'student-1',
    context: { currentSubject: 'Math', recentTopics: ['Algebra'] },
    limit: 10,
    ...overrides,
  });

  it('should return recommendations for a student', async () => {
    const result = await engine.getRecommendations(createRequest());
    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.strategy).toBeDefined();
  });

  it('should respect limit parameter', async () => {
    const result = await engine.getRecommendations(createRequest({ limit: 5 }));
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });

  it('should include reason for each recommendation', async () => {
    const result = await engine.getRecommendations(createRequest());
    result.recommendations.forEach(r => {
      expect(r.reason).toBeDefined();
      expect(r.score).toBeGreaterThan(0);
    });
  });

  it('should record and retrieve feedback', () => {
    engine.recordFeedback({
      studentId: 'student-1', contentId: 'content-1',
      engagement: 0.9, completion: 1.0, rating: 5, timestamp: new Date(),
    });
    const feedback = engine.getFeedbackForContent('content-1');
    expect(feedback).toHaveLength(1);
    expect(feedback[0].rating).toBe(5);
  });

  it('should return empty for unknown content feedback', () => {
    const feedback = engine.getFeedbackForContent('unknown');
    expect(feedback).toEqual([]);
  });

  it('should return trending content list', () => {
    const trending = engine.getTrendingContent();
    expect(Array.isArray(trending)).toBe(true);
  });
});
