/**
 * NECTA-style paper generation helpers for Test Generator.
 */

import {
  ExamPaper,
  ExamQuestion,
  ExamSection,
  MarkingScheme,
  McqItem,
  PaperPreset,
  QuestionSlot,
  SectionPreset,
  StructuredPart,
} from '../src/kb/paper-types';
import { MCQ_LABELS, PART_LABELS, formLabel } from '../src/kb/paper-presets';
import { PAPER_GENERATION_TEMPLATE } from '../src/prompts/necta/paper-generation-grounded';
import { parseJsonObject } from './exam';

const OPTS = ['A', 'B', 'C', 'D'];
const PART_PLACEHOLDER = /^\(Part [a-z]\)$/;
const ITEM_PLACEHOLDER = /^Item \d+$/;

/**
 * True when a question was filled with assembly fallbacks because the model
 * returned no real content for its slot. Such papers must not be served.
 */
export function isSyntheticQuestion(q: ExamQuestion): boolean {
  const body = String(q.text || q.stem || '').trim();
  if (body === `Question ${q.number}`) return true;
  if (q.type === 'mcq_bundle') {
    const items = q.items || [];
    return items.length > 0 && items.every((it) => !String(it.text || '').trim());
  }
  if (q.type === 'matching') {
    const listA = q.listA || [];
    return listA.length > 0 && listA.every((a) => ITEM_PLACEHOLDER.test(String(a).trim()));
  }
  if (q.parts?.length) {
    return q.parts.every((p) => PART_PLACEHOLDER.test(String(p.text || '').trim()));
  }
  return false;
}

export function countSyntheticQuestions(paper: ExamPaper): { count: number; numbers: (string | number)[] } {
  const numbers: (string | number)[] = [];
  (paper.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      if (isSyntheticQuestion(q)) numbers.push(q.number);
    });
  });
  return { count: numbers.length, numbers };
}

function distributeMarks(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

export function buildQuestionSlotLines(preset: PaperPreset): string {
  const slots = preset.flat_questions
    || preset.sections?.flatMap((s) => s.questions)
    || [];
  return slots.map((slot) => {
    switch (slot.type) {
      case 'mcq_bundle':
        return `Q${slot.slot} mcq_bundle: stem + exactly ${slot.item_count} items (${MCQ_LABELS.slice(0, slot.item_count || 10).join(',')}), each with options A-D, answer letter, 1 mark each; total ${slot.marks} marks`;
      case 'matching':
        return `Q${slot.slot} matching: stem + listA (${slot.item_count} items) + listB (>=${slot.item_count} responses) + answers array; total ${slot.marks} marks`;
      case 'structured':
        return `Q${slot.slot} structured: stem + ${slot.part_count || 2} parts (a,b,...) with marks summing to ${slot.marks}`;
      case 'essay':
        return `Q${slot.slot} essay${slot.optional ? ' (optional)' : ''}: stem + ${slot.part_count || 3} parts with marks summing to ${slot.marks}`;
      case 'practical':
        return `Q${slot.slot} practical: title + apparatus[] + procedure[] + blank tables (empty cells only) + ${slot.part_count || 3} tasks with marks summing to ${slot.marks}; NO filled readings on question paper`;
      default:
        return `Q${slot.slot}: ${slot.type}, ${slot.marks} marks`;
    }
  }).join('\n');
}

function renderPaperGenerationTemplate(vars: Record<string, string>): string {
  let result = PAPER_GENERATION_TEMPLATE.template;
  for (const variable of PAPER_GENERATION_TEMPLATE.variables) {
    const value = vars[variable.name];
    if (value === undefined && variable.required) {
      throw new Error(`Missing required prompt variable: ${variable.name}`);
    }
    result = result.replace(new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g'), value ?? '');
  }
  return result;
}

export function buildPaperPrompt(args: {
  preset: PaperPreset;
  subject: string;
  topics: string[];
  subtopics: string[];
  testTypeLabel: string;
  referenceContext: string;
}): string {
  return renderPaperGenerationTemplate({
    test_type_label: args.testTypeLabel,
    subject: args.subject,
    paper_code: args.preset.paper_code,
    paper_title: args.preset.paper_title,
    total_marks: String(args.preset.total_marks),
    topics_covered: args.topics.join('; ') || '(general syllabus scope)',
    subtopics_covered: args.subtopics.join('; ') || '(none)',
    reference_context: args.referenceContext || '(syllabus only)',
    question_slots: buildQuestionSlotLines(args.preset),
  });
}

function questionBody(q: ExamQuestion): string {
  return String(q.text || q.stem || '').trim();
}

export function validateNectaPaper(
  paper: ExamPaper,
  preset?: PaperPreset,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const sections = paper.sections;
  if (!sections?.length) {
    return { valid: false, issues: ['paper has no sections'] };
  }

  let expected = 1;
  let total = 0;

  const sectionEarnable = (sec: ExamSection, presetSec?: SectionPreset) => {
    if (sec.marks != null) return sec.marks;
    if (presetSec?.marks != null) return presetSec.marks;
    const qMarks = sec.questions.map((q) => q.marks || 0);
    const choice = sec.choice || presetSec?.choice;
    if (choice?.mode === 'n_of_m' && choice.n) {
      return [...qMarks].sort((a, b) => b - a).slice(0, choice.n).reduce((n, m) => n + m, 0);
    }
    return qMarks.reduce((n, m) => n + m, 0);
  };

  sections.forEach((sec, secIdx) => {
    const presetSec = preset?.sections?.[secIdx];
    const qs = sec.questions;
    if (!qs?.length) {
      issues.push(`Section ${sec.id} has no questions`);
      return;
    }
    if (presetSec && qs.length !== presetSec.questions.length) {
      issues.push(`Section ${sec.id} expected ${presetSec.questions.length} questions, got ${qs.length}`);
    }

    qs.forEach((q, qIdx) => {
      const slot = presetSec?.questions[qIdx] || preset?.flat_questions?.[expected - 1];
      if (Number(q.number) !== expected) {
        issues.push(`expected Q${expected}, found Q${q.number}`);
      }
      expected += 1;

      if (q.type === 'mcq_bundle') {
        if (!q.items?.length) {
          issues.push(`Q${q.number} mcq_bundle has no items`);
        } else if (slot?.item_count && q.items.length !== slot.item_count) {
          issues.push(`Q${q.number} mcq_bundle expected ${slot.item_count} items, got ${q.items.length}`);
        }
        q.items?.forEach((it, i) => {
          const opts = it.options && typeof it.options === 'object' ? Object.keys(it.options) : [];
          if (opts.length < 4) {
            issues.push(`Q${q.number} item ${i + 1} needs 4 options`);
          }
        });
      } else if (q.type === 'matching') {
        const count = slot?.item_count || q.listA?.length || 0;
        if (!q.listA?.length || !q.listB?.length) {
          issues.push(`Q${q.number} matching missing listA or listB`);
        } else if (slot?.item_count && q.listA.length !== slot.item_count) {
          issues.push(`Q${q.number} matching expected ${slot.item_count} listA items, got ${q.listA.length}`);
        } else if (count && q.listB.length < count) {
          issues.push(`Q${q.number} matching listB too short`);
        }
        if (!q.answers?.length) {
          issues.push(`Q${q.number} matching missing answers`);
        }
      } else if (q.type === 'practical') {
        if (!q.apparatus?.length) issues.push(`Q${q.number} practical missing apparatus`);
        if (!q.parts?.length && !q.tasks?.length) issues.push(`Q${q.number} practical missing tasks/parts`);
      } else if (!questionBody(q) && !q.parts?.length) {
        issues.push(`Q${q.number} empty text/stem`);
      }

      if (q.parts?.length) {
        const partSum = q.parts.reduce((n, p) => n + (p.marks || 0), 0);
        if (partSum !== q.marks) {
          issues.push(`Q${q.number} part marks ${partSum} != question marks ${q.marks}`);
        }
      }
    });
    total += sectionEarnable(sec, presetSec);
  });

  const headerTotal = paper.header?.total_marks;
  if (headerTotal != null && total !== headerTotal) {
    issues.push(`marks total ${total} != header total ${headerTotal}`);
  }
  if (preset && total !== preset.total_marks) {
    issues.push(`marks total ${total} != preset total ${preset.total_marks}`);
  }

  return { valid: issues.length === 0, issues };
}

function normalizeMcqItem(raw: any, idx: number, marksEach: number): McqItem {
  const num = String(raw?.number || MCQ_LABELS[idx] || String(idx + 1));
  let options: Record<string, string> = {};
  if (raw?.options && typeof raw.options === 'object' && !Array.isArray(raw.options)) {
    options = raw.options;
  } else if (Array.isArray(raw?.options)) {
    raw.options.forEach((o: string, i: number) => {
      options[OPTS[i]] = String(o).replace(/^[A-Da-d][.)]\s*/, '');
    });
  }
  while (Object.keys(options).length < 4) {
    options[OPTS[Object.keys(options).length]] = '—';
  }
  let answer = String(raw?.answer || 'A').trim().toUpperCase();
  if (!/^[A-D]$/.test(answer)) answer = 'A';
  return {
    number: num,
    text: String(raw?.text || '').trim(),
    options,
    answer,
    marks: Number(raw?.marks) || marksEach,
  };
}

function reconcilePartMarks(parts: StructuredPart[], totalMarks: number): StructuredPart[] {
  if (!parts.length || !(totalMarks > 0)) return parts;
  const raw = parts.map((p) => Math.max(1, Math.max(0, Number(p.marks) || 0)));
  const sum = raw.reduce((n, m) => n + m, 0);
  if (sum === totalMarks) return parts;

  let marks: number[];
  if (sum === 0 || parts.length > totalMarks) {
    marks = distributeMarks(totalMarks, parts.length);
  } else {
    const scaled = raw.map((m) => (m / sum) * totalMarks);
    marks = scaled.map((m) => Math.floor(m));
    const order = scaled
      .map((m, i) => ({ i, frac: m - Math.floor(m) }))
      .sort((a, b) => b.frac - a.frac);
    let remaining = totalMarks - marks.reduce((n, m) => n + m, 0);
    let o = 0;
    while (remaining > 0) {
      marks[order[o % order.length].i] += 1;
      remaining -= 1;
      o += 1;
    }
    marks = marks.map((m) => Math.max(1, m));
    let excess = marks.reduce((n, m) => n + m, 0) - totalMarks;
    while (excess > 0) {
      const maxIdx = marks.indexOf(Math.max(...marks));
      if (maxIdx < 0 || marks[maxIdx] <= 1) break;
      marks[maxIdx] -= 1;
      excess -= 1;
    }
  }

  return parts.map((p, i) => ({ ...p, marks: marks[i] }));
}

function normalizeParts(raw: any, totalMarks: number, count: number): StructuredPart[] {
  const src = raw?.parts || raw?.sub_questions || raw?.tasks || [];
  let parts: StructuredPart[];
  if (!Array.isArray(src) || !src.length) {
    const marks = distributeMarks(totalMarks, count);
    parts = marks.map((m, i) => ({
      label: PART_LABELS[i] || String(i + 1),
      text: `(Part ${PART_LABELS[i] || i + 1})`,
      marks: m,
    }));
  } else {
    parts = src.slice(0, count).map((p: any, i: number) => ({
      label: String(p?.label || PART_LABELS[i] || i + 1),
      text: String(p?.text || '').trim(),
      marks: Number(p?.marks) || Math.max(1, Math.floor(totalMarks / count)),
    }));
  }
  return reconcilePartMarks(parts, totalMarks);
}

function normalizeQuestion(raw: any, slot: QuestionSlot, number: number): ExamQuestion {
  const base: ExamQuestion = {
    number,
    type: slot.type,
    marks: slot.marks,
    text: String(raw?.text || raw?.stem || slot.stem || '').trim(),
    stem: String(raw?.stem || raw?.text || slot.stem || '').trim(),
    optional: slot.optional,
  };

  if (slot.type === 'mcq_bundle') {
    const count = slot.item_count || 10;
    const marksEach = Math.max(1, Math.floor(slot.marks / count));
    const itemsRaw = Array.isArray(raw?.items) ? raw.items : [];
    const items: McqItem[] = [];
    for (let i = 0; i < count; i++) {
      items.push(normalizeMcqItem(itemsRaw[i] || {}, i, marksEach));
    }
    base.items = items;
    base.text = base.text || slot.stem || `For each of the items (i)-(${MCQ_LABELS[count - 1] || 'x'}), choose the correct answer:`;
  } else if (slot.type === 'matching') {
    const count = slot.item_count || 5;
    base.listA = (Array.isArray(raw?.listA) ? raw.listA : []).slice(0, count);
    base.listB = (Array.isArray(raw?.listB) ? raw.listB : []).slice(0, Math.max(count + 2, 6));
    base.answers = (Array.isArray(raw?.answers) ? raw.answers : []).slice(0, count);
    while (base.listA!.length < count) base.listA!.push(`Item ${base.listA!.length + 1}`);
    while (base.listB!.length < count + 2) base.listB!.push(String.fromCharCode(65 + base.listB!.length));
    while (base.answers!.length < count) base.answers!.push('A');
    base.text = base.text || slot.stem || 'Match the items in List A with the correct responses in List B:';
  } else if (slot.type === 'practical') {
    base.apparatus = Array.isArray(raw?.apparatus) ? raw.apparatus.map(String) : ['Metre rule', 'Stopwatch', 'Balance'];
    base.procedure = Array.isArray(raw?.procedure) ? raw.procedure.map(String) : ['Set up the apparatus as shown.', 'Record your observations in the table.'];
    base.tables = Array.isArray(raw?.tables)
      ? raw.tables.map((t: any) => ({
          title: String(t?.title || 'Results'),
          columns: Array.isArray(t?.columns) ? t.columns.map(String) : ['Trial', 'Value'],
          rows: Math.max(3, Number(t?.rows) || 4),
        }))
      : [{ title: 'Results', columns: ['Trial', 'Reading'], rows: 4 }];
    base.parts = normalizeParts(raw, slot.marks, slot.part_count || 3);
    base.text = base.text || `Question ${number}`;
  } else {
    base.parts = normalizeParts(raw, slot.marks, slot.part_count || 2);
    base.text = base.text || base.stem || `Question ${number}`;
  }

  return base;
}

export function assemblePaperFromContent(
  preset: PaperPreset,
  parsed: any,
  meta: { subject: string; subjectSlug: string; formLevel: number; topics: string[]; generator: string },
): ExamPaper {
  const year = String(new Date().getFullYear());
  const topicStr = meta.topics.slice(0, 3).join(', ');
  let qNum = 1;
  const sections: ExamSection[] = [];

  const fillSection = (secPreset: { id: string; title: string; marks: number; instruction: string; choice: PaperPreset['choice']; questions: QuestionSlot[] }, srcQuestions: any[]) => {
    const questions: ExamQuestion[] = secPreset.questions.map((slot, i) => {
      const q = normalizeQuestion(srcQuestions[i] || {}, slot, qNum);
      qNum += 1;
      return q;
    });
    sections.push({
      id: secPreset.id,
      title: secPreset.title,
      marks: secPreset.marks,
      instruction: secPreset.instruction,
      choice: secPreset.choice,
      questions,
    });
  };

  if (preset.sections?.length) {
    const parsedSections = Array.isArray(parsed?.sections) ? parsed.sections : [];
    preset.sections.forEach((secPreset, idx) => {
      const src = parsedSections.find((s: any) => String(s?.id || '').toUpperCase() === secPreset.id.toUpperCase())
        || parsedSections[idx]
        || {};
      fillSection(secPreset, Array.isArray(src?.questions) ? src.questions : []);
    });
  } else if (preset.flat_questions?.length) {
    const srcQs = Array.isArray(parsed?.questions)
      ? parsed.questions
      : (parsed?.sections?.[0]?.questions || []);
    const questions: ExamQuestion[] = preset.flat_questions.map((slot, i) => {
      const q = normalizeQuestion(srcQs[i] || {}, slot, qNum);
      qNum += 1;
      return q;
    });
    sections.push({
      id: 'A',
      title: preset.paper_title,
      marks: preset.total_marks,
      instruction: preset.choice?.mode === 'n_of_m'
        ? `Answer ${preset.choice.n} of ${preset.choice.m} questions.`
        : 'Answer ALL questions.',
      choice: preset.choice || { mode: 'all' },
      questions,
    });
  }

  const totalMarks = sections.reduce((sum, s) => {
    if (s.marks != null) return sum + s.marks;
    const choice = s.choice?.mode;
    const qMarks = s.questions.map((q) => q.marks || 0);
    if (choice === 'n_of_m' && s.choice?.n) {
      const sorted = [...qMarks].sort((a, b) => b - a);
      return sum + sorted.slice(0, s.choice.n).reduce((n, m) => n + m, 0);
    }
    return sum + qMarks.reduce((n, m) => n + m, 0);
  }, 0);

  return {
    kind: 'necta',
    format_label: preset.assessment_type,
    header: {
      country: 'THE UNITED REPUBLIC OF TANZANIA',
      exam_body: preset.exam_body,
      assessment_type: preset.assessment_type,
      exam: preset.assessment_type,
      subject: preset.subject_name,
      subject_slug: meta.subjectSlug,
      subject_code: preset.subject_code,
      paper_code: preset.paper_code,
      paper_title: preset.paper_title,
      candidate_kind: preset.candidate_kind,
      id_label: preset.id_label,
      form_level: meta.formLevel,
      form_label: formLabel(meta.formLevel),
      topic: topicStr,
      duration: preset.duration,
      year,
      total_marks: totalMarks || preset.total_marks,
      instructions: preset.instructions,
      materials: preset.materials,
      constants: preset.constants,
      confidential: preset.confidential,
    },
    assessor_table: preset.assessor_table,
    sections,
    meta: { generator: meta.generator, generated_at: new Date().toISOString(), preset_id: preset.id },
  };
}

export function buildPlaceholderPaper(
  preset: PaperPreset,
  args: { subject: string; subjectSlug: string; formLevel: number; topics: string[] },
): ExamPaper {
  const topic = args.topics[0] || args.subject;
  const fakeContent = {
    sections: preset.sections?.map((sec) => ({
      id: sec.id,
      questions: sec.questions.map((slot) => {
        if (slot.type === 'mcq_bundle') {
          const count = slot.item_count || 10;
          return {
            type: 'mcq_bundle',
            stem: slot.stem,
            items: Array.from({ length: count }, (_, i) => ({
              number: MCQ_LABELS[i],
              text: `(${MCQ_LABELS[i]}) Which statement about ${topic} is correct?`,
              options: {
                A: 'Correct concept',
                B: 'Unrelated idea',
                C: 'Common misconception',
                D: 'Another distractor',
              },
              answer: 'A',
              marks: 1,
            })),
          };
        }
        if (slot.type === 'matching') {
          const count = slot.item_count || 5;
          return {
            type: 'matching',
            stem: slot.stem,
            listA: Array.from({ length: count }, (_, i) => `Term ${i + 1} about ${topic}`),
            listB: ['Definition A', 'Definition B', 'Definition C', 'Definition D', 'Definition E', 'Definition F'],
            answers: Array.from({ length: count }, (_, i) => String.fromCharCode(65 + (i % 6))),
          };
        }
        if (slot.type === 'practical') {
          return {
            type: 'practical',
            text: `Practical investigation related to ${topic}.`,
            apparatus: ['Metre rule', 'Stopwatch', 'Measuring cylinder'],
            procedure: ['Arrange the apparatus.', 'Take readings and record in the table.', 'Calculate the required quantity.'],
            tables: [{ title: 'Readings', columns: ['Trial', 'Time (s)'], rows: 4 }],
            tasks: distributeMarks(slot.marks, slot.part_count || 3).map((m, i) => ({
              label: PART_LABELS[i],
              text: `(${PART_LABELS[i]}) Complete the task for ${topic}.`,
              marks: m,
            })),
          };
        }
        const parts = distributeMarks(slot.marks, slot.part_count || 2);
        return {
          type: slot.type,
          stem: `Question on ${topic}.`,
          parts: parts.map((m, i) => ({
            label: PART_LABELS[i],
            text: `(${PART_LABELS[i]}) Explain or calculate using ${topic}.`,
            marks: m,
          })),
        };
      }),
    })),
    questions: preset.flat_questions?.map((slot) => ({
      type: slot.type,
      stem: `Question on ${topic}.`,
      parts: distributeMarks(slot.marks, slot.part_count || 2).map((m, i) => ({
        label: PART_LABELS[i],
        text: `(${PART_LABELS[i]}) Work on ${topic}.`,
        marks: m,
      })),
    })),
  };

  return assemblePaperFromContent(preset, fakeContent, {
    subject: args.subject,
    subjectSlug: args.subjectSlug,
    formLevel: args.formLevel,
    topics: args.topics,
    generator: 'offline',
  });
}

export function buildMarkingSchemeFromPaper(paper: ExamPaper, parsed?: any): MarkingScheme {
  const parsedMs = parsed?.marking_scheme;
  if (parsedMs?.sections) return parsedMs as MarkingScheme;

  const sections = paper.sections.map((sec) => ({
    name: `SECTION ${sec.id} (${sec.marks ?? ''} MARKS)`.trim(),
    marks: sec.marks || sec.questions.reduce((n, q) => n + q.marks, 0),
    questions: sec.questions.map((q) => {
      const entry: { number: number | string; marks: number; answer_html?: string; items?: Array<{ number: string; answer: string; marks: number }> } = {
        number: q.number,
        marks: q.marks,
      };
      if (q.type === 'mcq_bundle' && q.items) {
        entry.items = q.items.map((it) => ({ number: it.number, answer: it.answer, marks: it.marks }));
        entry.answer_html = q.items.map((it) => `${it.number}: ${it.answer}`).join(', ');
      } else if (q.type === 'matching') {
        entry.answer_html = (q.answers || []).map((a, i) => `${i + 1}->${a}`).join(', ');
      } else if (q.parts?.length) {
        entry.answer_html = q.parts.map((p) => `(${p.label}) [${p.marks} marks]`).join(' ');
      } else {
        entry.answer_html = 'See examiner guidance.';
      }
      return entry;
    }),
  }));

  return {
    code: paper.header.subject_code,
    subject: paper.header.subject,
    year: paper.header.year,
    max_marks: paper.header.total_marks,
    sections,
  };
}

export function parsePaperJson(content: string): any | null {
  return parseJsonObject(content);
}
