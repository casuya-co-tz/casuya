import { Language } from './common';

export interface TranslationRequest {
  text: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  context?: string;
  preserveFormatting?: boolean;
  domain?: TranslationDomain;
}

export enum TranslationDomain {
  GENERAL = 'general',
  EDUCATION = 'education',
  SCIENCE = 'science',
  MATHEMATICS = 'mathematics',
  LITERATURE = 'literature',
  HISTORY = 'history',
  TECHNOLOGY = 'technology',
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  confidence: number;
  alternativeTranslations?: string[];
  glossaryTerms?: TranslatedTerm[];
  latency: number;
}

export interface TranslatedTerm {
  original: string;
  translated: string;
  context: string;
  confidence: number;
}

export interface LanguageDetectionResult {
  detectedLanguage: Language;
  confidence: number;
  alternatives: Array<{ language: Language; confidence: number }>;
}

export interface GlossaryEntry {
  id: string;
  sourceTerm: string;
  sourceLanguage: Language;
  targetTerm: string;
  targetLanguage: Language;
  context: string;
  domain: TranslationDomain;
  approved: boolean;
}

export interface BatchTranslationRequest {
  texts: string[];
  sourceLanguage: Language;
  targetLanguage: Language;
  domain?: TranslationDomain;
}
