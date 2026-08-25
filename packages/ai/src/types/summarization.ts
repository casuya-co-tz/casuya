import { Language, Difficulty } from './common';

export enum SummarizationStrategy {
  EXTRACTIVE = 'extractive',
  ABSTRACTIVE = 'abstractive',
  HYBRID = 'hybrid',
}

export enum SummaryLength {
  TINY = 'tiny',
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
  FULL = 'full',
}

export interface SummarizationRequest {
  content: string;
  strategy: SummarizationStrategy;
  length: SummaryLength;
  language: Language;
  difficulty?: Difficulty;
  focus?: string[];
  maxSentences?: number;
}

export interface SummarizationResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  strategy: SummarizationStrategy;
  keyPoints: string[];
  language: Language;
  confidence: number;
}

export interface ExtractiveSummary {
  sentences: ExtractedSentence[];
  coverage: number;
}

export interface ExtractedSentence {
  text: string;
  score: number;
  position: number;
  selected: boolean;
}

export interface AbstractiveSummary {
  text: string;
  originalConcepts: string[];
  preserved: boolean;
}

export interface SummaryChunk {
  text: string;
  startPosition: number;
  endPosition: number;
  importance: number;
}
