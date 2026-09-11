import { KnowledgeBase } from '../../../src/kb/knowledge-base';

describe('KnowledgeBase', () => {
  const kb = new KnowledgeBase();
  kb.initialize();

  it('loads the prebuilt index and reports stats', () => {
    expect(kb.ready).toBe(true);
    expect(kb.stats.total).toBeGreaterThan(500);
    expect(kb.stats.byKind.syllabus).toBeGreaterThan(5);
    expect(kb.stats.byKind.exam!).toBeGreaterThan(400);
    expect(kb.stats.subjects).toBeGreaterThan(3);
  });

  it('exposes NECTA subject codes', () => {
    expect(kb.subjectCodes['021']).toBe('Chemistry');
    expect(kb.subjectCodes['041']).toBe('Mathematics');
  });

  it('returns ranked keyword hits for a query', () => {
    const hits = kb.search('chemical reaction', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits[0].doc).toBeTruthy();
  });

  it('filters search by subject', () => {
    const hits = kb.search('chemical reaction', { subject: 'Chemistry', limit: 20 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.doc.subject.toLowerCase()).toContain('chemistry');
    }
  });

  it('filters search by kind', () => {
    const hits = kb.search('syllabus chemistry', { kind: ['syllabus'], limit: 10 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.doc.kind).toBe('syllabus');
  });

  it('looks up a syllabus by NECTA code', () => {
    const doc = kb.lookupSyllabus('032');
    expect(doc).not.toBeNull();
    expect(doc!.subject).toBe('Chemistry');
  });

  it('renders a document body from its source file', () => {
    const hit = kb.lookupSyllabus('032');
    const text = kb.getDocText(hit!.id);
    expect(text).toBeTruthy();
    expect(text!.toLowerCase()).toContain('chemistry');
  });

  it('builds RAG context with docs and formatted text', () => {
    const ctx = kb.buildRagContext(
      'What is a chemical reaction and why is it important?',
      { subject: 'Chemistry', limit: 3 },
      6000,
    );
    expect(ctx.docs.length).toBeGreaterThan(0);
    expect(ctx.text.length).toBeGreaterThan(100);
    expect(ctx.text).toContain('[[KB:');
  });

  it('returns empty results for an absent query', () => {
    expect(kb.search('zzzzzznotawordzzzzz').length).toBe(0);
    expect(kb.search('')).toEqual([]);
  });

  it('looks up exams by level and subject', () => {
    const exams = kb.lookupExam({ level: 'csee', subject: 'chemistry' }).slice(0, 3);
    expect(exams.length).toBeGreaterThan(0);
  });
});
