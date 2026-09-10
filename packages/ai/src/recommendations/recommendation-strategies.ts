import { ContentType, Difficulty } from '../types';
import { Recommendation, RecommendationFeedback, RecommendationRequest, TrendingContent } from '../types';
import { ContentCatalogEntry } from './content-catalog';

export function contentBasedFiltering(request: RecommendationRequest, catalog: ContentCatalogEntry[]): Recommendation[] {
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
      const matching = catalog.filter(
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
      for (const entry of catalog) {
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
      for (const entry of catalog) {
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

export function getPopularContent(request: RecommendationRequest, trending: TrendingContent[], catalog: ContentCatalogEntry[], catalogMap: Map<string, ContentCatalogEntry>): Recommendation[] {
    const results: Recommendation[] = [];
    const currentSubject = request.context.currentSubject ?? '';

    if (trending.length > 0) {
      for (const t of trending.slice(0, 5)) {
        const entry = catalogMap.get(t.contentId);
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
        ? catalog.filter(e => e.subject.toLowerCase() === currentSubject.toLowerCase())
        : catalog;

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

export function knowledgeGapBased(request: RecommendationRequest, studentFeedback: RecommendationFeedback[], catalog: ContentCatalogEntry[], catalogMap: Map<string, ContentCatalogEntry>): Recommendation[] {
    const results: Recommendation[] = [];
    const currentSubject = request.context.currentSubject ?? '';

    if (studentFeedback.length > 0) {
      const topicPerformance = new Map<string, { completions: number; ratings: number[] }>();

      for (const f of studentFeedback) {
        const entry = catalogMap.get(f.contentId);
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
        const gapEntries = catalog.filter(
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
        ? catalog.filter(e => e.subject.toLowerCase() === currentSubject.toLowerCase())
        : catalog;

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
        for (const entry of catalog.filter(e => e.contentType === ContentType.QUIZ).slice(0, 2)) {
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

export function mergeAndRank(sources: Recommendation[][], limit: number): Recommendation[] {
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