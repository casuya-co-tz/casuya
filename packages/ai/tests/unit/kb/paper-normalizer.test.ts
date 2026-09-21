import { resolvePaperPreset } from '../../../src/kb/paper-presets';
import {
  assemblePaperFromContent,
  buildPlaceholderPaper,
  buildPaperPrompt,
  validateNectaPaper,
} from '../../../server-utils/paper';

describe('paper normalizer', () => {
  it('buildPaperPrompt uses grounded template variables', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'necta_iv',
      paper: 'theory',
    });
    expect(preset).toBeTruthy();
    const prompt = buildPaperPrompt({
      preset: preset!,
      subject: 'PHYSICS',
      topics: ['Force', 'Energy'],
      subtopics: ['Newton laws'],
      testTypeLabel: 'NECTA Form IV',
      referenceContext: 'Sample syllabus excerpt.',
    });
    expect(prompt).toContain('EXAM TYPE: NECTA Form IV');
    expect(prompt).toContain('031/1');
    expect(prompt).toContain('mcq_bundle');
    expect(prompt).toContain('Force; Energy');
    expect(prompt).not.toContain('{{');
  });

  it('buildPlaceholderPaper matches CSEE physics preset structure', () => {
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
      topics: ['Force'],
    });
    const validation = validateNectaPaper(paper, preset);
    if (!validation.valid) throw new Error(validation.issues.join('; '));
    expect(validation.valid).toBe(true);
    expect(paper.header.total_marks).toBe(preset.total_marks);
    const mcqSlot = preset.sections!.flatMap((s) => s.questions).find((q) => q.type === 'mcq_bundle')!;
    const mcq = paper.sections.flatMap((s) => s.questions).find((q) => q.type === 'mcq_bundle');
    expect(mcq?.items).toHaveLength(mcqSlot.item_count ?? 10);
  });

  it('assemblePaperFromContent normalizes matching item counts', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'chemistry',
      form_level: 2,
      test_type: 'necta_ii',
      paper: 'theory',
    })!;
    const matchingSlot = preset.sections!
      .flatMap((s) => s.questions)
      .find((q) => q.type === 'matching')!;
    const paper = assemblePaperFromContent(
      preset,
      {
        sections: preset.sections!.map((sec) => ({
          id: sec.id,
          questions: sec.questions.map((slot) => {
            if (slot.type === 'matching') {
              return {
                type: 'matching',
                stem: 'Match the following:',
                listA: ['A1', 'A2'],
                listB: ['B1', 'B2', 'B3'],
                answers: ['A', 'B'],
              };
            }
            if (slot.type === 'mcq_bundle') {
              return {
                type: 'mcq_bundle',
                items: Array.from({ length: slot.item_count || 10 }, (_, i) => ({
                  number: String(i + 1),
                  text: `Q${i}`,
                  options: { A: 'a', B: 'b', C: 'c', D: 'd' },
                  answer: 'A',
                  marks: 1,
                })),
              };
            }
            const partCount = slot.part_count || 2;
            const base = Math.floor(slot.marks / partCount);
            const rem = slot.marks % partCount;
            return {
              type: slot.type,
              stem: 'Structured question',
              parts: Array.from({ length: partCount }, (_, i) => ({
                label: String.fromCharCode(97 + i),
                text: `Part ${i}`,
                marks: base + (i < rem ? 1 : 0),
              })),
            };
          }),
        })),
      },
      {
        subject: 'CHEMISTRY',
        subjectSlug: 'chemistry',
        formLevel: 2,
        topics: ['Acids'],
        generator: 'test',
      },
    );
    const matching = paper.sections.flatMap((s) => s.questions).find((q) => q.type === 'matching');
    expect(matching?.listA).toHaveLength(matchingSlot.item_count ?? 0);
    expect(matching?.answers).toHaveLength(matchingSlot.item_count ?? 0);
    const validation = validateNectaPaper(paper, preset);
    if (!validation.valid) throw new Error(validation.issues.join('; '));
    expect(validation.valid).toBe(true);
  });

  it('validateNectaPaper rejects wrong mcq_bundle count', () => {
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
      topics: ['Force'],
    });
    const mcq = paper.sections[0]?.questions.find((q) => q.type === 'mcq_bundle');
    if (mcq?.items) mcq.items = mcq.items.slice(0, 5);
    const validation = validateNectaPaper(paper, preset);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((i) => i.includes('mcq_bundle'))).toBe(true);
  });
});
