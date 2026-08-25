import { ContentType, Difficulty, Language } from './common';

export interface RecommendationRequest {
  studentId: string;
  context: RecommendationContext;
  limit?: number;
  filters?: RecommendationFilter;
}

export interface RecommendationContext {
  currentLessonId?: string;
  recentTopics?: string[];
  currentSubject?: string;
  learningGoal?: string;
  timeAvailable?: number;
  device?: 'mobile' | 'tablet' | 'desktop';
}

export interface RecommendationFilter {
  contentType?: ContentType[];
  difficulty?: Difficulty[];
  language?: Language[];
  maxDuration?: number;
  tags?: string[];
}

export interface Recommendation {
  contentId: string;
  contentType: ContentType;
  title: string;
  description: string;
  reason: string;
  score: number;
  difficulty: Difficulty;
  estimatedDuration: number;
  thumbnail?: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  total: number;
  strategy: RecommendationStrategy;
  personalized: boolean;
}

export enum RecommendationStrategy {
  CONTENT_BASED = 'content_based',
  COLLABORATIVE = 'collaborative',
  KNOWLEDGE_GAP = 'knowledge_gap',
  CURRICULUM = 'curriculum',
  POPULARITY = 'popularity',
  HYBRID = 'hybrid',
}

export interface RecommendationFeedback {
  studentId: string;
  contentId: string;
  engagement: number;
  completion: number;
  rating?: number;
  timestamp: Date;
}

export interface TrendingContent {
  contentId: string;
  views: number;
  completions: number;
  averageRating: number;
  trend: 'rising' | 'stable' | 'declining';
}
