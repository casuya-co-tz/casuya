import {
  RecommendationRequest,
  RecommendationResult,
  Recommendation,
  RecommendationStrategy,
  RecommendationFeedback,
  TrendingContent,
  ContentType,
  Difficulty,
} from '../types';
import { CacheManager } from '../caching/cache-manager';
import { Logger } from '../utilities/logger';

interface ContentCatalogEntry {
  contentId: string;
  contentType: ContentType;
  title: string;
  description: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  estimatedDuration: number;
}

const CONTENT_CATALOG: ContentCatalogEntry[] = [
  { contentId: 'cat-math-alg-1', contentType: ContentType.LESSON, title: 'Algebra Fundamentals', description: 'Core algebraic concepts and operations', subject: 'mathematics', topic: 'algebra', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-math-alg-2', contentType: ContentType.QUIZ, title: 'Algebra Practice Quiz', description: 'Test your algebra knowledge', subject: 'mathematics', topic: 'algebra', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 15 },
  { contentId: 'cat-math-alg-3', contentType:   ContentType.ASSIGNMENT, title: 'Algebra Problem Set', description: 'Solve challenging algebra problems', subject: 'mathematics', topic: 'algebra', difficulty: Difficulty.ADVANCED, estimatedDuration: 25 },
  { contentId: 'cat-math-geo-1', contentType: ContentType.LESSON, title: 'Geometry Essentials', description: 'Shapes, angles, and spatial reasoning', subject: 'mathematics', topic: 'geometry', difficulty: Difficulty.BEGINNER, estimatedDuration: 18 },
  { contentId: 'cat-math-geo-2', contentType: ContentType.QUIZ, title: 'Geometry Quick Check', description: 'Verify your geometry understanding', subject: 'mathematics', topic: 'geometry', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 12 },
  { contentId: 'cat-math-calc-1', contentType: ContentType.LESSON, title: 'Introduction to Calculus', description: 'Limits and derivatives explained', subject: 'mathematics', topic: 'calculus', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 30 },
  { contentId: 'cat-math-calc-2', contentType:   ContentType.ASSIGNMENT, title: 'Calculus Exercises', description: 'Practice differentiation and integration', subject: 'mathematics', topic: 'calculus', difficulty: Difficulty.ADVANCED, estimatedDuration: 35 },
  { contentId: 'cat-math-stat-1', contentType: ContentType.LESSON, title: 'Statistics Basics', description: 'Mean, median, mode and standard deviation', subject: 'mathematics', topic: 'statistics', difficulty: Difficulty.BEGINNER, estimatedDuration: 22 },
  { contentId: 'cat-math-stat-2', contentType: ContentType.QUIZ, title: 'Statistics Assessment', description: 'Check your statistics skills', subject: 'mathematics', topic: 'statistics', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 15 },
  { contentId: 'cat-sci-phy-1', contentType: ContentType.LESSON, title: 'Physics Foundations', description: 'Newtonian mechanics and motion', subject: 'science', topic: 'physics', difficulty: Difficulty.BEGINNER, estimatedDuration: 25 },
  { contentId: 'cat-sci-phy-2', contentType: ContentType.QUIZ, title: 'Physics Challenge', description: 'Apply physics concepts', subject: 'science', topic: 'physics', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 18 },
  { contentId: 'cat-sci-chem-1', contentType: ContentType.LESSON, title: 'Chemistry Intro', description: 'Elements, compounds and reactions', subject: 'science', topic: 'chemistry', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-sci-chem-2', contentType:   ContentType.ASSIGNMENT, title: 'Chemistry Lab Problems', description: 'Solve chemical equations', subject: 'science', topic: 'chemistry', difficulty: Difficulty.ADVANCED, estimatedDuration: 28 },
  { contentId: 'cat-sci-bio-1', contentType: ContentType.LESSON, title: 'Biology Overview', description: 'Cells, genetics and ecosystems', subject: 'science', topic: 'biology', difficulty: Difficulty.BEGINNER, estimatedDuration: 22 },
  { contentId: 'cat-sci-bio-2', contentType: ContentType.QUIZ, title: 'Biology Quiz', description: 'Test biology concepts', subject: 'science', topic: 'biology', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 14 },
  { contentId: 'cat-eng-gram-1', contentType: ContentType.LESSON, title: 'Grammar Workshop', description: 'Parts of speech and sentence structure', subject: 'english', topic: 'grammar', difficulty: Difficulty.BEGINNER, estimatedDuration: 16 },
  { contentId: 'cat-eng-gram-2', contentType: ContentType.QUIZ, title: 'Grammar Test', description: 'Assess your grammar knowledge', subject: 'english', topic: 'grammar', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 12 },
  { contentId: 'cat-eng-writ-1', contentType: ContentType.LESSON, title: 'Essay Writing Skills', description: 'Structure and write compelling essays', subject: 'english', topic: 'writing', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 25 },
  { contentId: 'cat-eng-writ-2', contentType:   ContentType.ASSIGNMENT, title: 'Writing Practice', description: 'Write and refine paragraphs', subject: 'english', topic: 'writing', difficulty: Difficulty.ADVANCED, estimatedDuration: 30 },
  { contentId: 'cat-eng-lit-1', contentType: ContentType.LESSON, title: 'Literary Analysis', description: 'Analyze themes and literary devices', subject: 'english', topic: 'literature', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 24 },
  { contentId: 'cat-hist-anc-1', contentType: ContentType.LESSON, title: 'Ancient Civilizations', description: 'Explore early human societies', subject: 'history', topic: 'ancient-civilizations', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-hist-anc-2', contentType: ContentType.QUIZ, title: 'History Timeline Quiz', description: 'Match events to time periods', subject: 'history', topic: 'ancient-civilizations', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 15 },
  { contentId: 'cat-hist-mod-1', contentType: ContentType.LESSON, title: 'Modern History', description: 'Major events of the last century', subject: 'history', topic: 'modern-history', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 22 },
  { contentId: 'cat-hist-mod-2', contentType:   ContentType.ASSIGNMENT, title: 'Historical Essay', description: 'Write about historical events', subject: 'history', topic: 'modern-history', difficulty: Difficulty.ADVANCED, estimatedDuration: 28 },
  { contentId: 'cat-cs-prog-1', contentType: ContentType.LESSON, title: 'Programming Basics', description: 'Variables, loops and functions', subject: 'computer-science', topic: 'programming', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-cs-prog-2', contentType: ContentType.QUIZ, title: 'Code Challenge', description: 'Solve programming puzzles', subject: 'computer-science', topic: 'programming', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 18 },
  { contentId: 'cat-cs-algo-1', contentType: ContentType.LESSON, title: 'Algorithm Design', description: 'Sorting, searching and optimization', subject: 'computer-science', topic: 'algorithms', difficulty: Difficulty.ADVANCED, estimatedDuration: 30 },
  { contentId: 'cat-cs-algo-2', contentType:   ContentType.ASSIGNMENT, title: 'Algorithm Practice', description: 'Implement classic algorithms', subject: 'computer-science', topic: 'algorithms', difficulty: Difficulty.ADVANCED, estimatedDuration: 35 },
];

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
    const contentBased = this.contentBasedFiltering(request);
    const popular = this.getPopularContent(request);
    const gap = this.knowledgeGapBased(request);

    const merged = this.mergeAndRank([contentBased, popular, gap], request.limit ?? 10);
    return merged;
  }

  private contentBasedFiltering(request: RecommendationRequest): Recommendation[] {
    const recentTopics = request.context.recentTopics ?? [];
    const currentSubject = request.context.currentSubject ?? '';
    const results: Recommendation[] = [];
    const usedIds = new Set<string>();

    const topicPool: string[] = [...recentTopics];
    if (currentSubject && !topicPool.includes(currentSubject)) {
      topicPool.push(currentSubject);
    }
    if (topicPool.length === 0) {
      return results;
    }

    const typeCycle = [ContentType.LESSON, ContentType.QUIZ, ContentType.ASSIGNMENT];

    for (const topic of topicPool) {
      const topicLower = topic.toLowerCase();
      const matching = CONTENT_CATALOG.filter(
        e => !usedIds.has(e.contentId) && (
          e.topic.toLowerCase().includes(topicLower) ||
          e.title.toLowerCase().includes(topicLower) ||
          (currentSubject && e.subject.toLowerCase() === currentSubject.toLowerCase())
        )
      );

      for (const entry of matching.slice(0, 2)) {
        if (usedIds.has(entry.contentId)) continue;
        usedIds.add(entry.contentId);
        results.push({
          contentId: entry.contentId,
          contentType: entry.contentType,
          title: entry.title,
          description: entry.description,
          reason: `Matches your recent topic: ${topic}`,
          score: topicLower === entry.topic.toLowerCase() ? 0.9 : 0.7,
          difficulty: entry.difficulty,
          estimatedDuration: entry.estimatedDuration,
        });
      }
    }

    if (results.length < 3) {
      for (const entry of CONTENT_CATALOG) {
        if (usedIds.has(entry.contentId)) continue;
        if (currentSubject && entry.subject.toLowerCase() === currentSubject.toLowerCase()) {
          usedIds.add(entry.contentId);
          results.push({
            contentId: entry.contentId,
            contentType: entry.contentType,
            title: entry.title,
            description: entry.description,
            reason: `Popular in ${currentSubject}`,
            score: 0.6,
            difficulty: entry.difficulty,
            estimatedDuration: entry.estimatedDuration,
          });
          if (results.length >= 5) break;
        }
      }
    }

    if (results.length < 3) {
      for (const entry of CONTENT_CATALOG) {
        if (usedIds.has(entry.contentId)) continue;
        usedIds.add(entry.contentId);
        const typeIndex = results.length % typeCycle.length;
        results.push({
          contentId: entry.contentId,
          contentType: typeCycle[typeIndex],
          title: entry.title,
          description: entry.description,
          reason: 'Recommended based on your profile',
          score: 0.5,
          difficulty: entry.difficulty,
          estimatedDuration: entry.estimatedDuration,
        });
        if (results.length >= 5) break;
      }
    }

    return results;
  }

  private getPopularContent(request: RecommendationRequest): Recommendation[] {
    const trending = this.getTrendingContent();
    const results: Recommendation[] = [];
    const currentSubject = request.context.currentSubject ?? '';

    if (trending.length > 0) {
      for (const t of trending.slice(0, 5)) {
        const entry = this.contentCatalog.get(t.contentId);
        results.push({
          contentId: t.contentId,
          contentType: entry?.contentType ?? ContentType.LESSON,
          title: entry?.title ?? `Trending: ${t.contentId}`,
          description: entry?.description ?? `Popular content with ${t.views} views`,
          reason: t.trend === 'rising' ? 'Rising in popularity' : 'Trending in your area',
          score: 0.5 + (t.averageRating / 5) * 0.4,
          difficulty: entry?.difficulty ?? Difficulty.INTERMEDIATE,
          estimatedDuration: entry?.estimatedDuration ?? 20,
        });
      }
    }

    if (results.length < 3) {
      const fallbackCandidates = currentSubject
        ? CONTENT_CATALOG.filter(e => e.subject.toLowerCase() === currentSubject.toLowerCase())
        : CONTENT_CATALOG;

      for (const entry of fallbackCandidates.slice(0, 3)) {
        if (results.some(r => r.contentId === entry.contentId)) continue;
        results.push({
          contentId: entry.contentId,
          contentType: entry.contentType,
          title: entry.title,
          description: entry.description,
          reason: 'Popular among students in your subject',
          score: 0.65,
          difficulty: entry.difficulty,
          estimatedDuration: entry.estimatedDuration,
        });
      }
    }

    return results;
  }

  private knowledgeGapBased(request: RecommendationRequest): Recommendation[] {
    const studentFeedback = this.feedbackLog.get(request.studentId) ?? [];
    const results: Recommendation[] = [];
    const currentSubject = request.context.currentSubject ?? '';

    if (studentFeedback.length > 0) {
      const topicPerformance = new Map<string, { completions: number; ratings: number[] }>();

      for (const f of studentFeedback) {
        const entry = this.contentCatalog.get(f.contentId);
        const topic = entry?.topic ?? 'unknown';
        if (!topicPerformance.has(topic)) {
          topicPerformance.set(topic, { completions: 0, ratings: [] });
        }
        const perf = topicPerformance.get(topic)!;
        perf.completions += f.completion;
        if (f.rating) perf.ratings.push(f.rating);
      }

      const weakTopics = Array.from(topicPerformance.entries())
        .filter(([, perf]) => {
          const avgCompletion = perf.completions;
          const avgRating = perf.ratings.length > 0
            ? perf.ratings.reduce((a, b) => a + b, 0) / perf.ratings.length
            : 3;
          return avgCompletion < 0.7 || avgRating < 3;
        })
        .sort((a, b) => {
          const scoreA = a[1].completions;
          const scoreB = b[1].completions;
          return scoreA - scoreB;
        });

      for (const [topic] of weakTopics.slice(0, 3)) {
        const gapEntries = CONTENT_CATALOG.filter(
          e => e.topic === topic && e.contentType === ContentType.QUIZ
        );
        for (const entry of gapEntries.slice(0, 1)) {
          results.push({
            contentId: entry.contentId,
            contentType: ContentType.QUIZ,
            title: entry.title,
            description: `Strengthen your understanding of ${topic}`,
            reason: `Low performance detected in ${topic}`,
            score: 0.85,
            difficulty: entry.difficulty,
            estimatedDuration: entry.estimatedDuration,
          });
        }
      }
    }

    if (results.length === 0) {
      const subjectEntries = currentSubject
        ? CONTENT_CATALOG.filter(e => e.subject.toLowerCase() === currentSubject.toLowerCase())
        : CONTENT_CATALOG;

      const quizEntries = subjectEntries.filter(e => e.contentType === ContentType.QUIZ);
      for (const entry of quizEntries.slice(0, 3)) {
        results.push({
          contentId: entry.contentId,
          contentType: ContentType.QUIZ,
          title: entry.title,
          description: entry.description,
          reason: 'Knowledge check for your subject',
          score: 0.7,
          difficulty: entry.difficulty,
          estimatedDuration: entry.estimatedDuration,
        });
      }

      if (results.length === 0) {
        for (const entry of CONTENT_CATALOG.filter(e => e.contentType === ContentType.QUIZ).slice(0, 2)) {
          results.push({
            contentId: entry.contentId,
            contentType: ContentType.QUIZ,
            title: entry.title,
            description: entry.description,
            reason: 'Recommended knowledge check',
            score: 0.6,
            difficulty: entry.difficulty,
            estimatedDuration: entry.estimatedDuration,
          });
        }
      }
    }

    return results;
  }

  private mergeAndRank(sources: Recommendation[][], limit: number): Recommendation[] {
    const seen = new Set<string>();
    const merged: Recommendation[] = [];

    for (const source of sources) {
      for (const rec of source) {
        if (!seen.has(rec.contentId)) {
          seen.add(rec.contentId);
          merged.push(rec);
        }
      }
    }

    return merged.sort((a, b) => b.score - a.score).slice(0, limit);
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
