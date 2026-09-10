/**
 * Shared constants and pure helpers for the casuya-ai package.
 *
 * Facade module: subject/tutoring helpers live in ``server-utils/tutoring`` and
 * exam-paper helpers in ``server-utils/exam``; both are re-exported here so the
 * HTTP layer and route handlers keep importing from ``'../server-utils'``
 * (server.ts re-exports everything defined here).
 */

export {
  SUBJECT_NAME,
  resolveSubject,
  formToKbForm,
  formLabel,
  buildGroundedMessage,
  buildGroundedFallback,
  cleanThink,
} from './server-utils/tutoring';

export {
  ExamSectionSpec,
  EXAM_KIND_LABEL,
  numToWords,
  countLabel,
  markLabel,
  sectionInstruction,
  buildExamPrompt,
  parseExamJson,
  normalizeExamPaper,
  parseJsonObject,
} from './server-utils/exam';