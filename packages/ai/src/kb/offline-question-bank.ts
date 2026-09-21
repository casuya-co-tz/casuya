/**
 * Offline question bank for Test Generator placeholder papers.
 *
 * Loads a shared topic-aware bank (packages/ai/knowledge_base/offline) so that
 * offline papers contain real, exam-style questions instead of generic filler.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { QuestionSlot } from './paper-types';
import { MCQ_LABELS, PART_LABELS } from './paper-presets';

interface OfflineStructuredTemplate {
  stem: string;
  parts: string[];
  vars?: Record<string, Array<string | number>>;
}

interface OfflineMcqTemplate {
  stem: string;
  answer: string;
  distractors: string[];
}

interface OfflineMatchingTemplate {
  listA: string[];
  listB: string[];
  answers: string[];
}

interface OfflineUnitData {
  structured?: OfflineStructuredTemplate[];
  essay?: OfflineStructuredTemplate[];
  mcq?: OfflineMcqTemplate[];
  matching?: OfflineMatchingTemplate;
}

interface OfflineSubjectData {
  subject_name?: string;
  units: Record<string, OfflineUnitData>;
  fallback: OfflineUnitData;
}

interface OfflineBank {
  version: number;
  subjects: Record<string, OfflineSubjectData>;
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
const BANK_PATH = join(PKG_ROOT, 'knowledge_base', 'offline', 'offline_questions.json');

let bankCache: OfflineBank | null = null;

function loadBank(): OfflineBank {
  if (bankCache) return bankCache;
  const raw = JSON.parse(readFileSync(BANK_PATH, 'utf8')) as OfflineBank;
  bankCache = raw;
  return raw;
}

export function offlineBankAvailable(): boolean {
  try {
    return existsSync(BANK_PATH);
  } catch {
    return false;
  }
}

export function normalizeUnitKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface OfflineContext {
  subjectSlug: string;
  subjectName: string;
  topic: string;
  seed: number;
}

const OPTS = ['A', 'B', 'C', 'D'];

function fillTemplate(text: string, ctx: OfflineContext): string {
  return String(text || '')
    .replace(/\{topic\}/g, ctx.topic)
    .replace(/\{subject\}/g, ctx.subjectName);
}

function subjectData(ctx: OfflineContext): OfflineSubjectData {
  return loadBank().subjects[ctx.subjectSlug] || loadBank().subjects['physics'];
}

function applyVars(text: string, vars: Record<string, Array<string | number>> | undefined, seed: number): string {
  let out = text;
  if (vars) {
    for (const [key, pool] of Object.entries(vars)) {
      if (!pool?.length) continue;
      const value = pool[seed % pool.length];
      out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }
  return out;
}

function resolveUnitData(subject: OfflineSubjectData, topicKey: string): OfflineUnitData | null {
  if (!topicKey) return null;
  if (subject.units[topicKey]) return subject.units[topicKey];
  const entry = Object.entries(subject.units).find(([key]) => key.includes(topicKey) || topicKey.includes(key));
  return entry ? entry[1] : null;
}

function pickTemplates(
  unit: OfflineUnitData,
  kind: 'structured' | 'essay',
): OfflineStructuredTemplate[] {
  const sources: Array<OfflineStructuredTemplate[] | undefined> =
    kind === 'essay' ? [unit.essay, unit.structured] : [unit.structured];
  const out: OfflineStructuredTemplate[] = [];
  for (const src of sources) {
    if (src?.length) out.push(...src);
  }
  return out;
}

function renderStructuredTemplate(tpl: OfflineStructuredTemplate, ctx: OfflineContext, partCount: number) {
  const stem = fillTemplate(applyVars(tpl.stem, tpl.vars, ctx.seed), ctx);
  const desired = Math.max(1, partCount);
  const parts = tpl.parts
    .map((p) => fillTemplate(applyVars(p, tpl.vars, ctx.seed), ctx))
    .slice(0, desired);
  while (parts.length < desired) {
    parts.push(`Show all working and explain your reasoning clearly.`);
  }
  return {
    type: 'structured',
    text: stem,
    parts: parts.map((text) => ({ text })),
  };
}

function collectMcqPool(subject: OfflineSubjectData, unitKey: string): OfflineMcqTemplate[] {
  const unit = unitKey ? subject.units[unitKey] : undefined;
  const pool: OfflineMcqTemplate[] = [];
  if (unit?.mcq?.length) pool.push(...unit.mcq);
  for (const key of Object.keys(subject.units)) {
    if (key === unitKey) continue;
    const data = subject.units[key]?.mcq;
    if (data?.length) pool.push(...data);
  }
  const fallback = subject.fallback?.mcq;
  if (fallback?.length) pool.push(...fallback);
  return pool;
}

function renderMcqBundle(slot: QuestionSlot, ctx: OfflineContext, unitKey: string) {
  const count = slot.item_count || 10;
  const subject = subjectData(ctx);
  const pool = collectMcqPool(subject, unitKey);
  const used = new Set<string>();
  const items: Array<{ number: string; text: string; options: Record<string, string>; answer: string; marks: number }> = [];
  let cursor = ctx.seed % Math.max(1, pool.length);

  for (let i = 0; i < count; i++) {
    let tpl = pool[cursor % pool.length];
    let guard = 0;
    while (used.has(tpl.stem) && guard < pool.length) {
      cursor += 1;
      tpl = pool[cursor % pool.length];
      guard += 1;
    }
    used.add(tpl.stem);
    cursor += 1;

    const text = fillTemplate(tpl.stem, ctx);
    const rotation = (ctx.seed + i) % 4;
    const options = [tpl.answer, ...tpl.distractors.slice(0, 3)];
    const rotated = [...options.slice(rotation), ...options.slice(0, rotation)];
    const positioned: Record<string, string> = {};
    rotated.forEach((opt, idx) => {
      positioned[OPTS[idx]] = opt;
    });

    items.push({
      number: MCQ_LABELS[i] || String(i + 1),
      text,
      options: positioned,
      answer: OPTS[(4 - rotation) % 4],
      marks: 1,
    });
  }

  return {
    type: 'mcq_bundle',
    text: slot.stem || `For each of the items (i)-(${MCQ_LABELS[count - 1] || 'x'}), choose the correct answer.`,
    items,
  };
}

function renderStructuredOrEssay(slot: QuestionSlot, ctx: OfflineContext, unitKey: string) {
  const subject = subjectData(ctx);
  const unit = resolveUnitData(subject, unitKey);
  const templates = pickTemplates(unit || subject.fallback, slot.type === 'essay' ? 'essay' : 'structured');
  const tpl = templates[ctx.seed % templates.length] || {
    stem: `Answer the question on ${ctx.topic}.`,
    parts: ['Provide a clear and complete answer.'],
  };
  return renderStructuredTemplate(tpl, ctx, slot.part_count || 2);
}

function renderMatching(slot: QuestionSlot, ctx: OfflineContext, unitKey: string) {
  const subject = subjectData(ctx);
  const unit = resolveUnitData(subject, unitKey);
  const template = unit?.matching || subject.fallback?.matching;
  const count = slot.item_count || 5;
  let listA: string[];
  let answers: string[];
  if (template && template.listA.length) {
    listA = template.listA.slice(0, count).map((a) => fillTemplate(a, ctx));
    answers = template.answers.slice(0, count);
  } else {
    listA = Array.from({ length: count }, (_, i) => fillTemplate(`Term ${i + 1} related to ${ctx.topic}`, ctx));
    answers = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
  }
  while (listA.length < count) {
    listA.push(fillTemplate(`Term ${listA.length + 1} related to ${ctx.topic}`, ctx));
    answers.push(String.fromCharCode(65 + (listA.length - 1)));
  }
  const listB = (template?.listB || []).map((b) => fillTemplate(b, ctx));
  while (listB.length < count + 2) {
    listB.push(fillTemplate(`Response ${listB.length + 1} for ${ctx.topic}`, ctx));
  }
  return { type: 'matching', text: slot.stem || 'Match each item in List A with the correct response in List B.', listA, listB, answers };
}

const APPARATUS: Record<string, string[]> = {
  physics: ['Metre rule', 'Stopwatch', 'Balances', 'Measuring cylinder', 'String'],
  chemistry: ['Measuring cylinder', 'Bunsen burner', 'Test tubes', 'Beaker', 'Thermometer'],
  default: ['Metre rule', 'Stopwatch', 'Measuring cylinder'],
};

function renderPractical(slot: QuestionSlot, ctx: OfflineContext) {
  const apparatus = APPARATUS[ctx.subjectSlug] || APPARATUS.default;
  const parts = distributeMarks(slot.marks, slot.part_count || 3);
  return {
    type: 'practical',
    text: `Carry out the practical investigation related to ${ctx.topic} and record your results.`,
    apparatus,
    procedure: [
      'Set up the apparatus as instructed.',
      'Take readings and record them in the table below.',
      'Calculate the required quantity and state your conclusion.',
    ],
    tables: [{ title: 'Results', columns: ['Trial', 'Reading 1', 'Reading 2'], rows: 4 }],
    parts: parts.map((m, i) => ({
      label: PART_LABELS[i] || String(i + 1),
      text: `(${PART_LABELS[i] || i + 1}) Perform the measurements and record the readings.`,
      marks: m,
    })),
  };
}

function distributeMarks(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

export function offlineContentForSlot(slot: QuestionSlot, ctx: OfflineContext): Record<string, unknown> {
  const topicKey = normalizeUnitKey(ctx.topic);
  switch (slot.type) {
    case 'mcq_bundle':
      return renderMcqBundle(slot, ctx, topicKey);
    case 'matching':
      return renderMatching(slot, ctx, topicKey);
    case 'practical':
      return renderPractical(slot, ctx);
    default:
      return renderStructuredOrEssay(slot, ctx, topicKey);
  }
}