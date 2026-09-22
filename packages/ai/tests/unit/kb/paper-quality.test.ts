import { resolvePaperPreset } from '../../../src/kb/paper-presets';
import { offlineContentForSlot } from '../../../src/kb/offline-question-bank';
import {
  applyAnswersToScheme,
  buildAnswersCompletionPrompt,
  buildCritiquePrompt,
  buildRevisionPrompt,
  detectDuplicateQuestions,
  findMissingSchemeAnswers,
  isLabelsOnlyAnswer,
  marksDiscrepancy,
  needsRevision,
  parseAnswersCompletion,
  parseCritiqueResponse,
  replaceQuestionsFromBank,
  serializePaper,
} from '../../../server-utils/paper-quality';
import { buildMarkingSchemeFromPaper, assemblePaperFromContent } from '../../../server-utils/paper';
import { ExamPaper, MarkingScheme, PaperPreset } from '../../../src/kb/paper-types';

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

function cleanPaper(): ExamPaper {
  const p = preset();
  let slotIndex = 0;
  const parsed = {
    sections: p.sections?.map((sec) => ({
      id: sec.id,
      questions: sec.questions.map((slot) => {
        const idx = slotIndex;
        slotIndex += 1;
        return offlineContentForSlot(slot, {
          subjectSlug: 'physics',
          subjectName: 'PHYSICS',
          topic: 'Force',
          seed: idx,
        });
      }),
    })),
  };
  return assemblePaperFromContent(p, parsed, {
    subject: 'PHYSICS',
    subjectSlug: 'physics',
    formLevel: 4,
    topics: ['Force'],
    generator: 'casuya-ai',
  });
}

describe('parseCritiqueResponse', () => {
  it('parses a plain JSON critique', () => {
    const c = parseCritiqueResponse(
      '{"score": 62, "issues": [{"question": "Q3(a)", "severity": "high", "problem": "missing working", "fix": "add steps"}]}',
    );
    expect(c).not.toBeNull();
    expect(c!.score).toBe(62);
    expect(c!.issues).toHaveLength(1);
    expect(c!.issues[0].severity).toBe('high');
  });

  it('extracts JSON from a fenced response', () => {
    const c = parseCritiqueResponse('```json\n{"score": 91, "issues": []}\n```');
    expect(c!.score).toBe(91);
    expect(c!.issues).toEqual([]);
  });

  it('returns null for garbage', () => {
    expect(parseCritiqueResponse('')).toBeNull();
    expect(parseCritiqueResponse('not json at all')).toBeNull();
  });

  it('clamps score to 0..100 and defaults severity', () => {
    const c = parseCritiqueResponse('{"score": 900, "issues": [{"problem": "x"}]}');
    expect(c!.score).toBe(100);
    expect(c!.issues[0].severity).toBe('low');
  });

  it('skips issues without a problem', () => {
    const c = parseCritiqueResponse('{"score": 50, "issues": [{"severity": "high"}, {"problem": "real"}]}');
    expect(c!.issues).toHaveLength(1);
  });
});

describe('needsRevision', () => {
  it('rejects null critiques without revision', () => {
    expect(needsRevision(null)).toEqual({ yes: false, reasons: ['no critique parsed'] });
  });

  it('asks for revision when the score is low', () => {
    const r = needsRevision({ score: 60, issues: [{ severity: 'medium', problem: 'x', fix: '' }] });
    expect(r.yes).toBe(true);
  });

  it('asks for revision on any high-severity problem', () => {
    const r = needsRevision({ score: 96, issues: [{ severity: 'high', problem: 'wrong answer', fix: '' }] });
    expect(r.yes).toBe(true);
  });

  it('accepts a clean high score', () => {
    const r = needsRevision({ score: 95, issues: [] });
    expect(r.yes).toBe(false);
  });
});

describe('buildCritiquePrompt / buildRevisionPrompt', () => {
  it('embeds the expected marks and the paper JSON', () => {
    const p = preset();
    const prompt = buildCritiquePrompt('PHYSICS', '{"paper":true}', '', p.total_marks, p.paper_title);
    expect(prompt).toContain(String(p.total_marks));
    expect(prompt).toContain('{"paper":true}');
    expect(prompt).toContain('NECTA');
  });

  it('revision prompt lists the critic issues and forbids mark changes', () => {
    const prompt = buildRevisionPrompt(
      'PHYSICS',
      '{"paper":true}',
      { score: 40, issues: [{ question: 'Q2', severity: 'high', problem: 'duplicate stem', fix: 'reword' }] },
      100,
      'Physics Paper 1',
    );
    expect(prompt).toContain('Q2');
    expect(prompt).toContain('duplicate stem');
    expect(prompt).toContain('exactly 100 marks');
    expect(prompt).toContain('{"paper":true}');
  });
});

describe('detectDuplicateQuestions', () => {
  const base: ExamPaper = {
    kind: 'necta',
    header: { subject: 'PHYSICS', subject_code: 'P1', duration: '3h', total_marks: 100, instructions: [] },
    sections: [
      { id: 'A', title: 'A', instruction: '', marks: 20, questions: [
        { number: 1, type: 'structured', marks: 10, text: 'Define force and state its SI unit.', parts: [{ label: 'a', text: 'Define force and state its SI unit.', marks: 5 }] },
        { number: 2, type: 'structured', marks: 10, text: 'Define force and state its SI unit.', parts: [{ label: 'a', text: 'Define force and state its SI unit.', marks: 5 }, { label: 'b', text: 'Give two effects.', marks: 5 }] },
        { number: 3, type: 'structured', marks: 10, text: 'Explain momentum conservation.', parts: [{ label: 'a', text: 'Explain momentum conservation.', marks: 10 }] },
      ] },
    ],
  };

  it('flags near-identical stems', () => {
    const pairs = detectDuplicateQuestions(base);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0].a).toBe('Q1');
    expect(pairs[0].b).toBe('Q2');
    expect(pairs[0].overlap).toBeGreaterThanOrEqual(0.65);
  });

  it('does not flag distinct questions', () => {
    const pairs = detectDuplicateQuestions({ ...base, sections: [{ ...base.sections[0], questions: [base.sections[0].questions[2]] }] });
    expect(pairs).toEqual([]);
  });
});

describe('findMissingSchemeAnswers', () => {
  const paper: ExamPaper = {
    kind: 'necta',
    header: { subject: 'PHYSICS', subject_code: 'P1', duration: '3h', total_marks: 30, instructions: [] },
    sections: [
      { id: 'A', title: 'A', instruction: '', marks: 30, questions: [
        { number: 1, type: 'structured', marks: 10, text: 'Q1', parts: [{ label: 'a', text: 'Explain.', marks: 5 }, { label: 'b', text: 'Why?', marks: 5 }] },
        { number: 2, type: 'mcq_bundle', marks: 4, items: [{ number: 'i', text: 'Which?', options: { A: '1', B: '2' }, answer: '', marks: 1 }] },
      ] },
    ],
  };

  const scheme = buildMarkingSchemeFromPaper(paper, {});

  it('flags label-only and emptied answers', () => {
    const missing = findMissingSchemeAnswers(paper, scheme);
    const j = missing.find((m) => m.question === '1');
    const i = missing.find((m) => m.question === '2');
    expect(j).toBeTruthy();
    expect(i).toBeTruthy();
  });

  it('keeps substantive answers', () => {
    const full: MarkingScheme = {
      ...scheme,
      sections: [
        { name: 'A', marks: 30, questions: [
          { number: 1, marks: 10, answer_html: '<p>The answer explains the key points with solid reasoning.</p>' },
        ] },
      ],
    };
    expect(findMissingSchemeAnswers(paper, full)).toEqual([]);
  });
});

describe('isLabelsOnlyAnswer', () => {
  it('detects part-label placeholders with marks', () => {
    expect(isLabelsOnlyAnswer('(a) [2 marks] (b) [3 marks]')).toBe(true);
    expect(isLabelsOnlyAnswer('(a) [2 marks] See examiner guidance')).toBe(false);
    expect(isLabelsOnlyAnswer('<p>The force equals mass times acceleration.</p>')).toBe(false);
    expect(isLabelsOnlyAnswer('')).toBe(true);
  });
});

describe('parseAnswersCompletion / applyAnswersToScheme', () => {
  it('completion prompt lists the missing question labels', () => {
    const prompt = buildAnswersCompletionPrompt('PHYSICS', '{"paper":true}', [{ question: '4', section: 'SECTION B', marks: 6 }], 'Physics Paper 1');
    expect(prompt).toContain('Q4');
    expect(prompt).toContain('SECTION B');
    expect(prompt).toContain('6 marks');
    expect(prompt).toContain('{"paper":true}');
  });

  it('parses completed answers and merges them into a scheme', () => {
    const completed = parseAnswersCompletion('{"answers": [{"question": "Q1", "answer_html": "<p>Model answer</p>"}]}');
    expect(completed).toHaveLength(1);
    expect(completed[0].question).toBe('Q1');

    const scheme: MarkingScheme = {
      code: 'P1',
      subject: 'PHYSICS',
      max_marks: 10,
      sections: [{ name: 'A', marks: 10, questions: [{ number: 1, marks: 10, answer_html: 'See examiner guidance.' }] }],
    };
    const merged = applyAnswersToScheme(scheme, completed);
    expect(merged.sections[0].questions[0].answer_html).toBe('<p>Model answer</p>');
  });

  it('ignores unparseable input', () => {
    expect(parseAnswersCompletion('nope')).toEqual([]);
    expect(applyAnswersToScheme({ code: 'P1', sections: [] }, [])).toEqual({ code: 'P1', sections: [] });
  });
});

describe('marksDiscrepancy', () => {
  it('compares paper total against preset total', () => {
    const p = preset();
    const paper = cleanPaper();
    const d = marksDiscrepancy(paper, p);
    expect(typeof d.paperTotal).toBe('number');
    expect(d.presetTotal).toBe(p.total_marks);
    expect(d.equal).toBe(d.paperTotal === p.total_marks);
  });
});

describe('replaceQuestionsFromBank', () => {
  it('replaces forced numbers with offline-bank content', () => {
    const p = preset();
    const paper = cleanPaper();
    const targetIndex = paper.sections[1].questions[0];
    const target = targetIndex.number;
    const bogus = 'A rushed replacement stem about momentum splices.';
    const mutated = {
      ...paper,
      sections: (paper.sections as any[]).map((sec, si) =>
        si !== 1
          ? sec
          : {
              ...sec,
              questions: sec.questions.map((q: any) =>
                String(q.number) !== String(target)
                  ? q
                  : { ...q, text: bogus, parts: (q.parts || []).map((part: any) => ({ label: part.label, text: `${bogus} (part ${part.label})`, marks: part.marks })) },
              ),
            },
      ),
    };

    const swapped = replaceQuestionsFromBank(mutated, p, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    }, [target]);

    expect(swapped.replaced).toBeGreaterThanOrEqual(1);
    expect(String(swapped.paper.sections[1].questions[0].number)).toBe(String(target));
    expect(String(swapped.paper.sections[1].questions[0].text)).not.toContain(bogus);
    expect(String(swapped.paper.sections[1].questions[0].text).length).toBeGreaterThan(10);
  });

  it('does nothing for an empty number list', () => {
    const p = preset();
    const paper = cleanPaper();
    const swapped = replaceQuestionsFromBank(paper, p, {
      subject: 'PHYSICS',
      subjectSlug: 'physics',
      formLevel: 4,
      topics: ['Force'],
    }, []);
    expect(swapped.replaced).toBe(0);
    expect(swapped.paper).toBe(paper);
  });
});

describe('serializePaper', () => {
  it('returns compact JSON for a valid paper', () => {
    const paper = cleanPaper();
    const json = serializePaper(paper);
    expect(json).toContain('sections');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});