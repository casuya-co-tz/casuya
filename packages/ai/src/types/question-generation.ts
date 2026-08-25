import { Difficulty, Language } from './common';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
  ESSAY = 'essay',
  FILL_IN_BLANK = 'fill_in_blank',
  MATCHING = 'matching',
  ORDERING = 'ordering',
  CODE = 'code',
}

export enum QuestionCategory {
  RECALL = 'recall',
  COMPREHENSION = 'comprehension',
  APPLICATION = 'application',
  ANALYSIS = 'analysis',
  EVALUATION = 'evaluation',
  CREATION = 'creation',
}

export interface QuestionGenerationRequest {
  subject: string;
  topic: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  category: QuestionCategory;
  count: number;
  language?: Language;
  context?: string;
  constraints?: QuestionConstraints;
}

export interface QuestionConstraints {
  maxOptions?: number;
  minOptions?: number;
  maxLength?: number;
  requireExplanation?: boolean;
  requireReferences?: boolean;
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: Difficulty;
  subject: string;
  topic: string;
  text: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  distractors?: string[];
  hints?: string[];
  metadata: QuestionMetadata;
}

export interface QuestionMetadata {
  estimatedTime: number;
  bloomLevel: QuestionCategory;
  concepts: string[];
  tags: string[];
  reviewed: boolean;
  version: string;
}

export interface QuestionTemplate {
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  template: string;
  variables: TemplateVariable[];
  difficulty: Difficulty;
  subject: string;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'list';
  range?: [number, number];
  options?: string[];
}

export interface DistractorConfig {
  count: number;
  plausibility: 'high' | 'medium' | 'low';
  basedOn: 'common_mistakes' | 'similar_concepts' | 'random';
}

export interface QuestionBankEntry {
  question: GeneratedQuestion;
  usageCount: number;
  successRate: number;
  averageTime: number;
  lastUsed: Date;
}
