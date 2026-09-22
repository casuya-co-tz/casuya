/**
 * Optional web-search grounding for Test Generator ("super" mode).
 *
 * Powered by the official @tavily/core SDK. Key-gated and failure-isolated:
 * every path that cannot prove a successful search returns [] so paper
 * generation never blocks on the web.
 *
 * Enabled automatically when TAVILY_API_KEY is set. Other providers (Brave,
 * Google CSE, Bing) can be added behind the same interface later.
 */

import type { TavilyClient } from '@tavily/core';
import { tavily } from '@tavily/core';
import { stripHtml, truncate } from '../utilities/text-utils';

/** Structural subset of TavilyClient so tests can inject a fake. */
export interface TavilyLike {
  search(
    query: string,
    options?: {
      searchDepth?: string;
      maxResults?: number;
      timeout?: number;
      includeAnswer?: boolean | string;
    },
  ): Promise<{
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string; rawContent?: string }>;
  }>;
}

export interface WebSearchDoc {
  title: string;
  url: string;
  snippet: string;
  content: string;
}

export interface WebSearchBatch {
  docs: WebSearchDoc[];
  answer?: string;
}

export interface WebSearchOptions {
  limit?: number;
  maxChars?: number;
  timeoutMs?: number;
  includeAnswer?: boolean;
}

const DEFAULT_LIMIT = 4;
const DEFAULT_MAX_CHARS = 6500;
const DEFAULT_TIMEOUT_MS = 9000;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** True when a web-search key is configured. Never throws. */
export function webSearchEnabled(): boolean {
  try {
    return Boolean(env('TAVILY_API_KEY'));
  } catch {
    return false;
  }
}

/** True when the knowledge base produced no docs for the requested topic. */
export function isKbThin(kbDocs: unknown[]): boolean {
  return !Array.isArray(kbDocs) || kbDocs.length === 0;
}

/** Build a focused, syllabus-flavored search query from the test request. */
export function formLevelLabel(level?: number): string {
  if (!level || !Number.isInteger(level) || level < 1 || level > 6) return '';
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return `Form ${romans[level - 1]}`;
}

/** Build a focused, syllabus-flavored search query from the test request. */
export function buildWebQuery(args: {
  subject: string;
  subjectSlug: string;
  formLabel?: string;
  testTypeLabel?: string;
  topic: string;
  topics: string[];
  subtopics: string[];
  paper?: string;
}): string {
  const subject = args.subjectSlug && args.subjectSlug !== 'generic' ? args.subjectSlug : 'subject';
  const parts = [`${subject} ${args.subject}`, args.formLabel, args.testTypeLabel, args.paper, args.topic, ...args.topics, ...args.subtopics]
    .filter((p) => p && String(p).trim())
    .map((p) => String(p).trim());
  const seen = new Set<string>();
  const uni = parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return uni
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function cleanContent(text: string, maxDocChars: number): string {
  return normalizeSpace(stripHtml(text || '')).slice(0, maxDocChars);
}

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Render web results as a labeled reference block for the necta prompt. */
export function formatWebContext(
  docs: WebSearchDoc[],
  opts: { maxChars?: number; subject?: string; answers?: string[] } = {},
): string {
  const maxChars = opts.maxChars || DEFAULT_MAX_CHARS;
  const usable = (docs || []).filter((d) => d && d.title && (d.content || d.snippet)).slice(0, DEFAULT_LIMIT);
  if (!usable.length && !(opts.answers || []).length) return '';

  const header = [
    `# SUPPLEMENTARY WEB REFERENCE (research material for ${opts.subject || 'this subject'})`,
    'Content below comes from web search results. Use it only when it clearly matches the syllabus level; do not invent facts. Keep all questions in strict NECTA exam style.',
    '',
  ].join('\n');

  const blocks: string[] = [];
  const synthesized = (opts.answers || []).map(normalizeSpace).filter((a) => a).slice(0, 3);
  if (synthesized.length) {
    blocks.push(
      'WEB RESEARCH SUMMARY (synthesized from the sources below):',
      ...synthesized.map((a) => `- ${a}`),
      '',
    );
  }
  if (usable.length) {
    const entries = usable.map((d, i) => {
      const body = d.content || d.snippet;
      return `${i + 1}. ${d.title}\n   ${normalizeSpace(body)}\n   Source: ${d.url}`;
    });
    blocks.push(entries.join('\n\n'));
  }

  const full = `${header}\n${blocks.join('\n\n')}`;
  return full.length <= maxChars ? full : truncate(full, maxChars);
}

/** Build a primary query plus one focused variant per distinct topic/subtopic. */
export function buildQueryVariants(base: string, topics: string[], subtopics: string[]): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const clean = q.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(clean);
  };
  push(base);
  for (const t of [...topics, ...subtopics]) {
    push(`${base} ${String(t || '').trim()}`);
    if (variants.length >= 3) break;
  }
  return variants;
}

/** Build the SDK client when a key is configured; otherwise null. */
function buildTavilyClient(): TavilyLike | null {
  const apiKey = env('TAVILY_API_KEY');
  if (!apiKey) return null;
  try {
    const client: TavilyClient = tavily({ apiKey });
    return client;
  } catch {
    return null;
  }
}

async function searchTavilyFull(
  client: TavilyLike,
  query: string,
  opts: WebSearchOptions = {},
): Promise<WebSearchBatch> {
  const limit = opts.limit || DEFAULT_LIMIT;
  const maxDoChars = 1400;

  const response = await client.search(query, {
    searchDepth: 'basic',
    maxResults: Math.max(1, Math.min(8, limit)),
    timeout: opts.timeoutMs || DEFAULT_TIMEOUT_MS,
    includeAnswer: opts.includeAnswer || false,
  });

  const docs: WebSearchDoc[] = [];
  for (const raw of response.results || []) {
    if (!raw?.title || !raw?.url) continue;
    const body = raw.content || raw.rawContent || '';
    docs.push({
      title: normalizeSpace(raw.title),
      url: String(raw.url),
      snippet: cleanContent(body || raw.title, maxDoChars),
      content: cleanContent(body, maxDoChars),
    });
  }
  const answer = typeof response.answer === 'string' ? response.answer.trim() : '';
  return { docs: docs.slice(0, limit), answer: answer || undefined };
}

/**
 * Try to enrich a paper from the web. Returns { docs: [] } on any error or if
 * disabled. An optional client may be injected for tests.
 */
export async function searchWebWithAnswer(
  query: string,
  opts: WebSearchOptions = {},
  client?: TavilyLike,
): Promise<WebSearchBatch> {
  if (!webSearchEnabled() || !query) return { docs: [] };
  try {
    const active = client ?? buildTavilyClient();
    if (!active) return { docs: [] };
    return await searchTavilyFull(active, query, opts);
  } catch {
    // Any failure (network, rate-limit, malformed response) — no results,
    // never crash or block paper generation.
    return { docs: [] };
  }
}

/** Backward-compatible wrapper: doc list only (no synthesized answer). */
export async function fetchWebDocs(
  query: string,
  opts: WebSearchOptions = {},
  client?: TavilyLike,
): Promise<WebSearchDoc[]> {
  const batch = await searchWebWithAnswer(query, { ...opts, includeAnswer: false }, client);
  return batch.docs;
}

/** Run a fan of queries in parallel and merge results (dedupe by URL). */
export async function searchWebContext(
  queries: string[],
  opts: WebSearchOptions = {},
  client?: TavilyLike,
): Promise<{ docs: WebSearchDoc[]; answers: string[] }> {
  if (!webSearchEnabled()) return { docs: [], answers: [] };
  const list = (queries || []).map((q) => String(q || '').trim()).filter(Boolean).slice(0, 3);
  if (!list.length) return { docs: [], answers: [] };

  const batches = await Promise.allSettled(
    list.map((q) => searchWebWithAnswer(q, { includeAnswer: true, ...opts }, client)),
  );

  const docs: WebSearchDoc[] = [];
  const seen = new Set<string>();
  const answers: string[] = [];
  for (const result of batches) {
    if (result.status !== 'fulfilled') continue;
    if (result.value.answer) answers.push(result.value.answer);
    for (const d of result.value.docs) {
      if (seen.has(d.url)) continue;
      seen.add(d.url);
      docs.push(d);
    }
  }
  const cap = opts.limit || 6;
  return { docs: docs.slice(0, cap), answers: answers.slice(0, 3) };
}

export function searchProviderName(): string {
  return webSearchEnabled() ? 'tavily' : '';
}