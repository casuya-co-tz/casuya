import { resolvePaperPreset } from '../../../src/kb/paper-presets';
import { offlineContentForSlot } from '../../../src/kb/offline-question-bank';
import {
  assemblePaperFromContent,
  buildMarkingSchemeFromPaper,
  countSyntheticQuestions,
  isSyntheticQuestion,
  salvageSyntheticQuestions,
} from '../../../server-utils/paper';
import { ExamPaper, PaperPreset } from '../../../src/kb/paper-types';

let PRESET: PaperPreset | null = null;

function preset(): PaperPreset {
  PRESET =
    PRESET ||
    resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'necta_iv',
      paper: 'theory',
    });
  if (!PRESET) throw new Error('physics necta_iv theory preset missing');
  return PRESET;
}

function assembleFrom(opts: {
  preset: PaperPreset;
  blankSection: number;
  blankIndex: number;
}): ExamPaper {
  const { preset: p, blankSection, blankIndex } = opts;
  const topic = 'Force';
  let slotIndex = 0;
  const parsed = {
    sections: p.sections?.map((sec, si) => ({
      id: sec.id,
      questions: sec.questions.map((slot, qi) => {
        const idx = slotIndex;
        slotIndex += 1;
        if (si === blankSection && qi === blankIndex) {
          return { text: 'Empty question', parts: [] };
        }
        return offlineContentForSlot(slot, {
          subjectSlug: 'physics',
          subjectName: 'PHYSICS',
          topic,
          seed: idx,
        });
      }),
    })),
  };
  return assemblePaperFromContent(p, parsed, {
    subject: 'PHYSICS',
    subjectSlug: 'physics',
    formLevel: 4,
    topics: [topic],
    generator: 'casuya-ai',
  });
}

describe('salvageSyntheticQuestions', () => {
  it('replaces only flagged placeholder questions with real bank content', () => {
    const p = preset();
    const paper = assembleFrom({ preset: p, blankSection: 1, blankIndex: 1 });
    const before = countSyntheticQuestions(paper);
    expect(before.count).toBe(1);
    expect(isSyntheticQuestion(paper.sections[1].questions[1])).toBe(true);

    const salvaged = salvageSyntheticQuestions(paper, p, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    });

    expect(salvaged.replaced).toBe(1);
    expect(salvaged.numbers).toEqual([]);
    expect(countSyntheticQuestions(salvaged.paper).count).toBe(0);
    expect(isSyntheticQuestion(salvaged.paper.sections[1].questions[1])).toBe(false);
    expect(String(salvaged.paper.sections[1].questions[1].text)).not.toBe('Empty question');
    expect(String(salvaged.paper.sections[1].questions[1].text).length).toBeGreaterThan(10);
  });

  it('preserves question numbers, order and marks', () => {
    const p = preset();
    const paper = assembleFrom({ preset: p, blankSection: 1, blankIndex: 0 });
    const allBefore = paper.sections.flatMap((s) => s.questions);
    const beforeNumbers = allBefore.map((q) => q.number);
    const target = allBefore.find((q) => isSyntheticQuestion(q))!;

    const salvaged = salvageSyntheticQuestions(paper, p, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    });
    const after = salvaged.paper.sections.flatMap((s) => s.questions);
    expect(after.map((q) => q.number)).toEqual(beforeNumbers);
    const savedIndex = after.findIndex((_q, i) => isSyntheticQuestion(allBefore[i]));
    expect(savedIndex).toBeGreaterThanOrEqual(0);
    expect(after[savedIndex].marks).toBe(target.marks);
    expect(String(after[savedIndex].text)).not.toBe('');
  });

  it('keeps a fully-clean paper untouched', () => {
    const p = preset();
    const paper = assembleFrom({ preset: p, blankSection: -1, blankIndex: -1 });
    expect(countSyntheticQuestions(paper).count).toBe(0);

    const salvaged = salvageSyntheticQuestions(paper, p, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    });
    expect(salvaged.replaced).toBe(0);
  });

  it('salvaged paper still builds a valid marking scheme', () => {
    const p = preset();
    const paper = assembleFrom({ preset: p, blankSection: 1, blankIndex: 1 });
    const salvaged = salvageSyntheticQuestions(paper, p, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    });
    const scheme = buildMarkingSchemeFromPaper(salvaged.paper, {});
    expect(scheme).toBeTruthy();
    expect(countSyntheticQuestions(salvaged.paper).count).toBe(0);
  });
});