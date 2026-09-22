import { CasuyaAI } from '../src/casuya-ai';
import {
  getKnowledgeBase,
  SearchOptions,
  examTypeToKbFilter,
  isTestExamType,
  TEST_EXAM_TYPE_LABELS,
  TestExamType,
  effectiveFormForTest,
  cumulativeFormRange,
  fallbackTestQuery,
} from '../src/kb';
import {
  listAvailablePapers,
  resolvePaperPreset,
} from '../src/kb/paper-presets';
import { PaperVariant } from '../src/kb/paper-types';
import { ProviderFactory } from '../src/providers/provider-factory';
import {
  buildQueryVariants,
  buildWebQuery,
  formLevelLabel,
  formatWebContext,
  isKbThin,
  searchWebContext,
  webSearchEnabled,
  WebSearchDoc,
} from '../src/rag/web-search';
import { resolveSubject } from '../server';
import {
  applyAnswersToScheme,
  buildAnswersCompletionPrompt,
  buildCritiquePrompt,
  buildRevisionPrompt,
  detectDuplicateQuestions,
  findMissingSchemeAnswers,
  marksDiscrepancy,
  needsRevision,
  parseAnswersCompletion,
  parseCritiqueResponse,
  replaceQuestionsFromBank,
  serializePaper,
} from '../server-utils/paper-quality';
import {
  assemblePaperFromContent,
  buildMarkingSchemeFromPaper,
  buildPaperPrompt,
  buildPlaceholderPaper,
  countSyntheticQuestions,
  parsePaperJson,
  salvageSyntheticQuestions,
  validateNectaPaper,
} from '../server-utils/paper';

/** Low sampling temperature — grounded, no verbatim copying. */
const TEST_TEMPERATURE = 0.15;

function parsePaperVariant(value: unknown): PaperVariant {
  const v = String(value || 'theory').toLowerCase();
  if (v === 'theory_2' || v === 'theory2') return 'theory_2';
  if (v === 'practical') return 'practical';
  return 'theory';
}

function retrieveTestContext(body: any): { ragText: string; kbHits: unknown[] } {
  const kb = getKnowledgeBase();
  const empty = { ragText: '', kbHits: [] };
  if (!kb.ready) return empty;

  const testType: TestExamType = isTestExamType(body.test_type) ? body.test_type : 'topical';
  const subject = String(body.subject_slug || '').trim() || undefined;
  const formLevel = Number(body.form_level);
  const validForm = effectiveFormForTest(testType, formLevel);
  const topics = (Array.isArray(body.topics) ? body.topics : [])
    .map((t: unknown) => String(t || '').trim())
    .filter(Boolean);
  const subtopics = (Array.isArray(body.subtopics) ? body.subtopics : [])
    .map((t: unknown) => String(t || '').trim())
    .filter(Boolean);
  const topicQuery = [
    String(body.topic || ''),
    ...topics,
    String(body.subtopic || ''),
    ...subtopics,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  // Full-form exams may be generated with no topics ticked — ground on
  // subject + exam type so KB exam papers are still retrieved.
  const query = topicQuery || fallbackTestQuery(subject, TEST_EXAM_TYPE_LABELS[testType]);
  if (!query) return empty;

  const maxChars = Number(process.env.KB_RAG_MAX_CHARS) || 9000;
  const filter = examTypeToKbFilter(testType, validForm);
  const paper = parsePaperVariant(body.paper);

  // Cumulative internal exams (midterm/terminal/annual) draw from the whole
  // form band of their NECTA level, not just the current class. National
  // exams already search the entire level corpus. Topical stays form-scoped.
  const CUMULATIVE_INTERNAL = ['midterm', 'terminal', 'annual'];

  const examOpts: SearchOptions = {
    subject,
    kind: ['exam'],
    limit: 4,
  };
  if (filter?.level) examOpts.level = filter.level;
  if (CUMULATIVE_INTERNAL.includes(testType)) {
    examOpts.formNumbers = cumulativeFormRange(validForm);
  } else {
    if (filter?.file) examOpts.file = filter.file;
    if (validForm && !filter?.level) examOpts.formNumber = validForm;
  }

  let rag = kb.buildRagContext(query, examOpts, maxChars);

  if (!rag.docs.length) {
    rag = kb.buildRagContext(
      query,
      {
        subject,
        kind: ['syllabus', 'scheme', 'lesson', 'exam_format', 'marking_scheme'],
        limit: 5,
      },
      maxChars,
    );
  }

  if (paper === 'practical') {
    const practicalRag = kb.buildRagContext(
      `${query} practical experiment apparatus`,
      { subject, kind: ['syllabus', 'scheme', 'lesson'], limit: 3 },
      Math.floor(maxChars / 2),
    );
    if (practicalRag.text) {
      rag = { text: `${rag.text}\n\nPRACTICAL CONTEXT:\n${practicalRag.text}`, docs: [...rag.docs, ...practicalRag.docs] };
    }
  }

  return {
    ragText: rag.text,
    kbHits: rag.docs.map((d) => {
      const doc = kb.getDoc(d.docId);
      return {
        title: d.title,
        kind: d.kind,
        subject: d.subject,
        level: doc?.level || null,
        file: doc?.file || null,
      };
    }),
  };
}

export function handleTestPresets(body: any): unknown {
  const subjectSlug = String(body.subject_slug || '').toLowerCase();
  const formLevel = Number(body.form_level);
  const testType: TestExamType = isTestExamType(body.test_type) ? body.test_type : 'topical';
  // National exam types own their form; don't let the client relabel them.
  const effectiveForm = effectiveFormForTest(testType, formLevel);
  if (!subjectSlug || !Number.isInteger(effectiveForm) || effectiveForm < 1 || effectiveForm > 6) {
    return { presets: [], error: 'subject_slug and form_level (1-6) required' };
  }
  const presets = listAvailablePapers({ subject_slug: subjectSlug, form_level: effectiveForm, test_type: testType });
  return { presets, testType, formLevel: effectiveForm };
}

/** Tell the model the real cumulative scope of the exam it is writing. */
function buildScopeHint(testType: TestExamType, testTypeLabel: string, validForm: number): string {
  if (testType === 'necta_ii' || testType === 'necta_iv' || testType === 'necta_vi') {
    const band = validForm >= 5 ? 'Forms 5 to 6 (A-Level)' : 'Forms 1 to 4 (O-Level)';
    return `EXAM SCOPE: Cumulative ${testTypeLabel} - the whole NECTA band (${band}) applies. Questions may draw knowledge from earlier forms of the band, not only Form ${validForm}.`;
  }
  if (['midterm', 'terminal', 'annual'].includes(testType)) {
    const range = cumulativeFormRange(validForm);
    return `EXAM SCOPE: Cumulative ${testTypeLabel.toLowerCase()} at Form ${validForm} - this exam draws from earlier forms too (Forms ${range[0]} to ${range[range.length - 1]} of this level).`;
  }
  return 'EXAM SCOPE: Focused topical test - cover only the requested topics.';
}

async function generatePaperWithAi(
  preset: NonNullable<ReturnType<typeof resolvePaperPreset>>,
  args: {
    subject: string;
    subjectSlug: string;
    formLevel: number;
    topics: string[];
    subtopics: string[];
    testTypeLabel: string;
    ragText: string;
    scopeHint: string;
  },
): Promise<{ paper: ReturnType<typeof assemblePaperFromContent>; markingScheme: ReturnType<typeof buildMarkingSchemeFromPaper> } | null> {
  const provider = ProviderFactory.getProvider('failover') || ProviderFactory.getProvider('local');
  if (!provider) return null;

  const prompt = buildPaperPrompt({
    preset,
    subject: args.subject,
    topics: args.topics,
    subtopics: args.subtopics,
    testTypeLabel: args.testTypeLabel,
    referenceContext: args.ragText,
    scopeHint: args.scopeHint,
  });

  const slotCount = preset.flat_questions?.length
    || preset.sections?.reduce((n, s) => n + s.questions.length, 0)
    || 10;
  const maxTokens = Math.min(16000, Math.max(6000, slotCount * 750));
  const qualityLoop = String(process.env.PAPER_QUALITY_LOOP || 'on').toLowerCase() !== 'off';
  const paperTitle = `${preset.paper_code} ${preset.paper_title}`.trim();

  const result = await provider.chatCompletion({
    messages: [
      { role: 'system', content: 'You are a Tanzanian NECTA examination setter. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: TEST_TEMPERATURE,
    maxTokens,
  });

  const parsed = parsePaperJson(result.content);
  if (!parsed) {
    console.warn(
      `[tests/generate] paper draft unparseable even after truncation repair, falling back to offline bank ` +
        `(content length ${String(result.content || '').length}, finish=${result.finishReason || 'unknown'})`,
    );
    return null;
  }
  if (result.finishReason === 'length') {
    console.warn('[tests/generate] model hit output token cap; salvaged truncated paper JSON');
  }

  const assemble = (raw: any) =>
    assemblePaperFromContent(preset, raw, {
      subject: args.subject,
      subjectSlug: args.subjectSlug,
      formLevel: args.formLevel,
      topics: args.topics,
      generator: 'casuya-ai',
    });

  /** Validate, salvage placeholders, and reject if anything is still broken. */
  const accept = (paper: ReturnType<typeof assemblePaperFromContent>): ReturnType<typeof assemblePaperFromContent> | null => {
    const validation = validateNectaPaper(paper, preset);
    if (!validation.valid) {
      console.warn('[tests/generate] assembled paper failed validation:', validation.issues);
      return null;
    }
    const synthetic = countSyntheticQuestions(paper);
    if (synthetic.count > 0) {
      const salvaged = salvageSyntheticQuestions(paper, preset, {
        subject: args.subject,
        subjectSlug: args.subjectSlug,
        formLevel: args.formLevel,
        topics: args.topics,
      });
      if (salvaged.replaced > 0) {
        console.warn(`[tests/generate] salvaged ${salvaged.replaced} placeholder question(s) from offline bank (Q${salvaged.numbers.join(', Q')})`);
      }
      if (salvaged.replaced === 0 || countSyntheticQuestions(salvaged.paper).count > 0) {
        console.warn(
          `[tests/generate] draft rejected: ${countSyntheticQuestions(paper).count} placeholder question(s) remain after salvage`,
        );
        return null;
      }
      return salvaged.paper;
    }
    return paper;
  };

  let finalPaper = accept(assemble(parsed));
  if (!finalPaper) {
    console.warn('[tests/generate] draft failed accept gate (validation or unresolvable placeholders)');
    return null;
  }
  let finalParsed = parsed;

  // "Super" quality loop: the critic re-reads the draft, then one bounded
  // revision pass fixes only what the critic flagged. Any step may fail
  // silently (network/heat/cost) and we still serve the draft.
  if (qualityLoop) {
    const criticJson = serializePaper(finalPaper);
    if (criticJson) {
      try {
        const criticPrompt = buildCritiquePrompt(args.subject, criticJson, args.ragText, preset.total_marks, paperTitle);
        const criticResult = await provider.chatCompletion({
          messages: [
            { role: 'system', content: 'You are a strict NECTA chief examiner. Reply with valid JSON only.' },
            { role: 'user', content: criticPrompt },
          ],
          temperature: 0.1,
          maxTokens: 2000,
        });
        const critique = parseCritiqueResponse(criticResult.content);
        if (critique) {
          const need = needsRevision(critique);
          console.warn(
            `[tests/generate] quality: critic score ${critique.score}/100, ${critique.issues.length} issue(s)${need.yes ? ` -> revising (${need.reasons.join('; ')})` : ''}`,
          );
          if (need.yes) {
            const revPrompt = buildRevisionPrompt(args.subject, criticJson, critique, preset.total_marks, paperTitle);
            const revResult = await provider.chatCompletion({
              messages: [
                { role: 'system', content: 'You are a meticulous NECTA examiner. Output only the corrected paper JSON.' },
                { role: 'user', content: revPrompt },
              ],
              temperature: TEST_TEMPERATURE,
              maxTokens,
            });
            const revParsed = parsePaperJson(revResult.content);
            if (revParsed) {
              const revised = accept(assemble(revParsed));
              if (revised && JSON.stringify(revised) !== JSON.stringify(finalPaper)) {
                finalPaper = revised;
                finalParsed = revParsed;
                console.warn('[tests/generate] quality: revision accepted');
              }
            }
          }
        }
      } catch (err) {
        console.warn('[tests/generate] quality loop skipped:', err);
      }
    }
  }

  // Dedup: drop near-identical stems that slipped through, swapping in bank content.
  const dups = detectDuplicateQuestions(finalPaper);
  if (dups.length) {
    const secondNumbers = dups.map((d) => {
      const bare = String(d.b).replace(/^q/i, '');
      return /^\d+$/.test(bare) ? Number(bare) : bare;
    });
    const swapped = replaceQuestionsFromBank(finalPaper, preset, {
      subject: args.subject,
      subjectSlug: args.subjectSlug,
      formLevel: args.formLevel,
      topics: args.topics,
    }, secondNumbers);
    if (swapped.replaced > 0) {
      finalPaper = swapped.paper;
      console.warn(
        `[tests/generate] quality: replaced ${swapped.replaced} duplicated question(s) from offline bank (${dups.map((d) => `${d.a}~${d.b} ${d.overlap}`).join(', ')})`,
      );
    }
  }

  let markingScheme = buildMarkingSchemeFromPaper(finalPaper, finalParsed);

  // Guarantee model answers: fill any empty/stub scheme entries in one pass.
  const missingAnswers = findMissingSchemeAnswers(finalPaper, markingScheme);
  if (qualityLoop && missingAnswers.length) {
    try {
      const ansPrompt = buildAnswersCompletionPrompt(args.subject, serializePaper(finalPaper), missingAnswers, paperTitle);
      const ansResult = await provider.chatCompletion({
        messages: [
          { role: 'system', content: 'You are a NECTA examiner composing model answers. Reply with valid JSON only.' },
          { role: 'user', content: ansPrompt },
        ],
        temperature: 0.2,
        maxTokens: 4000,
      });
      const completed = parseAnswersCompletion(ansResult.content);
      if (completed.length) {
        markingScheme = applyAnswersToScheme(markingScheme, completed);
        console.warn(`[tests/generate] quality: completed ${completed.length} missing model answer(s)`);
      }
    } catch (err) {
      console.warn('[tests/generate] quality: answer completion skipped:', err);
    }
  }

  const marks = marksDiscrepancy(finalPaper, preset);
  if (!marks.equal) {
    console.warn(`[tests/generate] quality: mark total ${marks.paperTotal} != preset ${marks.presetTotal}`);
  }

  return { paper: finalPaper, markingScheme };
}

export async function handleTestGenerate(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  void ai;
  const testType: TestExamType = isTestExamType(body.test_type) ? body.test_type : 'topical';
  const testTypeLabel = TEST_EXAM_TYPE_LABELS[testType];
  const subject = resolveSubject(body.subject_slug);
  const subjectSlug = String(body.subject_slug || '').toLowerCase();
  const formLevel = Number(body.form_level);
  // National types own their form; never let the body mislabel an exam.
  const validForm = effectiveFormForTest(testType, formLevel);
  const scopeHint = buildScopeHint(testType, testTypeLabel, validForm);
  const paperVariant = parsePaperVariant(body.paper);

  if (subjectSlug === 'mathematics' && paperVariant === 'practical') {
    return { error: 'Mathematics has no practical paper', paper: null };
  }

  const topics = (Array.isArray(body.topics) ? body.topics : [])
    .map((t: unknown) => String(t || '').trim())
    .filter(Boolean)
    .slice(0, 30);
  const subtopics = (Array.isArray(body.subtopics) ? body.subtopics : [])
    .map((t: unknown) => String(t || '').trim())
    .filter(Boolean)
    .slice(0, 30);
  const topic =
    String(body.topic || '').trim() || topics[0] || `${subject.name} ${testTypeLabel.toLowerCase()}`;

  const preset = resolvePaperPreset({
    subject_slug: subjectSlug,
    form_level: validForm,
    test_type: testType,
    paper: paperVariant,
  });

  if (!preset) {
    return { error: 'No preset for subject/form/paper combination', paper: null };
  }

  const kbCtx = retrieveTestContext(body);
  let ragText = kbCtx.ragText;
  const kbHits = kbCtx.kbHits;
  const allTopics = topics.length ? topics : [topic];
  const formLabel = formLevelLabel(validForm);

  // "Super" grounding: when the KB found nothing for the topic, enrich from the
  // web (only if a search key is configured). Fans out to one query per topic,
  // asks the provider for a synthesized answer, and dedupes by URL. Any web
  // failure is ignored.
  let webHits: WebSearchDoc[] = [];
  let webSourced = false;
  if (webSearchEnabled() && isKbThin(kbCtx.kbHits)) {
    const query = buildWebQuery({
      subject: subject.name || subject.enumValue,
      subjectSlug,
      formLabel,
      testTypeLabel,
      topic,
      topics,
      subtopics,
      paper: paperVariant,
    });
    const variants = buildQueryVariants(query, topics, subtopics);
    const { docs, answers } = await searchWebContext(variants, { limit: 6 });
    webHits = docs;
    if (webHits.length || answers.length) {
      const webContext = formatWebContext(webHits, {
        maxChars: Number(process.env.WEB_RAG_MAX_CHARS) || 6500,
        subject: subject.name || subject.enumValue,
        answers,
      });
      if (webContext) {
        ragText = [ragText, webContext].filter(Boolean).join('\n\n');
        webSourced = true;
      }
    }
  }

  let paper;
  let markingScheme;
  let source = 'offline';

  try {
    const generated = await generatePaperWithAi(preset, {
      subject: subject.name || subject.enumValue,
      subjectSlug,
      formLevel: validForm,
      topics: allTopics,
      subtopics,
      testTypeLabel,
      ragText,
      scopeHint,
    });
    if (generated?.paper?.sections?.length) {
      paper = generated.paper;
      markingScheme = generated.markingScheme;
      source = 'casuya-ai';
    }
  } catch (err) {
    console.error('[tests/generate] paper generation failed:', err);
  }

  if (!paper) {
    paper = buildPlaceholderPaper(preset, {
      subject: subject.name || subject.enumValue,
      subjectSlug,
      formLevel: validForm,
      topics: allTopics,
    });
    markingScheme = buildMarkingSchemeFromPaper(paper);
  }

  const flatQuestions = paper.sections.flatMap((sec) =>
    sec.questions.flatMap((q) => {
      if (q.type === 'mcq_bundle' && q.items) {
        return q.items.map((it) => ({
          text: `(${it.number}) ${it.text}`,
          options: Object.entries(typeof it.options === 'object' && !Array.isArray(it.options) ? it.options : {}).map(
            ([k, v]) => `${k}. ${v}`,
          ),
          correctAnswer: it.answer,
          explanation: '',
        }));
      }
      return [];
    }),
  );

  return {
    paper,
    markingScheme,
    preset: {
      id: preset.id,
      paper_code: preset.paper_code,
      paper_title: preset.paper_title,
      duration: preset.duration,
      total_marks: preset.total_marks,
    },
    questions: flatQuestions,
    count: flatQuestions.length,
    testType,
    testTypeLabel,
    grounded: !!ragText,
    webSourced,
    webHits: webHits.map((h) => ({ title: h.title, url: h.url })),
    subject: subject.name,
    formLevel: validForm,
    topics: allTopics,
    subtopics,
    kbHits,
    source,
  };
}
