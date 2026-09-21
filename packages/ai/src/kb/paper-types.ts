/** Canonical exam paper schema for NECTA-style Test Generator output. */

export type PaperKind = 'necta' | 'internal' | 'exercise';
export type PaperVariant = 'theory' | 'theory_2' | 'practical';
export type FormFamily = 'ftna' | 'csee' | 'acsee';

export type QuestionType =
  | 'mcq_bundle'
  | 'matching'
  | 'structured'
  | 'essay'
  | 'practical'
  | 'mcq'; // legacy assignment papers

export interface ChoiceRule {
  mode: 'all' | 'n_of_m';
  n?: number;
  m?: number;
}

export interface McqItem {
  number: string;
  text: string;
  options: Record<string, string> | string[];
  answer: string;
  marks: number;
}

export interface MatchingQuestion {
  number: number | string;
  type: 'matching';
  marks: number;
  text?: string;
  stem?: string;
  listA: string[];
  listB: string[];
  answers?: string[];
}

export interface StructuredPart {
  label: string;
  text: string;
  marks: number;
}

export interface ExamQuestion {
  number: number | string;
  type?: QuestionType;
  marks: number;
  text?: string;
  stem?: string;
  optional?: boolean;
  /** Legacy flat MCQ */
  options?: string[];
  answer?: number;
  /** mcq_bundle */
  items?: McqItem[];
  /** matching */
  listA?: string[];
  listB?: string[];
  answers?: string[];
  /** structured / essay */
  parts?: StructuredPart[];
  sub_questions?: StructuredPart[];
  /** practical */
  apparatus?: string[];
  procedure?: string[];
  tables?: Array<{ title: string; columns: string[]; rows: number }>;
  tasks?: StructuredPart[];
}

export interface ExamSection {
  id: string;
  title: string;
  marks?: number;
  instruction: string;
  question_type?: string;
  count?: number;
  marks_per_question?: number;
  choice?: ChoiceRule;
  questions: ExamQuestion[];
}

export interface PaperHeader {
  country?: string;
  exam_body?: string;
  assessment_type?: string;
  exam?: string;
  subject: string;
  subject_slug?: string;
  subject_code?: string;
  paper_code?: string;
  paper_title?: string;
  candidate_kind?: string;
  id_label?: string;
  form_level?: number;
  form_label?: string;
  topic?: string;
  lesson_title?: string;
  duration: string;
  year?: string;
  total_marks: number;
  instructions: string[];
  materials?: string[];
  constants?: string[];
  confidential?: boolean;
}

export interface AssessorTable {
  question_numbers: number[];
  checker: boolean;
}

export interface ExamPaper {
  kind: PaperKind;
  format_label?: string;
  header: PaperHeader;
  assessor_table?: AssessorTable | null;
  sections: ExamSection[];
  meta?: Record<string, unknown>;
}

export interface MarkingSchemeEntry {
  number: number | string;
  marks: number;
  answer_html?: string;
  items?: Array<{ number: string; answer: string; marks: number }>;
}

export interface MarkingScheme {
  code?: string;
  subject?: string;
  year?: string;
  max_marks?: number;
  sections: Array<{
    name: string;
    marks: number;
    questions: MarkingSchemeEntry[];
  }>;
}

export interface QuestionSlot {
  slot: number;
  type: QuestionType;
  marks: number;
  item_count?: number;
  part_count?: number;
  stem?: string;
  optional?: boolean;
}

export interface SectionPreset {
  id: string;
  title: string;
  marks: number;
  instruction: string;
  choice: ChoiceRule;
  questions: QuestionSlot[];
}

export interface PaperPreset {
  id: string;
  family: FormFamily;
  subject_slug: string;
  subject_name: string;
  subject_code: string;
  paper: PaperVariant;
  paper_code: string;
  paper_title: string;
  duration: string;
  total_marks: number;
  exam_body: string;
  assessment_type: string;
  id_label: string;
  candidate_kind: string;
  materials: string[];
  constants: string[];
  instructions: string[];
  confidential?: boolean;
  assessor_table?: AssessorTable | null;
  sections?: SectionPreset[];
  flat_questions?: QuestionSlot[];
  choice?: ChoiceRule;
}

export interface PresetSummary {
  id: string;
  paper: PaperVariant;
  paper_code: string;
  paper_title: string;
  duration: string;
  total_marks: number;
  question_count: number;
  structure_summary: string;
  available: boolean;
}
