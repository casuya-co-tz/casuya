/**
 * Shared subject helpers for the casuya-ai package.
 *
 * Subject resolution, form labelling and grounded-message construction used by
 * the tutoring routes. Kept separate from exam-paper helpers so each module
 * stays under the per-file budget.
 */

import { TutoringSubject } from '../src/types/index';

export const SUBJECT_NAME: Record<string, string> = {
  mathematics: 'Mathematics',
  'basic mathematics': 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  'animal husbandry': 'Animal Husbandry',
  agriculture: 'Agriculture',
  'english language': 'English Language',
  english: 'English Language',
  kiswahili: 'Kiswahili',
  history: 'History',
  geography: 'Geography',
  'book keeping': 'Book Keeping',
  commerce: 'Commerce',
  economics: 'Economics',
  divinity: 'Divinity',
  'bible knowledge': 'Bible Knowledge',
  'computer science': 'Computer Science',
  civics: 'Civics',
};

export function resolveSubject(slug?: string): { name: string; enumValue: TutoringSubject } {
  const s = (slug || '').toLowerCase();
  const name = SUBJECT_NAME[s] || (slug ? slug.replace(/[_-]+/g, ' ') : '');
  let enumValue: TutoringSubject = TutoringSubject.GENERAL;
  if (/(mathematics|math)/.test(s)) enumValue = TutoringSubject.MATHEMATICS;
  else if (/(physics|chemistry|biology|science|agriculture|geography)/.test(s))
    enumValue = TutoringSubject.SCIENCE;
  else if (/history/.test(s)) enumValue = TutoringSubject.HISTORY;
  else if (/literature/.test(s)) enumValue = TutoringSubject.LITERATURE;
  else if (/(english|kiswahili|swahili|language)/.test(s)) enumValue = TutoringSubject.LANGUAGE;
  else if (/(computer|computing|ict)/.test(s)) enumValue = TutoringSubject.COMPUTING;
  else if (/(art|music|drama)/.test(s)) enumValue = TutoringSubject.ARTS;
  return { name, enumValue };
}

export function formToKbForm(form?: number | string): string | undefined {
  const n = typeof form === 'string' ? parseInt(form, 10) : form;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 6) return undefined;
  return `form${n}`;
}

export function formLabel(form?: number | string): string {
  const n = typeof form === 'string' ? parseInt(form, 10) : form;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6 ? `Form ${n}` : '';
}

export function buildGroundedMessage(opts: {
  question: string;
  context?: string;
  subjectName: string;
  form?: number | string;
  ragText: string;
  maxContextChars?: number;
}): string {
  const ctx = (opts.context || '').trim();
  const form = formLabel(opts.form);
  const lines: string[] = [];
  lines.push('Answer the student question below, grounded in the provided lesson text and reference material, and in reality — do not guess or invent when the sources are silent.');
  if (opts.subjectName) lines.push(`Subject: ${opts.subjectName}`);
  if (form) lines.push(`Class/Form: ${form}`);
  if (ctx) {
    const clip = ctx.length > (opts.maxContextChars || 4000) ? ctx.slice(0, opts.maxContextChars || 4000) + '…' : ctx;
    lines.push(`\nLESSON TEXT THE STUDENT IS READING (read this carefully and use it as the primary basis of your answer):\n"""\n${clip}\n"""`);
  }
  if (opts.ragText) lines.push(opts.ragText);
  lines.push(`\nSTUDENT QUESTION: ${opts.question}`);
  return lines.join('\n');
}

export function buildGroundedFallback(
  question: string,
  ragDocs: { title: string; kind: string; snippet?: string }[],
): string {
  const cleanQ = question.replace(/^(explain|describe|define|what is|what are|how does|how do|why is|why do|state|list|outline|distinguish|compare)\b[\s:]*/i, '').trim() || question.trim();
  if (ragDocs.length) {
    const refs = ragDocs
      .map((d) => {
        const snip = d.snippet ? `\n  ${d.snippet}` : '';
        return `- ${d.title}${snip}`;
      })
      .join('\n');
    return `I couldn't reach an AI model just now, so here is the closest NECTA/TIE material for "${cleanQ}":\n\n${refs}\n\nRead that with your lesson text, then ask again — the next attempt will try Groq, Google, Mistral, and Grok in turn.`;
  }
  return `I couldn't reach Groq, Google, Mistral, or Grok just now. Please ask "${cleanQ}" again in a moment.`;
}

export function cleanThink(text: string): string {
  let msg = text;
  msg = msg.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  msg = msg.replace(/\s*thinking[\s\S]*?<\/think>/i, '');
  return msg.trim();
}