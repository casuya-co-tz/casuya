import { Difficulty, Language, ContentType } from './common';

export interface StudentProfile {
  id: string;
  name?: string;
  grade?: number;
  age?: number;
  language: Language;
  learningStyle: LearningStyle;
  preferences: StudentPreferences;
  accessibility: AccessibilityNeeds;
  knowledgeState: KnowledgeSummary;
}

export interface LearningStyle {
  visual: number;
  auditory: number;
  reading: number;
  kinesthetic: number;
}

export interface StudentPreferences {
  language: Language;
  difficulty: Difficulty;
  contentTypes: ContentType[];
  sessionDuration: number;
  includeGamification: boolean;
  includeRealWorldExamples: boolean;
}

export interface AccessibilityNeeds {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  highContrast: boolean;
  screenReader: boolean;
  subtitlePreference: boolean;
  reducedMotion: boolean;
}

export interface KnowledgeSummary {
  overallMastery: number;
  subjectsCompleted: number;
  totalConcepts: number;
  masteredConcepts: number;
  averageTimePerLesson: number;
}

export interface AdaptiveParameters {
  currentDifficulty: Difficulty;
  paceMultiplier: number;
  hintLevel: number;
  scaffoldingAmount: 'minimal' | 'moderate' | 'extensive';
  repetitionInterval: number;
}

export interface PersonalizationEvent {
  studentId: string;
  type: PersonalizationEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export enum PersonalizationEventType {
  LESSON_STARTED = 'lesson_started',
  LESSON_COMPLETED = 'lesson_completed',
  QUIZ_ATTEMPTED = 'quiz_attempted',
  CONCEPT_MASTERED = 'concept_mastered',
  CONCEPT_STRUGGLED = 'concept_struggled',
  PREFERENCE_CHANGED = 'preference_changed',
  DIFFICULTY_ADJUSTED = 'difficulty_adjusted',
  ENGAGEMENT_DROP = 'engagement_drop',
}

export interface StudentModel {
  profile: StudentProfile;
  adaptParams: AdaptiveParameters;
  history: PersonalizationEvent[];
  lastUpdated: Date;
}
