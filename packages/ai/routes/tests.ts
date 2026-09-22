import { CasuyaAI } from '../src/casuya-ai';
import {
  getKnowledgeBase,
  SearchOptions,
  examTypeToKbFilter,
  isTestExamType,
  TEST_EXAM_TYPE_LABELS,
  TestExamType,
} from '../src/kb';
import {
  listAvailablePapers,
  resolvePaperPreset,
} from '../src/kb/paper-presets';
import { PaperVariant } from '../src/kb/paper-types';
import { ProviderFactory } from '../src/providers/provider-factory';
import {
  buildWebQuery,
  fetchWebDocs,
  formLevelLabel,
  formatWebContext,
  isKbThin,
  webSearchEnabled,
  WebSearchDoc,
} from '../src/rag/web-search';
import { resolveSubject } from '../server';
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

  const testType = isTestExamType(body.test_type) ? body.test_type : 'topical';
  const subject = String(body.subject_slug || '').trim() || undefined;
  const formLevel = Number(body.form_level);
  const validForm = Number.isInteger(formLevel) && formLevel >= 1 && formLevel <= 6 ? formLevel : undefined;
  const topics = (Array.isArray(body.topics) ? body.topics : [])
    .map((t: unknown) => String(t || '').trim())
    .filter(Boolean);
  const subtopics = (Array.isArray(body.subtopics) ? body.subtopics : [])
    .map((t: unknown) => String(t || '').trim())
    .filter(Boolean);
  const query = [
    String(body.topic || ''),
    ...topics,
    String(body.subtopic || ''),
    ...subtopics,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!query) return empty;

  const maxChars = Number(process.env.KB_RAG_MAX_CHARS) || 9000;
  const filter = examTypeToKbFilter(testType, validForm);
  const paper = parsePaperVariant(body.paper);

  const examOpts: SearchOptions = {
    subject,
    kind: ['exam'],
    limit: 4,
  };
  if (filter?.level) examOpts.level = filter.level;
  if (filter?.file) examOpts.file = filter.file;
  if (validForm && !filter?.level) examOpts.formNumber = validForm;

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
  if (!subjectSlug || !Number.isInteger(formLevel) || formLevel < 1 || formLevel > 6) {
    return { presets: [], error: 'subject_slug and form_level (1-6) required' };
  }
  const presets = listAvailablePapers({ subject_slug: subjectSlug, form_level: formLevel, test_type: testType });
  return { presets, testType, formLevel };
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
  });

  const slotCount = preset.flat_questions?.length
    || preset.sections?.reduce((n, s) => n + s.questions.length, 0)
    || 10;
  const maxTokens = Math.min(16000, Math.max(6000, slotCount * 750));

  const result = await provider.chatCompletion({
    messages: [
      { role: 'system', content: 'You are a Tanzanian NECTA examination setter. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: TEST_TEMPERATURE,
    maxTokens,
  });

  const parsed = parsePaperJson(result.content);
  if (!parsed) return null;

  const paper = assemblePaperFromContent(preset, parsed, {
    subject: args.subject,
    subjectSlug: args.subjectSlug,
    formLevel: args.formLevel,
    topics: args.topics,
    generator: 'casuya-ai',
  });
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
    if (salvaged.replaced > 0 && countSyntheticQuestions(salvaged.paper).count === 0) {
      const markingScheme = buildMarkingSchemeFromPaper(salvaged.paper, parsed);
      return { paper: salvaged.paper, markingScheme };
    }
    return null;
  }
  const markingScheme = buildMarkingSchemeFromPaper(paper, parsed);
  return { paper, markingScheme };
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
  const validForm = Number.isInteger(formLevel) && formLevel >= 1 && formLevel <= 6 ? formLevel : 4;
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
  // web (only if a search key is configured). Any web failure is ignored.
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
    webHits = await fetchWebDocs(query, { limit: 4 });
    if (webHits.length) {
      const webContext = formatWebContext(webHits, {
        maxChars: Number(process.env.WEB_RAG_MAX_CHARS) || 6500,
        subject: subject.name || subject.enumValue,
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
