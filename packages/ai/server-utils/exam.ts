/**
 * Exam-paper helpers for the casuya-ai package.
 *
 * Prompt building, JSON parsing and normalisation of generated NECTA-style
 * examination papers. Kept separate from the tutoring helpers so each module
 * stays under the per-file budget.
 */

import { formLabel } from './tutoring';

export interface ExamSectionSpec {
  id: string;
  title: string;
  questionType: string;
  count: number;
  marksPerQuestion: number;
}

export const EXAM_KIND_LABEL: Record<string, string> = {
  necta: 'NECTA-STYLE EXAMINATION',
  internal: 'INTERNAL EXAMINATION',
  exercise: 'CLASS EXERCISE',
};

export function numToWords(n: number): string {
  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
  if (n < 20) return ones[n] || String(n);
  const t = Math.floor(n / 10);
  if (t >= 6) return String(n);
  return n % 10 ? `${tens[t]}-${ones[n % 10]}` : tens[t];
}

export function countLabel(count: number): string {
  return `${numToWords(count)} (${count}) questions`;
}

export function markLabel(n: number): string {
  return `${numToWords(n)} (${n}) mark${n === 1 ? '' : 's'}`;
}

export function sectionInstruction(s: ExamSectionSpec): string {
  if (s.questionType === 'mcq') {
    return `This section consists of ${countLabel(s.count)}. Every question carries one (1) mark. Answer ALL questions.`;
  }
  return `This section consists of ${countLabel(s.count)}. Each question carries ${markLabel(s.marksPerQuestion)}. Answer ALL questions.`;
}

export function buildExamPrompt(args: {
  subject: string;
  formLabel: string;
  topic: string;
  context: string;
  curriculum: string;
  kindLabel: string;
  duration: string;
  total: number;
  sections: ExamSectionSpec[];
}): string {
  const specLines = args.sections
    .map((s) => {
      const typeDetail =
        s.questionType === 'mcq'
          ? 'a MULTIPLE-CHOICE objective question with exactly FOUR options labelled "A. ...", "B. ...", "C. ...", "D. ...", plus an "answer" field holding the 0-based index of the correct option'
          : s.questionType === 'structured'
            ? 'a STRUCTURED short-answer question using NECTA command verbs (state, list, outline, explain, distinguish, describe, calculate)'
            : 'an ESSAY / long-response question requiring a coherent written answer of several short paragraphs';
      return `- Section ${s.id} "${s.title}": exactly ${s.count} questions, ${markLabel(s.marksPerQuestion)} each. Each question must be ${typeDetail}.`;
    })
    .join('\n');

  return [
    'You are an experienced Tanzanian secondary school examiner working with the official TIE curriculum. Compose an examination paper.',
    '',
    'RULES (strict):',
    '- Every question MUST be based ONLY on facts, definitions, examples and concepts present in the LESSON TEXT below. Never invent material that is not in the lesson text.',
    '- Align difficulty and terminology with the TIE syllabus class/form level stated.',
    '- Use correct English and NECTA-style command verbs.',
    '- The number of questions in each section MUST exactly match the specification.',
    '- The marks for each question MUST match the specification.',
    '',
    `SUBJECT: ${args.subject}`,
    `CLASS: ${args.formLabel}`,
    `TOPIC: ${args.topic}`,
    `PAPER TITLE: ${args.kindLabel}`,
    `TIME ALLOWED: ${args.duration}`,
    `TOTAL MARKS: ${args.total}`,
    '',
    'SECTIONS:',
    specLines,
    '',
    'LESSON TEXT (your ONLY source of content):',
    '"""',
    args.context,
    '"""',
    '',
    'TIE CURRICULUM CONTEXT:',
    '"""',
    args.curriculum || '(none provided)',
    '"""',
    '',
    'RESPOND WITH ONLY A JSON OBJECT, exactly this shape (no markdown, no backticks, no commentary):',
    '{ "sections": [ { "id": "A", "question_type": "mcq", "questions": [ { "text": "...", "marks": 1, "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": 0 } ] }, { "id": "B", "question_type": "structured", "questions": [ { "text": "...", "marks": 6 } ] }, { "id": "C", "question_type": "essay", "questions": [ { "text": "...", "marks": 22 } ] } ] }',
  ].join('\n');
}

export function parseExamJson(content: string): { sections?: unknown[] } | null {
  let text = String(content || '').trim();
  text = text.replace(/```json/gi, '').replace(/```/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    return data && Array.isArray(data.sections) ? data : { sections: [] };
  } catch {
    return null;
  }
}

export function normalizeExamPaper(
  body: any,
  parsed: any,
  spec: ExamSectionSpec[],
  subjectName: string,
): any | null {
  const pickedBySection: Record<string, any[]> = {};
  for (const s of spec) {
    const src = (parsed.sections || []).find((x: any) => String(x?.id || '').toUpperCase() === s.id.toUpperCase());
    const qs = Array.isArray(src?.questions) ? src.questions : [];
    const valid =
      s.questionType === 'mcq'
        ? qs.filter((q: any) => q && typeof q.text === 'string' && Array.isArray(q.options) && q.options.length >= 2)
        : qs.filter((q: any) => q && typeof q.text === 'string');
    if (valid.length < s.count) return null;
    pickedBySection[s.id.toUpperCase()] = valid.slice(0, s.count);
  }

  let number = 1;
  let totalMarks = 0;
  const sections = spec.map((s) => {
    const questions = pickedBySection[s.id.toUpperCase()].map((q) => {
      const text = String(q.text || '').replace(/\s+/g, ' ').trim();
      const marks = Math.max(1, Math.round(Number(q.marks) || s.marksPerQuestion));
      const entry: any = { number: number++, text, marks };
      if (s.questionType === 'mcq') {
        let opts = (q.options || []).map((o: any, i: number) => {
          const clean = String(o || '').replace(/\s+/g, ' ').trim();
          return /^[A-Da-d][.)]\s*/.test(clean) ? clean : `${String.fromCharCode(65 + i)}. ${clean}`;
        });
        while (opts.length < 4) opts.push(`${String.fromCharCode(65 + opts.length)}. —`);
        opts = opts.slice(0, 4);
        let answer = 0;
        if (typeof q.answer === 'number' && Number.isFinite(q.answer) && q.answer >= 0 && q.answer < 4) {
          answer = Math.round(q.answer);
        } else if (/^[A-Da-d]$/.test(String(q.answer || '').trim())) {
          answer = String(q.answer).trim().toUpperCase().charCodeAt(0) - 65;
        }
        entry.options = opts;
        entry.answer = answer;
      }
      totalMarks += marks;
      return entry;
    });
    return {
      id: s.id,
      title: s.title,
      instruction: sectionInstruction(s),
      question_type: s.questionType,
      count: questions.length,
      marks_per_question: s.marksPerQuestion,
      questions,
    };
  });

  const kindKey = String(body.kind || '').toLowerCase();
  const formLevel = Number(body.form_level) || 1;
  const instructions: string[] = [];
  instructions.push(`This paper consists of ${sections.length} section(s) with a total of ${totalMarks} marks.`);
  instructions.push('Answer ALL questions.');
  instructions.push('Marks for each question are shown in brackets.');
  instructions.push(
    kindKey === 'exercise'
      ? 'Write all your answers in the space provided below each question.'
      : 'For objective questions choose the correct answer and write its letter. Show your working where necessary.',
  );

  return {
    kind: kindKey || 'internal',
    format_label: EXAM_KIND_LABEL[kindKey] || 'EXAMINATION',
    header: {
      exam: EXAM_KIND_LABEL[kindKey] || 'EXAMINATION',
      subject: subjectName,
      subject_slug: typeof body.subject_slug === 'string' ? body.subject_slug : '',
      form_level: formLevel,
      form_label: `${formLabel(body.form_level) || `Form ${formLevel}`} - ${subjectName}`,
      topic: String(body.topic || '').trim(),
      lesson_title: String(body.lesson_title || '').trim(),
      duration: String(body.duration || (kindKey === 'exercise' ? '40 Minutes' : '2 Hours')),
      year: String(new Date().getFullYear()),
      total_marks: totalMarks,
      instructions,
    },
    sections,
    meta: { generator: 'casuya-ai', generated_at: new Date().toISOString() },
  };
}

export function parseJsonObject(content: string): any | null {
  let text = String(content || '').trim();
  text = text.replace(/```json/gi, '').replace(/```/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}