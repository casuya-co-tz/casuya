export {
  KnowledgeBase,
  getKnowledgeBase,
} from './knowledge-base';
export type {
  KbKind,
  KbDoc,
  KbIndex,
  SearchOptions,
  SearchHit,
  RagContextDoc,
} from './types';
export { renderDoc, renderSnippet } from './renderers';
export {
  TEST_EXAM_TYPES,
  TEST_EXAM_TYPE_LABELS,
  isTestExamType,
  examTypeToKbFilter,
  matchesKbExamFilter,
  effectiveFormForTest,
  cumulativeFormRange,
  NATIONAL_TEST_FORM,
} from './exam-types';
export type {
  TestExamType,
  KbExamFilter,
} from './exam-types';
export {
  resolvePaperPreset,
  listAvailablePapers,
  formFamily,
  formLabel as paperFormLabel,
  countQuestionSlots,
} from './paper-presets';
export type {
  PaperPreset,
  PaperVariant,
  ExamPaper,
  MarkingScheme,
  ExamQuestion,
  ExamSection,
} from './paper-types';
