import { KbDoc, KbIndex, SearchHit, SearchOptions } from './types';

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

export function bm25Search(
  index: KbIndex,
  docLen: number[],
  avgDocLen: number,
  query: string,
  opts: SearchOptions = {},
): SearchHit[] {
  const limit = opts.limit || 8;
  const terms = tokenize(query);
  if (!terms.length) return [];

  const docs = index.docs;
  const N = docs.length;
  const k1 = 1.2;
  const b = 0.75;

  const scores = new Map<number, number>();
  const seen = new Set<number>();

  // Pre-filter candidate docs by metadata when filters supplied.
  const hasFilters =
    !!opts.subject || !!opts.form || !!opts.formNumber || !!opts.year ||
    !!opts.level || !!opts.file || !!opts.kind?.length;
  const isCandidate = hasFilters
      ? (d: KbDoc) => {
          if (opts.kind?.length && !opts.kind.includes(d.kind)) return false;
          if (opts.subject) {
            const s = opts.subject.toLowerCase();
            if (!d.subject.toLowerCase().includes(s) && !(d.code || '').toLowerCase().includes(s)) return false;
          }
          if (opts.form && d.form && d.form !== opts.form) return false;
          if (opts.formNumber && !(d.file || '').includes(`_form${opts.formNumber}_`)) return false;
          if (opts.level && (d.level || '').toLowerCase() !== opts.level.toLowerCase()) return false;
          if (opts.file && !(d.file || '').includes(opts.file)) return false;
          if (opts.year && d.year !== opts.year) return false;
          return true;
        }
      : null;

  for (const term of terms) {
    const postings = index.inverted[term];
    if (!postings) continue;
    const df = postings.length;
    const idf = df === 0 ? 0 : Math.log(1 + (N - df + 0.5) / (df + 0.5));
    if (idf <= 0) continue;
    for (const [docId, tf] of postings) {
      if (seen.has(docId) && !scores.has(docId)) continue;
      const doc = docs[docId];
      if (!doc) continue;
      if (isCandidate && !isCandidate(doc)) continue;
      const len = docLen[docId] || 1;
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / (avgDocLen || 1))));
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