import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TestExamType } from './exam-types';
import {
  FormFamily,
  PaperPreset,
  PaperVariant,
  PresetSummary,
  QuestionSlot,
  SectionPreset,
} from './paper-types';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

interface PresetFile {
  family: FormFamily;
  subject_slug: string;
  subject_name: string;
  subject_code: string;
  papers: Record<string, Record<string, unknown>>;
}

interface InternalScaleFile {
  topical: Record<string, unknown>;
  monthly: Record<string, unknown>;
}

function findPkgRoot(from: string): string {
  let dir = resolve(from);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'kb-data')) && existsSync(join(dir, 'knowledge_base'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from, '..', '..');
}

const PKG_ROOT = findPkgRoot(__dirname);
const PRESETS_DIR = join(PKG_ROOT, 'knowledge_base', 'exam_formats', 'presets');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(PRESETS_DIR, name), 'utf8')) as T;
}

const INTERNAL_SCALE = readJson<InternalScaleFile>('internal_scale.json');

const PRESET_FILES: Record<string, string> = {
  'csee:physics': 'csee_physics.json',
  'csee:chemistry': 'csee_chemistry.json',
  'csee:mathematics': 'csee_basic_mathematics.json',
  'ftna:physics': 'ftna_physics.json',
  'ftna:chemistry': 'ftna_chemistry.json',
  'ftna:mathematics': 'ftna_mathematics.json',
  'acsee:physics': 'acsee_physics.json',
  'acsee:chemistry': 'acsee_chemistry.json',
  'acsee:mathematics': 'acsee_advanced_mathematics.json',
};

const fileCache = new Map<string, PresetFile>();

function loadPresetFile(family: FormFamily, subjectSlug: string): PresetFile | null {
  const key = `${family}:${subjectSlug}`;
  if (fileCache.has(key)) return fileCache.get(key)!;
  const fname = PRESET_FILES[key];
  if (!fname) return null;
  const data = readJson<PresetFile>(fname);
  fileCache.set(key, data);
  return data;
}

export function formFamily(formLevel: number): FormFamily {
  if (formLevel <= 2) return 'ftna';
  if (formLevel <= 4) return 'csee';
  return 'acsee';
}

export function formLabel(formLevel: number): string {
  return `Form ${ROMAN[Math.max(1, Math.min(6, formLevel))] || 'I'}`;
}

function scaleKey(family: FormFamily, subjectSlug: string, paper: PaperVariant): string | null {
  if (paper !== 'theory') return null;
  if (family === 'csee') {
    if (subjectSlug === 'mathematics') return 'csee_math';
    return 'csee_science';
  }
  if (family === 'ftna') {
    if (subjectSlug === 'mathematics') return 'ftna_math';
    return 'ftna_science';
  }
  if (family === 'acsee') {
    if (subjectSlug === 'mathematics') return 'acsee_math';
    return 'acsee_science_p1';
  }
  return null;
}

function cloneSlots(slots: QuestionSlot[]): QuestionSlot[] {
  return slots.map((s) => ({ ...s }));
}

function applyScale(
  base: PaperPreset,
  testType: TestExamType,
): PaperPreset {
  if (!['topical', 'monthly'].includes(testType)) return base;
  const key = scaleKey(base.family, base.subject_slug, base.paper);
  if (!key) return base;
  const scaleBlock = INTERNAL_SCALE[testType as 'topical' | 'monthly']?.[key] as
    | Record<string, unknown>
    | undefined;
  if (!scaleBlock) return base;

  const scaled: PaperPreset = {
    ...base,
    duration: String(scaleBlock.duration || base.duration),
    total_marks: Number(scaleBlock.total_marks || base.total_marks),
    instructions: Array.isArray(scaleBlock.instructions)
      ? (scaleBlock.instructions as string[])
      : [...base.instructions],
  };

  if (scaleBlock.assessor_table) {
    scaled.assessor_table = scaleBlock.assessor_table as PaperPreset['assessor_table'];
  }

  if (Array.isArray(scaleBlock.flat_questions)) {
    scaled.flat_questions = cloneSlots(scaleBlock.flat_questions as QuestionSlot[]);
    scaled.sections = undefined;
  } else if (Array.isArray(scaleBlock.sections)) {
    scaled.sections = (scaleBlock.sections as SectionPreset[]).map((sec) => ({
      ...sec,
      questions: cloneSlots(sec.questions),
    }));
    scaled.flat_questions = undefined;
  }

  return scaled;
}

function slotsFromPreset(raw: Record<string, unknown>, file: PresetFile, paper: PaperVariant): PaperPreset {
  const sections = raw.sections as SectionPreset[] | undefined;
  const flat = raw.flat_questions as QuestionSlot[] | undefined;
  const id = `${file.family}_${file.subject_slug}_${paper}`;

  return {
    id,
    family: file.family,
    subject_slug: file.subject_slug,
    subject_name: file.subject_name,
    subject_code: file.subject_code,
    paper,
    paper_code: String(raw.paper_code || file.subject_code),
    paper_title: String(raw.paper_title || file.subject_name),
    duration: String(raw.duration || '2 Hours'),
    total_marks: Number(raw.total_marks || 100),
    exam_body: String(raw.exam_body || 'NATIONAL EXAMINATIONS COUNCIL OF TANZANIA'),
    assessment_type: String(raw.assessment_type || 'EXAMINATION (PRACTICE)'),
    id_label: String(raw.id_label || 'Examination Number'),
    candidate_kind: String(raw.candidate_kind || ''),
    materials: Array.isArray(raw.materials) ? (raw.materials as string[]) : [],
    constants: Array.isArray(raw.constants) ? (raw.constants as string[]) : [],
    instructions: Array.isArray(raw.instructions) ? (raw.instructions as string[]) : [],
    confidential: Boolean(raw.confidential),
    assessor_table: (raw.assessor_table as PaperPreset['assessor_table']) || null,
    sections: sections?.map((s) => ({ ...s, questions: cloneSlots(s.questions) })),
    flat_questions: flat ? cloneSlots(flat) : undefined,
    choice: raw.choice as PaperPreset['choice'],
  };
}

export function resolvePaperPreset(args: {
  subject_slug: string;
  form_level: number;
  test_type: TestExamType;
  paper?: PaperVariant;
}): PaperPreset | null {
  const paper: PaperVariant = args.paper || 'theory';
  const subject = args.subject_slug.toLowerCase();
  if (!['physics', 'chemistry', 'mathematics'].includes(subject)) return null;

  const family = formFamily(args.form_level);
  const file = loadPresetFile(family, subject);
  if (!file) return null;

  const rawPaper = file.papers[paper];
  if (!rawPaper) return null;

  const base = slotsFromPreset(rawPaper, file, paper);
  return applyScale(base, args.test_type);
}

export function listAvailablePapers(args: {
  subject_slug: string;
  form_level: number;
  test_type: TestExamType;
}): PresetSummary[] {
  const subject = args.subject_slug.toLowerCase();
  const family = formFamily(args.form_level);
  const file = loadPresetFile(family, subject);
  if (!file) return [];

  const variants: PaperVariant[] = ['theory'];
  if (file.papers.theory_2) variants.push('theory_2');
  if (subject !== 'mathematics' && file.papers.practical) variants.push('practical');

  return variants.map((paper) => {
    const preset = resolvePaperPreset({ ...args, paper });
    if (!preset) {
      return {
        id: `${family}_${subject}_${paper}`,
        paper,
        paper_code: '',
        paper_title: '',
        duration: '',
        total_marks: 0,
        question_count: 0,
        structure_summary: '',
        available: false,
      };
    }
    const slots = preset.flat_questions
      || preset.sections?.flatMap((s) => s.questions)
      || [];
    const qCount = slots.length;
    const summary = preset.sections
      ? preset.sections.map((s) => `Sec ${s.id}: ${s.questions.length} Q (${s.marks} marks)`).join(' · ')
      : `${qCount} questions × ${slots[0]?.marks || 10} marks`;

    return {
      id: preset.id,
      paper,
      paper_code: preset.paper_code,
      paper_title: preset.paper_title,
      duration: preset.duration,
      total_marks: preset.total_marks,
      question_count: qCount,
      structure_summary: summary,
      available: true,
    };
  });
}

export function countQuestionSlots(preset: PaperPreset): number {
  if (preset.flat_questions?.length) return preset.flat_questions.length;
  return (preset.sections || []).reduce((n, s) => n + s.questions.length, 0);
}

export const MCQ_LABELS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
export const PART_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
