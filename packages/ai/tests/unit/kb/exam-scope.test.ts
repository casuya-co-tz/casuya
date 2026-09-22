import {
  effectiveFormForTest,
  cumulativeFormRange,
  NATIONAL_TEST_FORM,
} from '../../../src/kb/exam-types';
import { buildPaperPrompt } from '../../../server-utils/paper';
import { resolvePaperPreset } from '../../../src/kb/paper-presets';

describe('effectiveFormForTest', () => {
  it('maps national exam types onto their fixed band-end form', () => {
    expect(NATIONAL_TEST_FORM.necta_ii).toBe(2);
    expect(NATIONAL_TEST_FORM.necta_iv).toBe(4);
    expect(NATIONAL_TEST_FORM.necta_vi).toBe(6);
    expect(effectiveFormForTest('necta_ii', 4)).toBe(2);
    expect(effectiveFormForTest('necta_iv', 2)).toBe(4);
    expect(effectiveFormForTest('necta_iv', 9)).toBe(4);
    expect(effectiveFormForTest('necta_vi', 3)).toBe(6);
  });

  it('keeps the supplied form for internal test types', () => {
    expect(effectiveFormForTest('midterm', 3)).toBe(3);
    expect(effectiveFormForTest('annual', 6)).toBe(6);
  });

  it('falls back to a sane default when form is invalid', () => {
    expect(effectiveFormForTest('topical', 0)).toBe(4);
    expect(effectiveFormForTest('topical', 12)).toBe(4);
    expect(effectiveFormForTest('monthly', Number('a'))).toBe(4);
  });
});

describe('cumulativeFormRange', () => {
  it('levels up from 1 for O-Level exams', () => {
    expect(cumulativeFormRange(1)).toEqual([1]);
    expect(cumulativeFormRange(2)).toEqual([1, 2]);
    expect(cumulativeFormRange(4)).toEqual([1, 2, 3, 4]);
  });

  it('levels up from 5 for A-Level exams', () => {
    expect(cumulativeFormRange(5)).toEqual([5]);
    expect(cumulativeFormRange(6)).toEqual([5, 6]);
  });

  it('defaults to the full O-Level band for an unknown form', () => {
    expect(cumulativeFormRange(0)).toEqual([1, 2, 3, 4]);
    expect(cumulativeFormRange(9)).toEqual([1, 2, 3, 4]);
  });
});

describe('buildPaperPrompt scope hint', () => {
  const preset = resolvePaperPreset({
    subject_slug: 'physics',
    form_level: 4,
    test_type: 'annual',
    paper: 'theory',
  });

  it('embeds the cumulative scope hint when provided', () => {
    expect(preset).not.toBeNull();
    const prompt = buildPaperPrompt({
      preset: preset!,
      subject: 'Physics',
      topics: ['Force'],
      subtopics: [],
      testTypeLabel: 'Annual Examination',
      referenceContext: '(syllabus only)',
      scopeHint: 'EXAM SCOPE: Cumulative annual at Form 4 - draws from Forms 1 to 4.',
    });
    expect(prompt).toContain('EXAM SCOPE: Cumulative annual at Form 4');
    expect(prompt).toContain('TOTAL MARKS');
  });

  it('renders cleanly without a scope hint', () => {
    expect(preset).not.toBeNull();
    const prompt = buildPaperPrompt({
      preset: preset!,
      subject: 'Physics',
      topics: ['Force'],
      subtopics: [],
      testTypeLabel: 'Annual Examination',
      referenceContext: '(syllabus only)',
    });
    expect(prompt).not.toContain('EXAM SCOPE');
    expect(prompt).toContain(preset!.paper_code);
  });
});