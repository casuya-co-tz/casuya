import { KbDoc } from './types';

/**
 * Test/exam types the Test Generator can produce. Each maps to a bucket of
 * knowledge-base exam papers so the model can ground questions in genuine
 * NECTA/internal past papers without copying them verbatim.
 */
export type TestExamType =
  | 'topical'
  | 'monthly'
  | 'midterm'
  | 'terminal'
  | 'annual'
  | 'necta_ii'
  | 'necta_iv'
  | 'necta_vi';

export const TEST_EXAM_TYPE_LABELS: Record<TestExamType, string> = {
  topical: 'Topical Test',
  monthly: 'Monthly Test',
  midterm: 'Midterm Test',
  terminal: 'Terminal Test',
  annual: 'Annual Test',
  necta_ii: 'NECTA Form II',
  necta_iv: 'NECTA Form IV',
  necta_vi: 'NECTA Form VI',
};

export const TEST_EXAM_TYPES: TestExamType[] = [
  'topical',
  'monthly',
  'midterm',
  'terminal',
  'annual',
  'necta_ii',
  'necta_iv',
  'necta_vi',
];

/**
 * National exam types own their form: the request body must not be able to
 * relabel a paper. NECTA Form II/IV/VI always target forms 2, 4 and 6.
 */
export const NATIONAL_TEST_FORM: Partial<Record<TestExamType, number>> = {
  necta_ii: 2,
  necta_iv: 4,
  necta_vi: 6,
};

export function isTestExamType(value: string): value is TestExamType {
  return (TEST_EXAM_TYPES as string[]).includes(value);
}

/** Form the exam will be set for, ignoring an inconsistent client form level. */
export function effectiveFormForTest(testType: TestExamType, formLevel?: number): number {
  const national = NATIONAL_TEST_FORM[testType];
  if (national) return national;
  const n = Number(formLevel);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 4;
}

/**
 * Forms a cumulative (midterm/terminal/annual) exam may draw from within its
 * NECTA band: Form N exams include earlier forms back to the band's entry
 * level (O-Level starts at Form 1, A-Level at Form 5).
 */
export function cumulativeFormRange(formLevel: number): number[] {
  const n = Number.isInteger(formLevel) && formLevel >= 1 && formLevel <= 6 ? formLevel : 4;
  const start = n >= 5 ? 5 : 1;
  const end = n >= 5 ? Math.min(6, n) : Math.min(4, n);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Rules for narrowing the KB exam corpus to one test type.
 *
 * - Internal papers are bucketed by their filename: `chemistry_form4_terminal_1_2024.json`
 *   (midterm1/midterm2 both match `_formN_midterm`).
 * - National papers are bucketed by level: FTNA (Form II), CSEE (Form IV),
 *   ACSEE (Form VI).
 * - Monthly papers do not exist in the KB yet; `null` signals the route to fall
 *   back to syllabus/topic grounding.
 */
export interface KbExamFilter {
  level?: string;
  file?: string;
}

export function examTypeToKbFilter(
  testType: string,
  formLevel?: number,
): KbExamFilter | null {
  switch (testType) {
    case 'topical':
      if (!formLevel) return { file: '_topical_' };
      return { file: `_form${formLevel}_topical_` };
    case 'monthly':
      return null;
    case 'midterm':
      if (!formLevel) return { file: '_midterm' };
      return { file: `_form${formLevel}_midterm` };
    case 'terminal':
      if (!formLevel) return { file: '_terminal_' };
      return { file: `_form${formLevel}_terminal_` };
    case 'annual':
      if (!formLevel) return { file: '_annual_' };
      return { file: `_form${formLevel}_annual_` };
    case 'necta_ii':
      return { level: 'ftna' };
    case 'necta_iv':
      return { level: 'csee' };
    case 'necta_vi':
      return { level: 'acsee' };
    default:
      return null;
  }
}

/** Does this KB doc fall inside the given test-type filter? */
export function matchesKbExamFilter(doc: KbDoc, filter: KbExamFilter): boolean {
  if (filter.level && (doc.level || '').toLowerCase() !== filter.level) return false;
  if (filter.file && !(doc.file || '').includes(filter.file)) return false;
  return true;
}