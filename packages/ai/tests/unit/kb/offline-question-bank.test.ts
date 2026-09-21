import { resolvePaperPreset } from '../../../src/kb/paper-presets';
import { normalizeUnitKey } from '../../../src/kb/offline-question-bank';
import {
  buildPlaceholderPaper,
  countSyntheticQuestions,
  validateNectaPaper,
} from '../../../server-utils/paper';

function collectText(paper: any): string {
  const out: string[] = [];
  for (const sec of paper.sections) {
    for (const q of sec.questions) {
      out.push(String(q.text || ''));
      for (const p of q.parts || []) out.push(String(p.text || ''));
      for (const it of q.items || []) out.push(String(it.text || ''));
      for (const a of q.listA || []) out.push(String(a || ''));
    }
  }
  return out.join(' ').toLowerCase();
}

describe('offline question bank', () => {
  it('normalizes unit keys', () => {
    expect(normalizeUnitKey('Acids, Bases and Salts')).toBe('acids bases and salts');
    expect(normalizeUnitKey('WORK, ENERGY AND POWER')).toBe('work energy and power');
    expect(normalizeUnitKey('NUMBERS')).toBe('numbers');
  });

  it('produces topic-aware maths offline papers that validate', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'mathematics',
      form_level: 4,
      test_type: 'topical',
      paper: 'theory',
    })!;
    const paper = buildPlaceholderPaper(preset, {
      subject: 'Basic Mathematics',
      subjectSlug: 'mathematics',
      formLevel: 4,
      topics: ['NUMBERS'],
    });
    const validation = validateNectaPaper(paper, preset);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
    expect(countSyntheticQuestions(paper).count).toBe(0);

    const text = collectText(paper);
    expect(text).not.toMatch(/question \d+/);
    expect(text).not.toMatch(/question on /);
    expect(text).toMatch(/order of operations|market|prices/);
  });

  it('avoids legacy generic stems', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'mathematics',
      form_level: 2,
      test_type: 'topical',
      paper: 'theory',
    })!;
    const paper = buildPlaceholderPaper(preset, {
      subject: 'Basic Mathematics',
      subjectSlug: 'mathematics',
      formLevel: 2,
      topics: ['Numbers'],
    });
    const text = collectText(paper);
    expect(text).not.toMatch(/question \d+/);
    expect(text).not.toMatch(/question on /);
    expect(text).toMatch(/order of operations|prime factor|market/);
  });

  it('spreads multiple topics across paper slots', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'necta_iv',
      paper: 'theory',
    })!;
    const paper = buildPlaceholderPaper(preset, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force', 'Energy', 'Pressure', 'Linear Motion'],
    });
    const text = collectText(paper);
    const hits = ['force', 'energy', 'pressure', 'motion'].filter((k) => text.includes(k));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('physics offline paper is valid and non-synthetic', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'topical',
      paper: 'theory',
    })!;
    const paper = buildPlaceholderPaper(preset, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    });
    const validation = validateNectaPaper(paper, preset);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
    expect(countSyntheticQuestions(paper).count).toBe(0);
  });

  it('chemistry offline paper keeps matching structure', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'chemistry',
      form_level: 2,
      test_type: 'necta_ii',
      paper: 'theory',
    })!;
    const paper = buildPlaceholderPaper(preset, {
      subject: 'CHEMISTRY',
      subjectSlug: 'chemistry',
      formLevel: 2,
      topics: ['Matter'],
    });
    const validation = validateNectaPaper(paper, preset);
    expect(validation.valid).toBe(true);
    const match = paper.sections.flatMap((s) => s.questions).find((q) => q.type === 'matching');
    expect(match?.listA).toHaveLength(5);
    expect(match?.answers).toHaveLength(5);
  });

  it('offline papers are deterministic for the same input', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'mathematics',
      form_level: 4,
      test_type: 'topical',
      paper: 'theory',
    })!;
    const args = {
      subject: 'Basic Mathematics',
      subjectSlug: 'mathematics',
      formLevel: 4,
      topics: ['NUMBERS'],
    };
    const a = buildPlaceholderPaper(preset, args);
    const b = buildPlaceholderPaper(preset, args);
    expect(JSON.stringify(a.sections)).toBe(JSON.stringify(b.sections));
  });
});