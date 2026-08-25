import { Difficulty, Language } from './common';

export enum TutoringMode {
  EXPLAIN = 'explain',
  SOCRATIC = 'socratic',
  PRACTICE = 'practice',
  REVIEW = 'review',
  ASSESS = 'assess',
}

export enum TutoringSubject {
  MATHEMATICS = 'mathematics',
  SCIENCE = 'science',
  HISTORY = 'history',
  LITERATURE = 'literature',
  LANGUAGE = 'language',
  COMPUTING = 'computing',
  ARTS = 'arts',
  GENERAL = 'general',
}

export interface TutoringRequest {
  studentId: string;
  subject: TutoringSubject;
  topic: string;
  mode: TutoringMode;
  message: string;
  context?: TutoringContext;
  preferences?: TutoringPreferences;
}

export interface TutoringContext {
  lessonId?: string;
  previousMessages?: ChatHistoryEntry[];
  currentConcept?: string;
  difficultyLevel?: Difficulty;
  language?: Language;
}

export interface ChatHistoryEntry {
  role: 'student' | 'tutor';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TutoringPreferences {
  language: Language;
  difficulty: Difficulty;
  explanationDepth: 'shallow' | 'moderate' | 'deep';
  pace: 'slow' | 'normal' | 'fast';
  includeExamples: boolean;
  includeVisualizations: boolean;
  socraticMethod: boolean;
}

export interface TutoringResponse {
  message: string;
  mode: TutoringMode;
  suggestions?: string[];
  concepts?: ConceptReference[];
  resources?: ResourceLink[];
  confidence: number;
  usage: TokenUsageInfo;
}

export interface ConceptReference {
  name: string;
  definition: string;
  relatedConcepts: string[];
  difficulty: Difficulty;
}

export interface ResourceLink {
  type: 'lesson' | 'video' | 'article' | 'quiz';
  title: string;
  id: string;
  relevance: number;
}

export interface TokenUsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

export interface KnowledgeState {
  studentId: string;
  subject: TutoringSubject;
  masteredConcepts: string[];
  strugglingConcepts: string[];
  unvisitedConcepts: string[];
  overallMastery: number;
  lastAssessment: Date;
}

export interface TutoringSession {
  id: string;
  studentId: string;
  subject: TutoringSubject;
  startedAt: Date;
  endedAt?: Date;
  mode: TutoringMode;
  messages: number;
  conceptsCovered: string[];
  averageConfidence: number;
}
