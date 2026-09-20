import { chunkLessonHtml, selectLessonChunk } from '../../../src/kb/lesson-chunk';

describe('lesson-chunk', () => {
  const html = `
    <h1>Linear Equations</h1>
    <p>Intro to equations with one variable.</p>
    <h2>Solving by substitution</h2>
    <p>Replace variables step by step using substitution method.</p>
    <h2>Graphing lines</h2>
    <p>Plot coordinates on the Cartesian plane.</p>
  `;

  it('chunks lesson HTML by headings', () => {
    const chunks = chunkLessonHtml(html);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => /substitution/i.test(c.heading + c.text))).toBe(true);
  });

  it('selects the chunk best matching the query', () => {
    const selected = selectLessonChunk('How do I use substitution?', html);
    expect(selected.toLowerCase()).toContain('substitution');
  });
});
