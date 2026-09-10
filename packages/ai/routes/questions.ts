import { CasuyaAI } from '../src/casuya-ai';
import {
  QuestionType,
  QuestionCategory,
  Difficulty,
  TutoringSubject,
} from '../src/types/index';
import { resolveSubject } from '../server';

export async function handleQuestionGenerate(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const { content, count = 5, topic: rawTopic, subject_slug } = body;
  const topic = (rawTopic || content || 'lesson content').slice(0, 80);
  const subject = resolveSubject(subject_slug);

  const questions = await ai.questionGenerator.generateQuestions({
    subject: subject.enumValue,
    topic,
    questionType: QuestionType.MULTIPLE_CHOICE,
    difficulty: Difficulty.INTERMEDIATE,
    category: QuestionCategory.COMPREHENSION,
    count: Number(count) || 5,
    context: content,
  });
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
      formLevel: form_level,
    } as any);
    questions = (generated || []).slice(0, n);
  } catch (err) {
    console.error('[quiz] question generation failed:', err);
  }
  return { questions, count: questions.length };
}
