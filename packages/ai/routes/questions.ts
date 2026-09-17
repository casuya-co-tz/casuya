import { CasuyaAI } from '../src/casuya-ai';
import { HttpError } from '../server-security';
import {
  QuestionType,
  QuestionCategory,
  Difficulty,
} from '../src/types/index';
import { resolveSubject } from '../server';

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

  const questions = await ai.questionGenerator.generateQuestions({
    subject: subject.enumValue,
    topic,
    questionType: QuestionType.MULTIPLE_CHOICE,
    difficulty: Difficulty.INTERMEDIATE,
    category: QuestionCategory.COMPREHENSION,
    count: Number(count) || 5,
    context: contextText,
    formLevel: form_level != null ? Number(form_level) : undefined,
    referenceContext:
      typeof curriculum_context === 'string' ? curriculum_context.slice(0, 8000) : undefined,
  } as any);

  if (!questions?.length) {
    throw new HttpError(503, 'AI provider returned no questions');
  }
  return { questions };
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
