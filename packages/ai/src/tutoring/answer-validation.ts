export interface ValidationResult {
  needsReview: boolean;
  uncertaintyNote?: string;
  flaggedTerms: string[];
}

const UNCERTAINTY_FOOTER =
  '\n\n> ⚠️ *Thibitisha na kitabu chako — sehemu ya jibu hili haikupatikana kwenye muhtasari wa mtaala.*';

function extractTerms(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z]{4,}/g)
    ?.filter((w) => !/^(this|that|with|from|have|been|will|your|their|about|which)$/.test(w)) || [];
}

/**
 * Cross-check tutor output against syllabus/curriculum context.
 * Flags answers that mention terms absent from the provided syllabus excerpt.
 */
export function validateTutorAnswer(
  response: string,
  opts: { curriculumContext?: string; minOverlapRatio?: number } = {},
): ValidationResult {
  const curriculum = String(opts.curriculumContext || '').trim();
  if (!curriculum || curriculum.length < 80) {
    return { needsReview: false, flaggedTerms: [] };
  }

  const syllabusTerms = new Set(extractTerms(curriculum));
  const answerTerms = extractTerms(response);
  const flagged: string[] = [];

  for (const term of answerTerms) {
    if (syllabusTerms.has(term)) continue;
    if (/necta|tanzania|form|topic|lesson|example|student|answer|equation|number/.test(term)) continue;
    if (term.length < 5) continue;
    flagged.push(term);
    if (flagged.length >= 5) break;
  }

  const minOverlap = opts.minOverlapRatio ?? 0.08;
  const overlap = answerTerms.filter((t) => syllabusTerms.has(t)).length;
  const ratio = answerTerms.length ? overlap / answerTerms.length : 1;
  const needsReview = flagged.length >= 3 && ratio < minOverlap;

  return {
    needsReview,
    flaggedTerms: flagged,
    uncertaintyNote: needsReview ? UNCERTAINTY_FOOTER : undefined,
  };
}

export function applyValidationFooter(response: string, result: ValidationResult): string {
  if (!result.needsReview || !result.uncertaintyNote) return response;
  if (response.includes('Thibitisha na kitabu chako')) return response;
  return response + result.uncertaintyNote;
}
