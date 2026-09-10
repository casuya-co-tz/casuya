import { CasuyaAI } from '../src/casuya-ai';
import {
  Language,
  ModerationContentType,
} from '../src/types/index';
import { ProviderFactory } from '../src/providers/provider-factory';
import {
  EXAM_KIND_LABEL,
  ExamSectionSpec,
  resolveSubject,
  formLabel,
  numToWords,
  countLabel,
  markLabel,
  sectionInstruction,
  buildExamPrompt,
  parseExamJson,
  normalizeExamPaper,
} from '../server';

export async function handleContentAnalyze(body: any): Promise<unknown> {
  const text = typeof body.content === 'string' ? body.content : '';
  return {
    wordCount: text.split(/\s+/).filter(Boolean).length,
    charCount: text.length,
    headings: (text.match(/<h[1-6][^>]*>/gi) || []).length,
    links: (text.match(/<a\s/gi) || []).length,
    readability: 'unknown',
  };
}

export async function handleContentModerate(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const content = typeof body.content === 'string' ? body.content : '';
  return ai.moderation.moderate({
    content,
    contentType: ModerationContentType.TEXT,
    language: Language.ENGLISH,
    context: 'educational',
  });
}

export async function handleContentTranslate(ai: CasuyaAI, body: any): Promise<unknown> {
  const { text: translateText, content: translateContent, target_language } = body;
  const inputText = translateText || translateContent || '';
  return ai.translator.translate({
    text: inputText,
    sourceLanguage: Language.ENGLISH,
    targetLanguage: (target_language as Language) || Language.SWAHILI,
  });
}

export function handleMathSolve(body: any): unknown {
  return { formula: body.formula, variables: body.variables || {}, solved: true };
}

export function handleMathSteps(body: any): unknown {
  return {
    steps: [`Start with ${body.expression}`, body.target ? `Solve for ${body.target}` : 'Simplify'],
  };
}

export function handleMathConvert(body: any): unknown {
  return { value: body.value, from: body.from, to: body.to, converted: body.value };
}

export function handleMathPhysics(body: any): unknown {
  return {
    topic: body.topic || 'physics',
    difficulty: body.difficulty || 'medium',
    problem: `A ${body.topic || 'physics'} problem at ${body.difficulty || 'medium'} difficulty.`,
  };
}

export async function handleExamGenerate(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const paper = await generateExamPaper(ai, body);
  return paper ? { paper } : { paper: null };
}

async function generateExamPaper(ai: CasuyaAI, body: any): Promise<any | null> {
  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  const spec: ExamSectionSpec[] = rawSections
    .map((s: any) => {
      const id = String(s?.id || '').trim().toUpperCase();
      const questionType = String(s?.question_type || '').toLowerCase();
      if (!id || !['mcq', 'structured', 'essay'].includes(questionType)) return null;
      return {
        id,
        title: String(s?.title || 'QUESTIONS'),
        questionType,
        count: Math.max(1, Math.min(40, Math.round(Number(s?.count) || 1))),
        marksPerQuestion: Math.max(1, Math.min(50, Math.round(Number(s?.marks_per_question) || 1))),
      };
    })
    .filter(Boolean) as ExamSectionSpec[];
  if (!spec.length) return null;

  const context = String(body.context || '').slice(0, 12000);
  const subjectSlug = typeof body.subject_slug === 'string' ? body.subject_slug : '';
  const subjectName =
    typeof body.subject === 'string' && body.subject ? body.subject : resolveSubject(subjectSlug).name;
  const total = spec.reduce((sum, s) => sum + s.count * s.marksPerQuestion, 0);
  const formLabelStr = formLabel(body.form_level);

  const provider = ProviderFactory.getProvider('failover') || ProviderFactory.getProvider('local');
  if (!provider) return null;

  const prompt = buildExamPrompt({
    subject: subjectName || 'General',
    formLabel: formLabelStr,
    topic: String(body.topic || 'the lesson topic').slice(0, 120),
    context: context || `(No lesson text was provided. Use your general knowledge of ${subjectName || 'the subject'} at ${formLabelStr || 'the given level'}.)`,
    curriculum: String(body.curriculum_context || '').slice(0, 5000),
    kindLabel: EXAM_KIND_LABEL[String(body.kind || '').toLowerCase()] || 'EXAMINATION',
    duration: String(body.duration || '2 Hours'),
    total,
    sections: spec,
  });

  const maxTokens = Math.min(9000, Math.max(2048, total * 50 + spec.length * 500));
  const result = await provider.chatCompletion({
    messages: [
      { role: 'system', content: 'You are an educational assessment generator. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens,
  });

  const parsed = parseExamJson(result.content);
  if (!parsed) return null;
  try {
    return normalizeExamPaper(body, parsed, spec, subjectName || 'General');
  } catch (err) {
    console.error('[exams/generate] normalization failed:', err);
    return null;
  }
}
