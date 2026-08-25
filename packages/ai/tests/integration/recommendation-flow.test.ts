import { CasuyaAI } from '../../src/casuya-ai';
import { ContentType } from '../../src/types';

describe('Recommendation Flow Integration', () => {
  let casuya: CasuyaAI;

  beforeAll(() => {
    casuya = new CasuyaAI();
  });

  afterAll(async () => {
    await casuya.shutdown();
  });

  it('should generate recommendations', async () => {
    const result = await casuya.recommend({
      studentId: 'student-1',
      context: {
        currentSubject: 'mathematics',
        recentTopics: ['Algebra', 'Geometry'],
      },
      limit: 5,
      filters: {
        contentType: [ContentType.LESSON, ContentType.QUIZ],
      },
    });

    expect(result).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
