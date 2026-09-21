import { resolvePaperPreset } from '../../../src/kb/paper-presets';
import {
  assemblePaperFromContent,
  buildPlaceholderPaper,
  buildPaperPrompt,
  countSyntheticQuestions,
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

  it('assemblePaperFromContent reconciles part marks to question total', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'necta_iv',
      paper: 'theory',
    })!;
    const paper = assemblePaperFromContent(
      preset,
      {
        sections: preset.sections!.map((sec) => ({
          id: sec.id,
          questions: sec.questions.map((slot) => {
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
            if (slot.type === 'matching') {
              const count = slot.item_count || 5;
              return {
                type: 'matching',
                stem: 'Match the following:',
                listA: Array.from({ length: count }, (_, i) => `A${i + 1}`),
                listB: Array.from({ length: count + 2 }, (_, i) => `B${i + 1}`),
                answers: Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)),
              };
            }
            const count = slot.part_count || 2;
            return {
              type: slot.type,
              stem: 'Structured question',
              parts: Array.from({ length: count }, (_, i) => ({
                label: String.fromCharCode(97 + i),
                text: `Part ${i}`,
                marks: 7,
              })),
            };
          }),
        })),
      },
      {
        subject: 'PHYSICS',
        subjectSlug: 'physics',
        formLevel: 4,
        topics: ['Force'],
        generator: 'test',
      },
    );
    const validation = validateNectaPaper(paper, preset);
    if (!validation.valid) throw new Error(validation.issues.join('; '));
    expect(validation.valid).toBe(true);
    const partQuestions = paper.sections
      .flatMap((s) => s.questions)
      .filter((q) => q.parts?.length);
    for (const q of partQuestions) {
      expect(q.parts!.reduce((n, p) => n + p.marks, 0)).toBe(q.marks);
    }
  });

  it('countSyntheticQuestions flags empty slots after assembly', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'mathematics',
      form_level: 2,
      test_type: 'necta_ii',
      paper: 'theory',
    })!;
    const srcQs = preset.flat_questions!.map((slot, i) => {
      if (i === 2 || i === 3) return {};
      return {
        type: slot.type,
        stem: `Solve problem ${i + 1} about ratios.`,
        parts: [
          { label: 'a', text: `(a) Show the working for ${i + 1}.`, marks: 5 },
          { label: 'b', text: `(b) State the answer for ${i + 1}.`, marks: 5 },
        ],
      };
    });
    const paper = assemblePaperFromContent(
      preset,
      { questions: srcQs },
      { subject: 'MATHEMATICS', subjectSlug: 'mathematics', formLevel: 2, topics: ['Rates'], generator: 'test' },
    );
    const synthetic = countSyntheticQuestions(paper);
    expect(synthetic.count).toBe(2);
    expect(synthetic.numbers).toEqual([3, 4]);
  });

  it('countSyntheticQuestions passes fully-filled and offline papers', () => {
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
    expect(countSyntheticQuestions(paper).count).toBe(0);
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
