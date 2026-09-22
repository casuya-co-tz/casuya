import {
  buildQueryVariants,
  buildWebQuery,
  fetchWebDocs,
  formLevelLabel,
  formatWebContext,
  isKbThin,
  searchWebContext,
  searchWebWithAnswer,
  TavilyLike,
  webSearchEnabled,
  WebSearchDoc,
} from '../../../src/rag/web-search';

const OLD_TAVILY_KEY = process.env.TAVILY_API_KEY;

afterEach(() => {
  if (OLD_TAVILY_KEY === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = OLD_TAVILY_KEY;
});

function fakeClient(overrides: Partial<TavilyLike> = {}): TavilyLike {
  return {
    search: jest.fn().mockResolvedValue({
      results: [
        { title: '  Forces  ', url: 'https://example.com/forces', content: '  Forces cause <b>acceleration</b>   ' },
        { title: 'Friction', url: 'https://example.com/friction', content: 'Friction resists motion.' },
      ],
    }),
    ...overrides,
  };
}

describe('webSearchEnabled', () => {
  it('is false when no key is configured', () => {
    delete process.env.TAVILY_API_KEY;
    expect(webSearchEnabled()).toBe(false);
  });

  it('is true when a key is configured', () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    expect(webSearchEnabled()).toBe(true);
  });

  it('treats whitespace-only keys as unset', () => {
    process.env.TAVILY_API_KEY = '   ';
    expect(webSearchEnabled()).toBe(false);
  });
});

describe('isKbThin', () => {
  it('is true when the KB returned no docs', () => {
    expect(isKbThin([])).toBe(true);
    expect(isKbThin(undefined as unknown as unknown[])).toBe(true);
    expect(isKbThin(null as unknown as unknown[])).toBe(true);
    expect(isKbThin('x' as unknown as unknown[])).toBe(true);
  });

  it('is false when at least one doc came back', () => {
    expect(isKbThin([{ id: 1 }])).toBe(false);
  });
});

describe('formLevelLabel', () => {
  it('converts form numbers to roman numerals', () => {
    expect(formLevelLabel(1)).toBe('Form I');
    expect(formLevelLabel(4)).toBe('Form IV');
    expect(formLevelLabel(6)).toBe('Form VI');
  });

  it('disallows out-of-range values', () => {
    expect(formLevelLabel(0)).toBe('');
    expect(formLevelLabel(7)).toBe('');
    expect(formLevelLabel(undefined as unknown as number)).toBe('');
  });
});

describe('buildWebQuery', () => {
  it('includes subject, topic and subtopics', () => {
    const q = buildWebQuery({
      subject: 'Physics',
      subjectSlug: 'physics',
      formLabel: 'Form IV',
      testTypeLabel: 'Mock Exam',
      topic: 'Forces',
      topics: ['Forces', 'Friction'],
      subtopics: ['Newton Laws'],
    });
    expect(q).toContain('physics');
    expect(q).toContain('Forces');
    expect(q).toContain('Newton Laws');
    expect(q.toLowerCase()).toEqual(q.toLowerCase());
  });

  it('dedupes repeated terms and caps length', () => {
    const q = buildWebQuery({
      subject: 'Math',
      subjectSlug: 'math',
      topic: 'Sets',
      topics: ['Sets', 'Sets'],
      subtopics: [],
    });
    expect((q.match(/Sets/g) || []).length).toBe(1);
    expect(q.length).toBeLessThanOrEqual(300);
  });
});

describe('formatWebContext', () => {
  it('returns empty for no results', () => {
    expect(formatWebContext([])).toBe('');
    expect(formatWebContext(null as unknown as WebSearchDoc[])).toBe('');
  });

  it('builds a labeled block with source urls', () => {
    const docs: WebSearchDoc[] = [
      { title: 'Forces notes', url: 'https://example.com/forces', snippet: 'Overview of forces.', content: 'Forces cause acceleration.' },
    ];
    const out = formatWebContext(docs, { subject: 'Physics' });
    expect(out).toContain('SUPPLEMENTARY WEB REFERENCE');
    expect(out).toContain('Forces notes');
    expect(out).toContain('https://example.com/forces');
    expect(out).toContain('Physics');
  });

  it('caps the total block size', () => {
    const docs: WebSearchDoc[] = [
      { title: 'A', url: 'https://example.com/a', snippet: '', content: 'x'.repeat(2000) },
    ];
    const out = formatWebContext(docs, { maxChars: 200 });
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('renders a synthesized answer summary above the sources', () => {
    const docs: WebSearchDoc[] = [
      { title: 'Forces notes', url: 'https://example.com/forces', snippet: '', content: 'Forces cause acceleration.' },
    ];
    const out = formatWebContext(docs, { subject: 'Physics', answers: [' Forces cause acceleration  '] });
    expect(out).toContain('WEB RESEARCH SUMMARY');
    expect(out).toContain('Forces cause acceleration');
    expect(out.indexOf('WEB RESEARCH SUMMARY')).toBeLessThan(out.indexOf('1. Forces notes'));
  });

  it('renders answers even when no docs survived filtering', () => {
    const out = formatWebContext([], { answers: ['Only a summary.'], subject: 'Physics' });
    expect(out).toContain('Only a summary.');
    expect(out).not.toContain('1.');
  });

  it('returns empty when there are no docs and no answers', () => {
    expect(formatWebContext([], { answers: [] })).toBe('');
  });

  it('ignores results without a title or content', () => {
    const docs = [{ title: '', url: 'https://example.com/x', snippet: '', content: 'body' }] as WebSearchDoc[];
    expect(formatWebContext(docs)).toBe('');
  });
});

describe('fetchWebDocs', () => {
  it('returns [] without a key, without touching the client', async () => {
    delete process.env.TAVILY_API_KEY;
    const client = { search: jest.fn() } as unknown as TavilyLike;
    const docs = await fetchWebDocs('physics forces', {}, client);
    expect(docs).toEqual([]);
    expect(client.search).not.toHaveBeenCalled();
  });

  it('parses SDK results when the key is set', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient();
    const docs = await fetchWebDocs('physics forces', {}, client);
    expect(docs).toHaveLength(2);
    expect(docs[0].title).toBe('Forces');
    expect(docs[0].url).toBe('https://example.com/forces');
    expect(docs[0].content).toContain('acceleration');
    expect(docs[0].content).not.toContain('<b>');
  });

  it('falls back to rawContent when content is absent', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({
      search: jest.fn().mockResolvedValue({
        results: [{ title: 'Kinematics', url: 'https://example.com/kin', content: '', rawContent: 'Distance = speed over time' }],
      }),
    });
    const docs = await fetchWebDocs('physics kinematics', {}, client);
    expect(docs[0].content).toContain('Distance');
  });

  it('passes limit (clamped) and timeout to the SDK', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const searchFn = jest.fn().mockResolvedValue({ results: [] });
    await fetchWebDocs('physics forces', { limit: 3, timeoutMs: 1234 }, { search: searchFn });
    expect(searchFn).toHaveBeenCalledWith(
      'physics forces',
      expect.objectContaining({ searchDepth: 'basic', maxResults: 3, timeout: 1234 }),
    );
  });

  it('returns [] when the client throws', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({ search: jest.fn().mockRejectedValue(new Error('network down')) });
    const docs = await fetchWebDocs('physics forces', {}, client);
    expect(docs).toEqual([]);
  });

  it('returns [] when results lack a title or url', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({
      search: jest.fn().mockResolvedValue({
        results: [{ title: '', url: 'https://example.com/x', content: 'no title' }],
      }),
    });
    const docs = await fetchWebDocs('physics forces', {}, client);
    expect(docs).toEqual([]);
  });

  it('caps the result count at the requested limit', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({
      search: jest.fn().mockResolvedValue({
        results: [1, 2, 3, 4, 5].map((i) => ({ title: `R${i}`, url: `https://example.com/${i}`, content: 'body' })),
      }),
    });
    const docs = await fetchWebDocs('physics forces', { limit: 3 }, client);
    expect(docs).toHaveLength(3);
  });
});

describe('buildQueryVariants', () => {
  it('returns the base query plus one variant per distinct topic/subtopic', () => {
    const variants = buildQueryVariants('physics forces', ['Forces', 'Friction', 'Forces'], ['Newton Laws']);
    expect(variants[0]).toBe('physics forces');
    expect(variants).toEqual(expect.arrayContaining(['physics forces Forces', 'physics forces Friction']));
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('caps the fan-out at three queries', () => {
    const variants = buildQueryVariants('math sets', ['Sets', 'Sets2', 'Sets3', 'Sets4'], ['Operators', 'Venn Diagrams']);
    expect(variants).toHaveLength(3);
    expect(variants.length).toBeLessThanOrEqual(3);
  });

  it('handles empty input gracefully', () => {
    expect(buildQueryVariants('math sets', [], [])).toEqual(['math sets']);
    expect(buildQueryVariants('', [], [])).toEqual([]);
  });
});

describe('searchWebWithAnswer', () => {
  it('returns the synthesized answer when includeAnswer is on', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({
      search: jest.fn().mockResolvedValue({
        answer: '  Forces cause acceleration.  ',
        results: [{ title: 'Forces', url: 'https://example.com/forces', content: 'body' }],
      }),
    });
    const batch = await searchWebWithAnswer('physics forces', { includeAnswer: true }, client);
    expect(batch.answer).toBe('Forces cause acceleration.');
    expect(batch.docs).toHaveLength(1);
  });

  it('requests includeAnswer only when asked', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const searchFn = jest.fn().mockResolvedValue({ results: [] });
    await searchWebWithAnswer('physics forces', { includeAnswer: true }, { search: searchFn });
    expect(searchFn).toHaveBeenCalledWith('physics forces', expect.objectContaining({ includeAnswer: true }));
  });

  it('is failure-isolated', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({ search: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(searchWebWithAnswer('physics forces', {}, client)).resolves.toEqual({ docs: [] });
  });
});

describe('searchWebContext', () => {
  it('fans out across queries, merges and dedupes by url', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({
      search: jest.fn().mockImplementation(async (query: string) => ({
        answer: `answer for ${query}`,
        results: [
          { title: 'Shared', url: 'https://example.com/shared', content: 'body' },
          { title: query, url: `https://example.com/${encodeURIComponent(query)}`, content: 'body' },
        ],
      })),
    });
    const { docs, answers } = await searchWebContext(['physics', 'physics forces', 'physics friction'], { limit: 10 }, client);
    expect(docs.length).toBe(4);
    const shared = docs.filter((d) => d.url === 'https://example.com/shared');
    expect(shared).toHaveLength(1);
    expect(answers.length).toBeGreaterThanOrEqual(2);
    expect(answers[0]).toContain('answer for');
  });

  it('caps merged results', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    const client = fakeClient({
      search: jest.fn().mockResolvedValue({
        answer: '',
        results: [1, 2, 3, 4, 5].map((i) => ({ title: `R${i}`, url: `https://example.com/${i}`, content: 'body' })),
      }),
    });
    const { docs } = await searchWebContext(['physics', 'physics two'], { limit: 4 }, client);
    expect(docs).toHaveLength(4);
  });

  it('does nothing when disabled or with no queries', async () => {
    delete process.env.TAVILY_API_KEY;
    const { docs, answers } = await searchWebContext(['physics'], {}, fakeClient());
    expect(docs).toEqual([]);
    expect(answers).toEqual([]);

    process.env.TAVILY_API_KEY = 'tvly-test';
    const searchFn = jest.fn().mockResolvedValue({ results: [] });
    const empty = await searchWebContext([], {}, { search: searchFn });
    expect(empty.docs).toEqual([]);
    expect(empty.answers).toEqual([]);
    expect(searchFn).not.toHaveBeenCalled();
  });
});