import { CasuyaAI } from '../src/casuya-ai';
import {
  Difficulty,
  QuestionCategory,
  QuestionType,
} from '../src/types/index';
import {
  getKnowledgeBase,
  SearchOptions,
  examTypeToKbFilter,
  isTestExamType,
  TEST_EXAM_TYPE_LABELS,
  TestExamType,
} from '../src/kb';
import { resolveSubject } from '../server';

/** Low sampling temperature so questions stay close to the source material
 *  without ever copying exam questions verbatim (user requirement: 0.1–0.2). */
const TEST_TEMPERATURE = 0.15;

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  easy: Difficulty.BEGINNER,
  beginner: Difficulty.BEGINNER,
  medium: Difficulty.INTERMEDIATE,
  intermediate: Difficulty.INTERMEDIATE,
  hard: Difficulty.ADVANCED,
  advanced: Difficulty.ADVANCED,
};

function clampCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), 20) : 10;
}

/**
 * Knowledge-base retrieval for a test type.
 *
 * Prefers the exact exam-paper bucket for the request (e.g. `_form4_terminal_`
 * for Terminal Test Form IV, level `csee` for NECTA Form IV). Falls back to the
 * syllabus/scheme/lessons corpus so even types without dedicated papers
 * (Monthly Test today) are still grounded in the knowledge base as requested.
 */
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

  const maxChars = Number(process.env.KB_RAG_MAX_CHARS) || 7000;
  const filter = examTypeToKbFilter(testType, validForm);

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
    // No dedicated papers for this type/level — widen to the general corpus
    // (syllabus, schemes, lessons, marking schemes, exam formats).
    rag = kb.buildRagContext(
      query,
      { subject, kind: ['syllabus', 'scheme', 'lesson', 'exam_format', 'marking_scheme'], limit: 4 },
      maxChars,
    );
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

export async function handleTestGenerate(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const testType: TestExamType = isTestExamType(body.test_type) ? body.test_type : 'topical';
  const testTypeLabel = TEST_EXAM_TYPE_LABELS[testType];
  const subject = resolveSubject(body.subject_slug);
  const formLevel = Number(body.form_level);
  const validForm = Number.isInteger(formLevel) && formLevel >= 1 && formLevel <= 6 ? formLevel : undefined;
  const count = clampCount(body.count);
  const difficulty = DIFFICULTY_MAP[String(body.difficulty || '').toLowerCase()] ?? Difficulty.INTERMEDIATE;
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
  const subtopic = String(body.subtopic || '').trim() || subtopics[0] || '';

  const { ragText, kbHits } = retrieveTestContext(body);

  let questions: unknown[] = [];
  try {
    const generated = await ai.questionGenerator.generateQuestions({
      subject: subject.name || subject.enumValue,
      topic: topic.slice(0, 80),
      subtopic,
      topicsCovered: topics.length ? topics : undefined,
      subtopicsCovered: subtopics.length ? subtopics : undefined,
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty,
      category: QuestionCategory.COMPREHENSION,
      count,
      formLevel: validForm,
      testTypeLabel,
      referenceContext: ragText || undefined,
      temperature: TEST_TEMPERATURE,
    });
    questions = (generated || []).slice(0, count);
  } catch (err) {
    console.error('[tests/generate] question generation failed:', err);
  }

  return {
    questions,
    count: questions.length,
    testType,
    testTypeLabel,
    grounded: !!ragText,
    subject: subject.name,
    formLevel: validForm ?? null,
    topics,
    subtopics,
    kbHits,
  };
}