import { TutoringMode, TutoringRequest } from '../types';
import { SyllabusAdapter } from '../adapters/syllabus-adapter';
import { Logger } from '../utilities';
import { buildSubjectFrameworkBlock } from '../prompts/subject-frameworks';

/** Maps subject names/slugs to TIE syllabus slugs */
const SUBJECT_SLUG_MAP: Record<string, string> = {
  mathematics: 'mathematics',
  'basic mathematics': 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
};

export async function buildTutoringSystemPrompt(
  request: TutoringRequest,
  promptManager: { execute(args: { templateId: string; variables: Record<string, unknown> }): { content: string } },
  syllabusAdapter: SyllabusAdapter | null,
  logger: Logger,
): Promise<string> {
  const formLevel = (request.preferences as unknown as Record<string, unknown>)?.formLevel as number | undefined;
  const subjectSlug = SUBJECT_SLUG_MAP[request.subject?.toLowerCase?.() ?? ''] ?? '';

  // Fetch TIE curriculum context if adapter is available
  let curriculumContext = '';
  if (syllabusAdapter && subjectSlug && formLevel) {
    try {
      curriculumContext = await syllabusAdapter.getCurriculumContext(subjectSlug, formLevel);
    } catch {
      logger.warn(`Failed to fetch curriculum context for ${subjectSlug} Form ${formLevel}`);
    }
  }

  // Choose NECTA-aligned template or fall back to generic
  const templateId = curriculumContext
    ? 'necta-tutoring'
    : 'tutoring-explain';

  const variables: Record<string, unknown> = {
    subject: request.subject,
    topic: request.topic,
    difficulty: request.preferences?.difficulty ?? 'intermediate',
    language: request.preferences?.language ?? 'en',
    question: request.message,
    subject_framework: buildSubjectFrameworkBlock(subjectSlug || 'general'),
  };

  if (curriculumContext) {
    variables.curriculum_context = curriculumContext;
    variables.form_level = formLevel ?? 1;
    variables.necta_code = subjectSlug.toUpperCase().slice(0, 4);
  }

  return promptManager.execute({ templateId, variables }).content;
}

export function buildTutoringUserPrompt(request: TutoringRequest): string {
  const modeInstructions: Record<TutoringMode, string> = {
    [TutoringMode.EXPLAIN]: 'Provide a clear, comprehensive explanation.',
    [TutoringMode.SOCRATIC]: 'Guide the student to discover the answer through questions.',
    [TutoringMode.PRACTICE]: 'Provide practice problems and exercises.',
    [TutoringMode.REVIEW]: 'Review previously covered material and identify gaps.',
    [TutoringMode.ASSESS]: 'Assess the student understanding and provide feedback.',
  };

  return `${modeInstructions[request.mode]}\n\nStudent question: ${request.message}`;
}

export function getTemperature(mode: TutoringMode): number {
  switch (mode) {
    case TutoringMode.EXPLAIN: return 0.3;
    case TutoringMode.SOCRATIC: return 0.7;
    case TutoringMode.PRACTICE: return 0.4;
    case TutoringMode.REVIEW: return 0.3;
    case TutoringMode.ASSESS: return 0.2;
  }
}

export function getMaxTokens(mode: TutoringMode): number {
  switch (mode) {
    case TutoringMode.EXPLAIN: return 2048;
    case TutoringMode.SOCRATIC: return 1024;
    case TutoringMode.PRACTICE: return 1536;
    case TutoringMode.REVIEW: return 1024;
    case TutoringMode.ASSESS: return 768;
  }
}