import { ModelCapability } from './providers';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  template: string;
  variables: PromptVariable[];
  capability: ModelCapability;
  version: string;
  tags: string[];
  metadata: PromptMetadata;
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  validValues?: string[];
}

export interface PromptMetadata {
  author: string;
  created: Date;
  updated: Date;
  usageCount: number;
  averageTokens: number;
  successRate: number;
  category: PromptCategory;
}

export enum PromptCategory {
  TUTORING = 'tutoring',
  QUESTION_GENERATION = 'question_generation',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
  MODERATION = 'moderation',
  RECOMMENDATION = 'recommendation',
  EXPLANATION = 'explanation',
  ASSESSMENT = 'assessment',
}

export interface PromptExecutionRequest {
  templateId: string;
  variables: Record<string, unknown>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PromptExecutionResult {
  content: string;
  templateId: string;
  tokensUsed: number;
  latency: number;
  success: boolean;
  error?: string;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  version: string;
  template: string;
  changelog: string;
  author: string;
  createdAt: Date;
  deprecated: boolean;
}

export interface PromptOptimizationResult {
  originalTemplate: string;
  optimizedTemplate: string;
  tokenReduction: number;
  clarityImprovement: number;
  suggestions: string[];
}
