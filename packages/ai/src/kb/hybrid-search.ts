import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KbDoc, KbIndex, SearchHit, SearchOptions } from './types';

const STOPWORDS = new Set(
  `a an and are as at be but by for from had has have he her his i if in into is
   it its me my no not of on or our she so than that the their them then there
   these they this to up was we were what when where which who will with you your`
    .trim()
    .split(/\s+/),
);

function tokenize(text: string): string[] {
  if (!text) return [];
  const words = String(text).toLowerCase().match(/[a-z0-9']+/g) || [];
  return words.filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function docFingerprint(doc: KbDoc): Set<string> {
  const raw = [doc.title, doc.subject, doc.kind, doc.code || '', doc.form || ''].join(' ');
  return new Set(tokenize(raw));
}

/** Jaccard overlap between query and doc metadata (offline semantic boost). */
function metadataSimilarity(query: string, doc: KbDoc): number {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const d = docFingerprint(doc);
  if (!d.size) return 0;
  let inter = 0;
  for (const t of q) {
    if (d.has(t)) inter += 1;
  }
  return inter / (q.size + d.size - inter);
}

type EmbeddingIndex = Record<string, number[]>;

let cachedEmbeddings: EmbeddingIndex | null | undefined;

function loadEmbeddings(root: string): EmbeddingIndex | null {
  if (cachedEmbeddings !== undefined) return cachedEmbeddings;
  const path = join(root, 'kb-data', 'embeddings.json');
  if (!existsSync(path)) {
    cachedEmbeddings = null;
    return null;
  }
  try {
    cachedEmbeddings = JSON.parse(readFileSync(path, 'utf8')) as EmbeddingIndex;
  } catch {
    cachedEmbeddings = null;
  }
  return cachedEmbeddings;
}

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Merge BM25 hits with lightweight metadata similarity and optional precomputed
 * embeddings (kb-data/embeddings.json from build-kb --embed).
 */
export function hybridSearch(
  bm25Hits: SearchHit[],
  query: string,
  _index: KbIndex,
  opts: SearchOptions & { kbRoot?: string; queryEmbedding?: number[] } = {},
): SearchHit[] {
  const limit = opts.limit || 8;
  if (!bm25Hits.length) return [];

  const embeddings = opts.kbRoot ? loadEmbeddings(opts.kbRoot) : null;
  const maxBm25 = Math.max(...bm25Hits.map((h) => h.score), 1);

  const merged = bm25Hits.map((hit) => {
    const bm25Norm = hit.score / maxBm25;
    const metaSim = metadataSimilarity(query, hit.doc);
    let embedSim = 0;
    if (embeddings && opts.queryEmbedding?.length) {
      const vec = embeddings[String(hit.docId)];
      if (vec?.length) embedSim = Math.max(0, cosine(opts.queryEmbedding, vec));
    }
    const score =
      bm25Norm * 0.55 +
      metaSim * 0.25 +
      embedSim * (embeddings && opts.queryEmbedding?.length ? 0.2 : 0);
    return { ...hit, score };
  });

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, limit);
}

/** Report precomputed embedding index status (ops / readyz). */
export function embeddingsStatus(kbRoot: string): { ready: boolean; count: number } {
  const embeddings = loadEmbeddings(kbRoot);
  if (!embeddings) return { ready: false, count: 0 };
  const count = Object.keys(embeddings).length;
  return { ready: count > 0, count };
}

/** Reset cached embeddings (tests). */
export function resetEmbeddingCache(): void {
  cachedEmbeddings = undefined;
}
