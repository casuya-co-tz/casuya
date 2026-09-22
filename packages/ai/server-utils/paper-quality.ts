/**
 * Quality loop for the Test Generator ("super" mode).
 *
 * Mirrors the multi-step verification the big assistants run before shipping
 * an answer: a critic model scores its own draft against the exam rubric, a
 * revision pass fixes only the flagged problems (bounded to one retry so
 * latency does not explode), duplicate questions are detected and swapped for
 * offline-bank content, mark totals are reconciled to the preset, and any
 * marking-scheme answer gaps are filled in a final targeted pass.
 *
 * Every function here is pure and failure-isolated: a malformed critique or
 * completion response is dropped, never thrown.
 */

import { ExamPaper, MarkingScheme, PaperPreset } from '../src/kb/paper-types';
import { parseJsonObject } from './exam';
import { salvageSyntheticQuestions } from './paper';

const PART_PLACEHOLDER = /^\(Part [a-z]\)$/;
const ITEM_PLACEHOLDER = /^Item \d+$/;

/** True when an answer_html holds only part labels / mark brackets, no prose. */
export function isLabelsOnlyAnswer(answerHtml: string): boolean {
  const normalized = String(answerHtml || '')
    .toLowerCase()
    .replace(/\(part [a-z]\)/g, ' ')
    .replace(/\([a-z]\)/g, ' ')
    .replace(/\[\d+\s*mark?s?\]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized === '';
}

export interface CritiqueIssue {
  question?: string;
  severity: 'low' | 'medium' | 'high';
  problem: string;
  fix: string;
}

export interface CritiqueResult {
  score: number;
  issues: CritiqueIssue[];
}

export interface MissingAnswer {
  question: string;
  section: string;
  marks: number;
}

export interface DuplicatePair {
  a: string;
  b: string;
  overlap: number;
}

/** Compact JSON of the paper for the critic / revision models. */
export function serializePaper(paper: ExamPaper): string {
  try {
    return JSON.stringify(paper);
  } catch {
    return '';
  }
}

function parseScore(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

export function parseCritiqueResponse(text: string): CritiqueResult | null {
  const parsed = parseJsonObject(String(text || ''));
  if (!parsed || typeof parsed !== 'object') return null;

  const score = parseScore((parsed as any).score);
  if (score == null && !Array.isArray((parsed as any).issues)) return null;

  const issues: CritiqueIssue[] = Array.isArray((parsed as any).issues)
    ? (parsed as any).issues
        .map((raw: any, i: number) => {
          const severity = String(raw?.severity || 'low').toLowerCase();
          const problem = String(raw?.problem || '').trim();
          if (!problem) return null;
          return {
            question: String(raw?.question ?? '').trim() || `issue ${i + 1}`,
            severity: severity === 'high' || severity === 'medium' ? severity : 'low',
            problem,
            fix: String(raw?.fix || '').trim(),
          };
        })
        .filter(Boolean)
    : [];

  return { score: score ?? (issues.length ? 70 : 100), issues };
}

/** Decide whether an extra revision attempt is worth the latency. */
export function needsRevision(critique: CritiqueResult | null): { yes: boolean; reasons: string[] } {
  if (!critique) return { yes: false, reasons: ['no critique parsed'] };
  const reasons: string[] = [];
  if (critique.score != null && critique.score < 85) reasons.push(`critic score ${critique.score} < 85`);
  const high = (critique.issues || []).filter((i) => i.severity === 'high');
  if (high.length) reasons.push(`${high.length} high-severity issue(s)`);
  return { yes: reasons.length > 0, reasons };
}

export function buildCritiquePrompt(
  subject: string,
  paperJson: string,
  referenceContext: string,
  expectedMarks: number,
  paperTitle: string,
): string {
  return [
    `You are a strict NECTA chief examiner in Tanzania reviewing a freshly generated ${subject} exam paper.`,

    'Judge it against this rubric and reply with JSON only in exactly this shape:',
    '{"score": 0-100, "issues": [{"question": "Q1 or Q1(a)", "severity": "low|medium|high", "problem": "short description", "fix": "short instruction"}]}',
    '',
    'Checklist:',
    `- The paper "should total exactly" ${expectedMarks} marks. Flag any section or question whose marks are missing, wrong, or inconsistent.`,
    '- Every question must be fully written: structured/essay parts must have real text (not "(Part a)"), MCQ items must have text and options, matching questions must have complete lists.',
    '- Questions must target the requested topic(s); nothing invented that is absent from the reference context unless it is core syllabus standard.',
    '- Answers inside the paper (MCQ letters, matching pairs) must be plausible and complete.',
    '- No two questions may repeat the same stem or ask the same thing in different words.',
    '- NECTA exam conventions, language register, and readability for the form level.',
    '- Score honestly: 95+ means exam-ready; 70-84 needs fixable revisions; below 70 means substantial rework.',
    '',
    'REFERENCE CONTEXT (syllabus + web research, use it to judge factual accuracy):',
    (referenceContext || '(none)').slice(0, 9000),
    '',
    'PAPER TITLE: ' + paperTitle,
    '',
    'PAPER JSON:',
    paperJson.slice(0, 24000),
  ].join('\n');
}

export function buildRevisionPrompt(
  subject: string,
  paperJson: string,
  critique: CritiqueResult,
  expectedMarks: number,
  paperTitle: string,
): string {
  const issuesList = (critique.issues || [])
    .map((i) => `- [${String(i.severity).toUpperCase()}] Q${i.question || '?'}: ${i.problem}${i.fix ? ` (fix: ${i.fix})` : ''}`)
    .join('\n');
  return [
    `You are a meticulous NECTA examiner fixing a draft of "${paperTitle}" for ${subject}.`,
    'Rewrite the ENTIRE paper JSON below, applying every listed fix and nothing else. Keep every question number, type, mark value, section structure and the total marks exactly as they are.',
    'Rules:',
    '- Output ONLY the corrected paper JSON (same schema as the input), no commentary.',
    `- The corrected paper must total exactly ${expectedMarks} marks.`,
    '- Do not change content that was not flagged.',
    '- Fill any blank/placeholder text with real question content in strict NECTA style.',
    '',
    `CRITIC REPORT (problems to fix):\n${issuesList || '(none listed)'}`,
    '',
    'PAPER JSON TO CORRECT:',
    paperJson.slice(0, 24000),
  ].join('\n');
}

/** Normalize a question body for duplicate detection. */
function normalizedBag(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(text: string): Set<string> {
  const bag = normalizedBag(text);
  const parts = bag.split(' ');
  if (parts.length < 4) return new Set(bag ? [bag] : []);
  const out = new Set<string>();
  for (let i = 0; i <= parts.length - 4; i += 1) out.add(parts.slice(i, i + 4).join(' '));
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter += 1;
  return inter / (a.size + b.size - inter || 1);
}

function questionFingerprint(q: any): string {
  const body = String(q?.text || q?.stem || '').trim();
  if (q?.type === 'mcq_bundle' && Array.isArray(q?.items)) {
    return `${body} ${q.items.map((it: any) => String(it?.text || '')).join(' ')}`.trim();
  }
  if (Array.isArray(q?.parts)) {
    return `${body} ${q.parts.map((p: any) => String(p?.text || '')).join(' ')}`.trim();
  }
  if (q?.type === 'matching' && Array.isArray(q?.listA)) {
    return `${body} ${q.listA.join(' ')} ${(q?.listB || []).join(' ')}`.trim();
  }
  return body;
}

/** Detect near-duplicate questions inside one paper. */
export function detectDuplicateQuestions(paper: ExamPaper): DuplicatePair[] {
  const shots: Array<{ label: string; set: Set<string> }> = [];
  (paper.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      const text = questionFingerprint(q);
      if (!text) return;
      shots.push({ label: `Q${q.number}`, set: shingles(text) });
    });
  });

  const DUP_OVERLAP_THRESHOLD = 0.65;

const pairs: DuplicatePair[] = [];
  for (let i = 0; i < shots.length; i += 1) {
    for (let j = i + 1; j < shots.length; j += 1) {
      const ratio = overlap(shots[i].set, shots[j].set);
      if (ratio >= DUP_OVERLAP_THRESHOLD) pairs.push({ a: shots[i].label, b: shots[j].label, overlap: Math.round(ratio * 100) / 100 });
    }
  }
  return pairs;
}

/** Replace flagged question numbers (e.g. the second of a duplicate pair) from the bank. */
export function replaceQuestionsFromBank(
  paper: ExamPaper,
  preset: PaperPreset,
  args: { subject: string; subjectSlug: string; formLevel: number; topics: string[] },
  numbers: (string | number)[],
): { paper: ExamPaper; replaced: number; numbers: (string | number)[] } {
  if (!numbers?.length) return { paper, replaced: 0, numbers: [] };
  const salvaged = salvageSyntheticQuestions(paper, preset, args, numbers);
  return { paper: salvaged.paper, replaced: salvaged.replaced, numbers: salvaged.numbers };
}

function hasSubstantiveAnswer(entry: MarkingScheme['sections'][number]['questions'][number]): boolean {
  if (entry.items?.length) {
    return entry.items.every((it) => String(it.answer || '').trim().length > 0);
  }
  const html = String(entry.answer_html || '').trim();
  if (!html || html === 'See examiner guidance.') return false;
  return !isLabelsOnlyAnswer(html);
}

/** Find marking-scheme entries whose model answer is still empty or a stub. */
export function findMissingSchemeAnswers(paper: ExamPaper, scheme: MarkingScheme): MissingAnswer[] {
  const missing: MissingAnswer[] = [];
  (scheme.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((entry) => {
      if (hasSubstantiveAnswer(entry)) return;
      const q = (paper.sections || [])
        .flatMap((s) => s.questions)
        .find((qq) => String(qq.number) === String(entry.number));
      missing.push({
        question: String(entry.number),
        section: sec.name,
        marks: entry.marks ?? q?.marks ?? 0,
      });
    });
  });
  return missing;
}

export function buildAnswersCompletionPrompt(
  subject: string,
  paperJson: string,
  missing: MissingAnswer[],
  paperTitle: string,
): string {
  const list = missing
    .map((m) => `- Q${m.question} (${m.section}, ${m.marks} marks)`)
    .join('\n');
  return [
    `You are a NECTA examiner. Write concise model answers for the marking scheme of "${paperTitle}" (${subject}).`,
    'Reply with JSON only: {"answers": [{"question": "Q1 or Q1(a)-(b)", "answer_html": "bulleted answers in plain HTML with tags like <p>, <li>"}]}.',
    'Rules:',
    '- One entry per listed question, keys must match the question labels exactly.',
    '- Answers must be what the examiner accepts: for math include the working and final answer; for science the key points; for essays the mark descriptors per sub-question.',
    '- Each answer must be detailed enough to award all the marks listed.',
    '',
    'QUESTIONS NEEDING ANSWERS:',
    list,
    '',
    'PAPER JSON (for reference):',
    paperJson.slice(0, 18000),
  ].join('\n');
}

export interface CompletedAnswer {
  question: string;
  answer_html: string;
}

export function parseAnswersCompletion(text: string): CompletedAnswer[] {
  const parsed = parseJsonObject(String(text || ''));
  if (!parsed || !Array.isArray((parsed as any).answers)) return [];
  const out: CompletedAnswer[] = [];
  for (const raw of (parsed as any).answers as any[]) {
    const question = String(raw?.question ?? '').replace(/^q/i, 'Q').trim();
    const answer_html = String(raw?.answer_html ?? '').trim();
    if (question && answer_html) out.push({ question, answer_html });
  }
  return out;
}

/** Apply completed answers onto a shallow copy of the marking scheme. */
function answerKey(label: string): string {
  return String(label).toLowerCase().replace(/^q/, '').trim();
}

export function applyAnswersToScheme(
  scheme: MarkingScheme,
  completed: CompletedAnswer[],
): MarkingScheme {
  if (!completed.length) return scheme;
  const map = new Map(completed.map((c) => [answerKey(c.question), c.answer_html]));
  return {
    ...scheme,
    sections: (scheme.sections || []).map((sec) => ({
      ...sec,
      questions: sec.questions.map((entry) => {
        const answer = map.get(answerKey(String(entry.number)));
        if (answer == null) return entry;
        if (entry.items?.length) {
          return {
            ...entry,
            items: entry.items.map((it) => (String(it.answer || '').trim() ? it : { ...it, answer: answer })),
            answer_html: entry.answer_html && entry.answer_html !== 'See examiner guidance.'
              ? entry.answer_html
              : answer,
          };
        }
        return { ...entry, answer_html: answer };
      }),
    })),
  };
}

/** Pure helper: does the assembled paper honor the preset mark total? */
export function marksDiscrepancy(paper: ExamPaper, preset: PaperPreset): { paperTotal: number; presetTotal: number; equal: boolean } {
  const paperTotal = (paper.sections || []).reduce((n, s) => n + (s.marks ?? s.questions.reduce((m, q) => m + q.marks, 0)), 0);
  const presetTotal = preset.total_marks;
  return { paperTotal, presetTotal, equal: paperTotal === presetTotal };
}

/** Placeholder-text matcher reused by callers that rebuild bank content. */
export function isPlaceholderLike(text: string): boolean {
  return PART_PLACEHOLDER.test(String(text || '').trim()) || ITEM_PLACEHOLDER.test(String(text || '').trim());
}