import { QuestionGenerationRequest } from '../types';
import { SyllabusAdapter } from '../adapters/syllabus-adapter';
import { Logger } from '../utilities';

/** Maps subject names/slugs to TIE syllabus slugs */
const SUBJECT_SLUG_MAP: Record<string, string> = {
  mathematics: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  english: 'english',
  kiswahili: 'kiswahili',
};

export interface CurriculumContext {
  curriculumContext: string;
  subjectSlug: string;
  formLevel?: number;
}

export async function buildCurriculumContext(
  request: QuestionGenerationRequest,
  syllabusAdapter: SyllabusAdapter | null,
  logger?: Logger,
): Promise<CurriculumContext> {
  const subjectSlug = SUBJECT_SLUG_MAP[request.subject?.toLowerCase?.() ?? ''] ?? '';
  const formLevel = (request as unknown as Record<string, unknown>).formLevel as number | undefined;

  if (syllabusAdapter && subjectSlug && formLevel) {
    try {
      const curriculumContext = await syllabusAdapter.getCurriculumContext(subjectSlug, formLevel);
      return { curriculumContext, subjectSlug, formLevel };
    } catch {
      logger?.warn(`Failed to fetch curriculum context for question generation`);
    }
  }
  return { curriculumContext: '', subjectSlug, formLevel };
}