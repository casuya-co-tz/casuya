import {
  examTypeToKbFilter,
  matchesKbExamFilter,
  TEST_EXAM_TYPES,
  TEST_EXAM_TYPE_LABELS,
} from '../../../src/kb/exam-types';
import { KbDoc } from '../../../src/kb/types';

describe('exam types (Test Generator KB mapping)', () => {
  it('lists the eight requested test types', () => {
    expect(TEST_EXAM_TYPES).toEqual([
      'topical',
      'monthly',
      'midterm',
      'terminal',
      'annual',
      'necta_ii',
      'necta_iv',
      'necta_vi',
    ]);
    expect(TEST_EXAM_TYPE_LABELS.necta_iv).toBe('NECTA Form IV');
    expect(Object.keys(TEST_EXAM_TYPE_LABELS).length).toBe(8);
  });

  it('maps internal paper types to filename buckets with the form level', () => {
    expect(examTypeToKbFilter('topical', 4)).toEqual({ file: '_form4_topical_' });
    expect(examTypeToKbFilter('terminal', 5)).toEqual({ file: '_form5_terminal_' });
    expect(examTypeToKbFilter('annual', 6)).toEqual({ file: '_form6_annual_' });
    // midterm1/midterm2 both match the midterm fragment
    expect(examTypeToKbFilter('midterm', 3)).toEqual({ file: '_form3_midterm' });
  });

  it('maps national papers to their levels', () => {
    expect(examTypeToKbFilter('necta_ii')).toEqual({ level: 'ftna' });
    expect(examTypeToKbFilter('necta_iv')).toEqual({ level: 'csee' });
    expect(examTypeToKbFilter('necta_vi')).toEqual({ level: 'acsee' });
  });

  it('returns null for monthly (no dedicated KB papers yet)', () => {
    expect(examTypeToKbFilter('monthly', 2)).toBeNull();
  });

  it('falls back to a type-wide bucket when form level is unknown', () => {
    expect(examTypeToKbFilter('topical')).toEqual({ file: '_topical_' });
    expect(examTypeToKbFilter('midterm')).toEqual({ file: '_midterm' });
  });

  it('matches internal docs against the form bucket', () => {
    const doc: KbDoc = {
      id: 1, kind: 'exam', subject: 'Chemistry', title: 'Chemistry Form 4 Terminal', file: 'exams/internal/chemistry/chemistry_form4_terminal_1_2023.json', tokens: 100,
    };
    expect(matchesKbExamFilter(doc, { file: '_form4_terminal_' })).toBe(true);
    expect(matchesKbExamFilter(doc, { file: '_form4_annual_' })).toBe(false);
  });

  it('matches national docs against the level bucket', () => {
    const csee: KbDoc = {
      id: 2, kind: 'exam', subject: 'Physics', title: 'Physics CSEE 2024', file: 'exams/csee/Physics_2024.json', level: 'CSEE', tokens: 100,
    };
    expect(matchesKbExamFilter(csee, { level: 'csee' })).toBe(true);
    expect(matchesKbExamFilter(csee, { level: 'ftna' })).toBe(false);
  });
});