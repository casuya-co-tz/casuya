export type KbKind =
  | 'syllabus'
  | 'exam'
  | 'marking_scheme'
  | 'exam_format'
  | 'lesson'
  | 'scheme'
  | 'reference';

export interface KbDoc {
  id: number;
  kind: KbKind;
  subject: string;
  code?: string;
  form?: string;
  level?: string;
  year?: string;
  title: string;
  file: string;
  tokens: number;
}

export interface KbIndex {
  version: string;
  generated: string;
  counts: { total: number; byKind: Partial<Record<KbKind, number>> };
  docs: KbDoc[];
  subjectCodes: Record<string, string>;
  inverted: Record<string, Array<[number, number]>>;
}

export interface SearchOptions {
  subject?: string;
  form?: string;
  year?: string;
  kind?: KbKind[];
  limit?: number;
}

export interface SearchHit {
  docId: number;
  doc: KbDoc;
  score: number;
  /** Matched title/heading terms highlighted in an abstract. */
  snippet: string;
}

export interface RagContextDoc {
  docId: number;
  kind: KbKind;
  subject: string;
  code?: string;
  form?: string;
  year?: string;
  title: string;
  text: string;
}
