import { KnowledgeBase } from '../../../src/kb/knowledge-base';

describe('KnowledgeBase', () => {
  const kb = new KnowledgeBase();
  kb.initialize();

  it('loads the prebuilt index and reports stats', () => {
    expect(kb.ready).toBe(true);
    expect(kb.stats.total).toBeGreaterThan(2500);
    expect(kb.stats.byKind.syllabus).toBeGreaterThan(20);
    expect(kb.stats.byKind.exam!).toBeGreaterThan(2000);
    expect(kb.stats.subjects).toBeGreaterThan(10);
  });

  it('exposes NECTA subject codes', () => {
    expect(kb.subjectCodes['033']).toBe('Biology');
    expect(kb.subjectCodes['041']).toBe('Mathematics');
  });

  it('returns ranked keyword hits for a query', () => {
    const hits = kb.search('photosynthesis plants', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits[0].doc).toBeTruthy();
  });

  it('filters search by subject', () => {
    const hits = kb.search('photosynthesis', { subject: 'Biology', limit: 20 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.doc.subject.toLowerCase()).toContain('biology');
    }
  });

  it('filters search by kind', () => {
    const hits = kb.search('syllabus chemistry', { kind: ['syllabus'], limit: 10 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.doc.kind).toBe('syllabus');
  });

  it('looks up a syllabus by NECTA code', () => {
    const doc = kb.lookupSyllabus('033');
    expect(doc).not.toBeNull();
    expect(doc!.subject).toBe('Biology');
  });

  it('renders a document body from its source file', () => {
    const hit = kb.lookupSyllabus('033');
    const text = kb.getDocText(hit!.id);
    expect(text).toBeTruthy();
    expect(text!.toLowerCase()).toContain('biology');
  });

  it('builds RAG context with docs and formatted text', () => {
    const ctx = kb.buildRagContext(
      'What is photosynthesis and why is it important?',
      { subject: 'Biology', limit: 3 },
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
    const exams = kb.lookupExam({ level: 'csee', subject: 'biology' }).slice(0, 3);
    expect(exams.length).toBeGreaterThan(0);
  });
});
