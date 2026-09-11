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

export function isTestExamType(value: string): value is TestExamType {
  return (TEST_EXAM_TYPES as string[]).includes(value);
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