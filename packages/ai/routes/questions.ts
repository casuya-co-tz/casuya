import { CasuyaAI } from '../src/casuya-ai';
import { getKnowledgeBase } from '../src/kb';
import { HttpError } from '../server-security';
import {
  QuestionType,
  QuestionCategory,
  Difficulty,
} from '../src/types/index';
import { formToKbForm, resolveSubject } from '../server';

export async function handleQuestionGenerate(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const {
    content,
    count = 5,
    topic: rawTopic,
    subject_slug,
    form_level,
    instructions,
    curriculum_context,
  } = body;
  const topic = (rawTopic || content || 'lesson content').slice(0, 80);
  const subject = resolveSubject(subject_slug);
  const contextText = [
    typeof content === 'string' ? content : '',
    typeof instructions === 'string' ? instructions : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const kbForm = formToKbForm(form_level);
  const kb = getKnowledgeBase();
  let ragText = typeof curriculum_context === 'string' ? curriculum_context.slice(0, 8000) : '';
  let kbHits: { title: string; kind: string; subject: string; snippet?: string }[] = [];
  const ragQuery = [topic, contextText].filter(Boolean).join(' ').trim();
  if (kb.ready && ragQuery) {
    let rag = kb.buildRagContext(
      ragQuery,
      { subject: subject_slug || undefined, form: kbForm, limit: 3 },
      Number(process.env.KB_RAG_MAX_CHARS) || 6000,
    );
    if (!rag.docs.length && kbForm) {
      rag = kb.buildRagContext(
        ragQuery,
        { subject: subject_slug || undefined, limit: 3 },
        Number(process.env.KB_RAG_MAX_CHARS) || 6000,
      );
    }
    kbHits = rag.docs.map((d) => ({
      title: d.title,
      kind: d.kind,
      subject: d.subject,
      snippet: kb.renderSnippet(d.docId, 240) || undefined,
    }));
    if (rag.text) {
      ragText = [ragText, rag.text].filter(Boolean).join('\n\n').slice(0, 8000);
    }
  }

  const questions = await ai.questionGenerator.generateQuestions({
    subject: subject.enumValue,
    topic,
    questionType: QuestionType.MULTIPLE_CHOICE,
    difficulty: Difficulty.INTERMEDIATE,
    category: QuestionCategory.COMPREHENSION,
    count: Number(count) || 5,
    context: contextText,
    formLevel: form_level != null ? Number(form_level) : undefined,
    referenceContext: ragText || undefined,
  } as any);

  if (!questions?.length) {
    throw new HttpError(503, 'AI provider returned no questions');
  }
  return { questions, kbHits, sourced: kbHits.length > 0 || !!ragText };
}

export async function handleTutoringQuiz(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const { question, context, subject_slug, form_level, count } = body;
  const subject = resolveSubject(subject_slug);
  const n = Math.min(Math.max(Number(count) || 10, 1), 20);

  let questions: unknown[] = [];
  try {
    const generated = await ai.questionGenerator.generateQuestions({
      subject: subject.name || (subject_slug || 'general'),
      topic: (context || question || 'lesson content').slice(0, 80),
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.INTERMEDIATE,
      category: QuestionCategory.COMPREHENSION,
      count: n,
      context: (context || '').slice(0, 4000),
      formLevel: form_level != null ? Number(form_level) : undefined,
    } as any);
    questions = (generated || []).slice(0, n);
  } catch (err) {
    console.error('[quiz] question generation failed:', err);
    throw new HttpError(503, 'AI provider returned no quiz questions');
  }

  if (!questions.length) {
    throw new HttpError(503, 'AI provider returned no quiz questions');
  }
  return { questions, count: questions.length };
}
