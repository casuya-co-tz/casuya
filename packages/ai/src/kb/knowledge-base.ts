import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  KbDoc,
  KbIndex,
  KbKind,
  RagContextDoc,
  SearchHit,
  SearchOptions,
} from './types';
import { renderDoc, renderSnippet } from './renderers';

/**
 * Locate the directory that directly contains both `kb-data/` and
 * `knowledge_base/` by walking up from this compiled/source module. This works
 * whether kB runs from src/ or dist/, avoiding hardcoded depth assumptions.
 */
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

const STOPWORDS = new Set(
  `a an and are as at be but by for from had has have he her his i if in into is
   it its me my no not of on or our she so than that the their them then there
   these they this to up was we were what when where which who will with you your
   does do did can could should would may might must shall been being am about
   after also because before between both each few how more most other over same
   some such than too under very via`
    .trim()
    .split(/\s+/),
);

function tokenize(text: string): string[] {
  if (!text) return [];
  const words = String(text).toLowerCase().match(/[a-z0-9']+/g) || [];
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

const KIND_WEIGHT: Record<string, number> = {
  marking_scheme: 1.5,
  exam_format: 1.3,
  syllabus: 1.2,
  lesson: 1.1,
  scheme: 1.0,
  exam: 0.95,
  reference: 0.5,
};

export class KnowledgeBase {
  private index: KbIndex | null = null;
  private root: string;
  private avgDocLen = 0;
  private docLen: number[] = [];
  private initialized = false;
  private initError: Error | null = null;

  constructor(root?: string) {
    this.root = root || findPkgRoot(__dirname);
  }

  /** Initialize by loading the prebuilt index. Safe to call multiple times. */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const p = join(this.root, 'kb-data', 'index.json');
      if (!existsSync(p)) {
        this.initError = new Error(`KB index not found at ${p}. Run: node scripts/build-kb.mjs`);
        return;
      }
      const index = JSON.parse(readFileSync(p, 'utf8')) as KbIndex;
      this.index = index;
      const docs = index.docs;
      const totalTokens = docs.reduce((sum, d) => sum + (d.tokens || 0), 0);
      this.avgDocLen = docs.length ? totalTokens / docs.length : 1;
      this.docLen = docs.map((d) => d.tokens || 1);
    } catch (err) {
      this.initError = err instanceof Error ? err : new Error(String(err));
    }
  }

  get ready(): boolean {
    return !!(this.initialized && this.index && this.initError === null);
  }

  get error(): Error | null {
    return this.initError;
  }

  get stats(): { total: number; byKind: Partial<Record<KbKind, number>>; subjects: number } {
    if (!this.index) return { total: 0, byKind: {}, subjects: 0 };
    return {
      total: this.index.docs.length,
      byKind: this.index.counts.byKind,
      subjects: Object.keys(this.index.subjectCodes).length,
    };
  }

  get subjectCodes(): Record<string, string> {
    return this.index?.subjectCodes || {};
  }

  listDocs(opts: { kind?: string; subject?: string; level?: string } = {}): KbDoc[] {
    const index = this.index;
    if (!index) return [];
    return index.docs.filter((d) => {
      if (opts.kind && d.kind !== opts.kind) return false;
      if (opts.subject) {
        const s = opts.subject.toLowerCase();
        if (!d.subject.toLowerCase().includes(s) && !(d.code || '').toLowerCase().includes(s)) return false;
      }
      if (opts.level && d.level !== opts.level) return false;
      return true;
    });
  }

  /** BM25 keyword search across the indexed corpus with metadata filters. */
  search(query: string, opts: SearchOptions = {}): SearchHit[] {
    if (!this.index || !query) return [];
    const limit = opts.limit || 8;
    const terms = tokenize(query);
    if (!terms.length) return [];

    const docs = this.index.docs;
    const N = docs.length;
    const k1 = 1.2;
    const b = 0.75;

    const scores = new Map<number, number>();
    const seen = new Set<number>();

    // Pre-filter candidate docs by metadata when filters supplied.
    const isCandidate =
      opts.subject || opts.form || opts.year || opts.kind?.length
        ? (d: KbDoc) => {
            if (opts.kind?.length && !opts.kind.includes(d.kind)) return false;
            if (opts.subject) {
              const s = opts.subject.toLowerCase();
              if (!d.subject.toLowerCase().includes(s) && !(d.code || '').toLowerCase().includes(s)) return false;
            }
            if (opts.form && d.form && d.form !== opts.form) return false;
            if (opts.year && d.year !== opts.year) return false;
            return true;
          }
        : null;

    for (const term of terms) {
      const postings = this.index.inverted[term];
      if (!postings) continue;
      const df = postings.length;
      const idf = df === 0 ? 0 : Math.log(1 + (N - df + 0.5) / (df + 0.5));
      if (idf <= 0) continue;
      for (const [docId, tf] of postings) {
        if (seen.has(docId) && !scores.has(docId)) continue;
        const doc = docs[docId];
        if (!doc) continue;
        if (isCandidate && !isCandidate(doc)) continue;
        const len = this.docLen[docId] || 1;
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / (this.avgDocLen || 1))));
        const score = idf * tfNorm * (KIND_WEIGHT[doc.kind] || 1);
        scores.set(docId, (scores.get(docId) || 0) + score);
        seen.add(docId);
      }
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    return ranked.map(([docId, score]) => {
      const doc = docs[docId];
      return { docId, doc, score: Math.round(score * 1000) / 1000, snippet: doc.title };
    });
  }

  /** Get a single doc's rendered content (reads its source JSON on demand). */
  getDoc(docId: number): KbDoc | null {
    return this.index?.docs[docId] || null;
  }

  getDocText(docId: number): string | null {
    const doc = this.getDoc(docId);
    if (!doc || !this.index) return null;
    try {
      const path = join(this.root, 'knowledge_base', doc.file);
      const data = JSON.parse(readFileSync(path, 'utf8'));
      return renderDoc(doc.kind, data);
    } catch {
      return null;
    }
  }

  /**
   * Build RAG context from the top-ranked docs for a query, capped to a char
   * budget. Returns structured context blocks plus formatted prompt text.
   */
  buildRagContext(
    query: string,
    opts: SearchOptions = {},
    maxChars = 6000,
  ): { docs: RagContextDoc[]; text: string } {
    const hits = this.search(query, { ...opts, limit: opts.limit || 4 });
    const docs: RagContextDoc[] = [];
    const blocks: string[] = [];
    let used = 0;

    for (const hit of hits) {
      if (used >= maxChars) break;
      const text = this.getDocText(hit.docId);
      if (!text) continue;
      const file = this.getDoc(hit.docId)?.file || '';
      const isEssay = /(marking_scheme|syllabus|exam)/.test(hit.doc.kind);
      const budget = Math.min(maxChars - used, isEssay ? 2600 : 1400);
      const clipped = text.slice(0, budget);
      docs.push({
        docId: hit.docId,
        kind: hit.doc.kind,
        subject: hit.doc.subject,
        code: hit.doc.code,
        form: hit.doc.form,
        year: hit.doc.year,
        title: hit.doc.title,
        text: clipped,
      });
      blocks.push(
        `[[KB:${kindLabel(hit.doc.kind)}|${hit.doc.title}${file ? ' — ' + file : ''}]]\n${clipped}`,
      );
      used += clipped.length;
    }

    return { docs, text: blocks.join('\n\n') };
  }

  lookupSyllabus(code: string): KbDoc | null {
    if (!this.index) return null;
    const c = String(code).toLowerCase();
    const doc = this.index.docs.find(
      (d) => d.kind === 'syllabus' && (d.code || '').toLowerCase() === c,
    );
    return doc || null;
  }

  lookupExam(opts: { level?: string; subject?: string; year?: string; form?: string }): KbDoc[] {
    if (!this.index) return [];
    const level = opts.level?.toLowerCase();
    const subject = opts.subject?.toLowerCase();
    const year = opts.year;
    const form = opts.form;
    return this.index.docs.filter(
      (d) =>
        d.kind === 'exam' &&
        (!level || (d.level || '').toLowerCase() === level) &&
        (!subject || d.subject.toLowerCase().includes(subject) || (d.code || '').toLowerCase().includes(subject)) &&
        (!year || d.year === year) &&
        (!form || d.form === form),
    );
  }

  renderSnippet(docId: number, maxChars = 240): string {
    const doc = this.getDoc(docId);
    if (!doc) return '';
    try {
      const path = join(this.root, 'knowledge_base', doc.file);
      const data = JSON.parse(readFileSync(path, 'utf8'));
      return renderSnippet(data, doc.kind, maxChars);
    } catch {
      return '';
    }
  }

  /** Find all files (for validation / counts). */
  fileList(kind?: string): string[] {
    if (!this.index) return [];
    return this.index.docs.filter((d) => !kind || d.kind === kind).map((d) => d.file);
  }
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'marking_scheme':
      return 'MARKING SCHEME';
    case 'exam_format':
      return 'EXAM FORMAT';
    case 'syllabus':
      return 'SYLLABUS';
    case 'lesson':
      return 'LESSON PLAN';
    case 'scheme':
      return 'SCHEME OF WORK';
    case 'reference':
      return 'REFERENCES';
    default:
      return 'EXAM';
  }
}

let singleton: KnowledgeBase | null = null;

export function getKnowledgeBase(root?: string): KnowledgeBase {
  if (!singleton) {
    singleton = new KnowledgeBase(root);
    singleton.initialize();
  }
  return singleton;
}
