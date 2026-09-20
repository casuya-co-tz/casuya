import { expandQuery, expandQueryTerms } from '../../../src/kb/query-expansion';

describe('query-expansion', () => {
  it('expands Kiswahili terms to English syllabus keywords', () => {
    const terms = expandQueryTerms('Eleza usanisi wa mimea');
    expect(terms).toEqual(expect.arrayContaining(['usanisi', 'photosynthesis']));
  });

  it('appends glossary terms to the query string', () => {
    const q = expandQuery('What is nguvu?');
    expect(q.toLowerCase()).toContain('force');
  });
});
