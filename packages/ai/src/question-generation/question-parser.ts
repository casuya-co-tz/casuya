import {
  GeneratedQuestion,
  QuestionGenerationRequest,
  QuestionCategory,
  QuestionType,
} from '../types';
import { Logger } from '../utilities';

export function parseQuestionResponse(
  response: string,
  request: QuestionGenerationRequest,
  logger?: Logger,
): GeneratedQuestion[] {
  // Strip markdown code fences (```json ... ```) that models wrap around JSON
  let cleaned = response.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let questions = tryParseArray(cleaned, request);

  if (!questions.length) {
    // Tolerate invalid JSON escapes (e.g. LaTeX `\,` / `\ln`) models often emit
    const sanitized = sanitizeJsonEscapes(cleaned);
    if (sanitized !== cleaned) {
      questions = tryParseArray(sanitized, request);
    }
  }

  if (!questions.length) {
    // If the model clearly returned (broken) JSON, never render raw text as a question
    if (/\{?\s*"question"|"correctAnswer"|"options"/.test(response)) {
      logger?.warn('could not parse question JSON; returning no questions instead of raw text');
      return [];
    }
    questions = extractQuestionsFromText(response, request);
  }

  return validateQuestions(questions, request, logger);
}

export function tryParseArray(text: string, request: QuestionGenerationRequest): GeneratedQuestion[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, request.count).map((q, i) => normalizeQuestion(q, i, request));
    }
  } catch {
    // Not JSON, try to extract an array from mixed model output
  }

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        return parsed.slice(0, request.count).map((q, i) => normalizeQuestion(q, i, request));
      }
    } catch {
      // fall through
    }
  }
  return [];
}

export function sanitizeJsonEscapes(text: string): string {
  // Double any backslash that is not part of a valid JSON escape (\" \\ \/ \b \f \n \r \t \uXXXX)
  return text.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
}

export function validateQuestions(
  questions: GeneratedQuestion[],
  request: QuestionGenerationRequest,
  logger?: Logger,
): GeneratedQuestion[] {
  const uncertaintyPatterns = [
    /\bwait\b/i,
    /\bactually\b.*\bshould\b/i,
    /\bcorrect answer should\b/i,
    /\bthis question demonstrates the importance\b/i,
    /\bhmm\b/i,
    /\blet me\b/i,
    /\bperhaps\b/i,
    /\bmaybe\b/i,
    /\bprobably not\b/i,
  ];
  const validated: GeneratedQuestion[] = [];
  for (const q of questions) {
    if (!q.text.trim() || !q.correctAnswer) continue;
    if (!q.options || q.options.length < 2) continue;
    const expl = (q.explanation ?? '').toLowerCase();
    if (uncertaintyPatterns.some((p) => p.test(expl))) continue;
    validated.push(q);
  }
  const result = validated.slice(0, request.count);
  if (!result.length) {
    logger?.warn('validateQuestions filtered all generated questions; returning original set as fallback');
    return questions.slice(0, request.count);
  }
  return result;
}

export function normalizeQuestion(raw: Record<string, unknown>, index: number, request: QuestionGenerationRequest): GeneratedQuestion {
  // Handle options as either array of strings or {A: ..., B: ...} object
  let options: string[] | undefined;
  const rawOptions = raw.options as Record<string, string> | string[] | undefined;
  if (rawOptions) {
    if (Array.isArray(rawOptions)) {
      options = rawOptions;
    } else if (typeof rawOptions === 'object') {
      options = Object.values(rawOptions).map(String);
    }
  }

  return {
    id: `q-${Date.now()}-${index}`,
    type: request.questionType,
    category: (raw.category as QuestionCategory) ?? request.category,
    difficulty: request.difficulty,
    subject: request.subject,
    topic: request.topic,
    text: String(raw.text ?? raw.question ?? ''),
    options,
    correctAnswer: String(raw.correctAnswer ?? raw.correct_answer ?? raw.answer ?? ''),
    explanation: String(raw.explanation ?? ''),
    hints: raw.hints as string[] | undefined,
    metadata: {
      estimatedTime: estimateTime(request.questionType),
      bloomLevel: request.category,
      concepts: [request.topic],
      tags: [request.subject, request.topic],
      reviewed: false,
      version: '1.0.0',
    },
  };
}

export function extractQuestionsFromText(text: string, request: QuestionGenerationRequest): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  const blocks = text.split(/\n\s*(?=\d+[.)]|Q[.)])/);
  let index = 0;

  for (const block of blocks) {
    if (!block.trim()) continue;
    questions.push({
      id: `q-${Date.now()}-${index}`,
      type: request.questionType,
      category: request.category,
      difficulty: request.difficulty,
      subject: request.subject,
      topic: request.topic,
      text: block.trim(),
      correctAnswer: '',
      explanation: '',
      metadata: {
        estimatedTime: estimateTime(request.questionType),
        bloomLevel: request.category,
        concepts: [request.topic],
        tags: [request.subject, request.topic],
        reviewed: false,
        version: '1.0.0',
      },
    });
    index++;
  }

  return questions;
}

function estimateTime(type: QuestionType): number {
  switch (type) {
    case QuestionType.MULTIPLE_CHOICE: return 60;
    case QuestionType.TRUE_FALSE: return 30;
    case QuestionType.SHORT_ANSWER: return 90;
    case QuestionType.ESSAY: return 300;
    case QuestionType.FILL_IN_BLANK: return 45;
    case QuestionType.MATCHING: return 120;
    case QuestionType.ORDERING: return 60;
    default: return 60;
  }
}