export enum Severity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum Language {
  ENGLISH = 'en',
  SPANISH = 'es',
  FRENCH = 'fr',
  GERMAN = 'de',
  ITALIAN = 'it',
  PORTUGUESE = 'pt',
  CHINESE = 'zh',
  JAPANESE = 'ja',
  KOREAN = 'ko',
  ARABIC = 'ar',
  HINDI = 'hi',
  RUSSIAN = 'ru',
  SWAHILI = 'sw',
  ZULU = 'zu',
  AFRIKAANS = 'af',
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Metadata {
  created: Date;
  updated: Date;
  version: string;
  source?: string;
  tags?: string[];
}

export enum Difficulty {
  BEGINNER = 'beginner',
  ELEMENTARY = 'elementary',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum ContentType {
  LESSON = 'lesson',
  QUIZ = 'quiz',
  EXAM = 'exam',
  ASSIGNMENT = 'assignment',
  LAB = 'lab',
  PRESENTATION = 'presentation',
  NOTE = 'note',
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<T>(error: Error): Result<T> {
  return { success: false, error };
}
