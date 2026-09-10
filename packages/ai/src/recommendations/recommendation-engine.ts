import {
  RecommendationRequest,
  RecommendationResult,
  Recommendation,
  RecommendationStrategy,
  RecommendationFeedback,
  TrendingContent,
} from '../types';
import { CacheManager } from '../caching/cache-manager';
import { Logger } from '../utilities/logger';
import { CONTENT_CATALOG, ContentCatalogEntry } from './content-catalog';
import { contentBasedFiltering, getPopularContent, knowledgeGapBased, mergeAndRank } from './recommendation-strategies';

export class RecommendationEngine {
  private logger: Logger;
  private cache: CacheManager;
  private feedbackLog: Map<string, RecommendationFeedback[]>;
  private contentCatalog: Map<string, ContentCatalogEntry>;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger({ prefix: '[RecommendationEngine]' });
    this.cache = new CacheManager({ defaultTTL: 60 * 60 * 1000 });
    this.feedbackLog = new Map();
    this.contentCatalog = new Map(CONTENT_CATALOG.map(e => [e.contentId, e]));
  }

  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResult> {
    const cacheKey = `rec:${request.studentId}:${JSON.stringify(request.context)}`;
    const cached = this.cache.get<RecommendationResult>(cacheKey);
    if (cached) return cached;

    const recommendations = await this.generateRecommendations(request);
    const result: RecommendationResult = {
      recommendations,
      total: recommendations.length,
      strategy: RecommendationStrategy.HYBRID,
      personalized: true,
    };

    this.cache.set(cacheKey, result, 15 * 60 * 1000);
    return result;
  }

  private async generateRecommendations(request: RecommendationRequest): Promise<Recommendation[]> {
    const contentBased = contentBasedFiltering(request, CONTENT_CATALOG);
    const popular = getPopularContent(request, this.getTrendingContent(), CONTENT_CATALOG, this.contentCatalog);
    const gap = knowledgeGapBased(request, this.feedbackLog.get(request.studentId) ?? [], CONTENT_CATALOG, this.contentCatalog);

    const merged = mergeAndRank([contentBased, popular, gap], request.limit ?? 10);
    return merged;
  }

  recordFeedback(feedback: RecommendationFeedback): void {
    const key = feedback.studentId;
    if (!this.feedbackLog.has(key)) {
      this.feedbackLog.set(key, []);
    }
    this.feedbackLog.get(key)!.push(feedback);
    this.logger.info(`Feedback recorded for ${feedback.contentId}`);
  }

  getFeedbackForContent(contentId: string): RecommendationFeedback[] {
    const allFeedback: RecommendationFeedback[] = [];
    for (const feedbacks of this.feedbackLog.values()) {
      allFeedback.push(...feedbacks.filter((f) => f.contentId === contentId));
    }
    return allFeedback;
  }

  getTrendingContent(): TrendingContent[] {
    const now = Date.now();
    const recent = 7 * 24 * 60 * 60 * 1000;
    const contentStats = new Map<string, { views: number; completions: number; ratings: number[] }>();

    for (const feedbacks of this.feedbackLog.values()) {
      for (const f of feedbacks) {
        if (now - f.timestamp.getTime() > recent) continue;
        if (!contentStats.has(f.contentId)) {
          contentStats.set(f.contentId, { views: 0, completions: 0, ratings: [] });
        }
        const stats = contentStats.get(f.contentId)!;
        stats.views++;
        stats.completions += f.completion;
        if (f.rating) stats.ratings.push(f.rating);
      }
    }

    return Array.from(contentStats.entries()).map(([contentId, stats]) => ({
      contentId,
      views: stats.views,
      completions: stats.completions,
      averageRating: stats.ratings.length > 0
        ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length
        : 0,
      trend: stats.views > 10 ? 'rising' as const : 'stable' as const,
    }));
  }
}