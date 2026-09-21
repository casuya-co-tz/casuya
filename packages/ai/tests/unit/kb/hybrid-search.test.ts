import { embeddingsStatus, hybridSearch, resetEmbeddingCache } from '../../../src/kb/hybrid-search';
import { KbDoc, KbIndex, SearchHit } from '../../../src/kb/types';

function hit(docId: number, title: string, score: number): SearchHit {
  const doc: KbDoc = {
    id: docId,
    kind: 'syllabus',
    subject: 'Mathematics',
    title,
    file: 'math/syllabus.json',
    tokens: 100,
  };
  return { docId, doc, score, snippet: title };
}

describe('hybridSearch', () => {
  beforeEach(() => resetEmbeddingCache());

  it('reports missing embeddings index', () => {
    const status = embeddingsStatus('/tmp/casuya-kb-missing');
    expect(status.ready).toBe(false);
    expect(status.count).toBe(0);
  });

  it('re-ranks BM25 hits using metadata overlap', () => {
    const index = { docs: [], version: '1', generated: '', counts: { total: 0, byKind: {} }, subjectCodes: {}, inverted: {} } as KbIndex;
    const hits = [
      hit(0, 'Physics Forces', 10),
      hit(1, 'Linear Equations Algebra', 9),
    ];
    const merged = hybridSearch(hits, 'linear equation algebra', index, { limit: 2 });
    expect(merged[0].doc.title).toContain('Linear');
  });
});
