import {
  buildWebQuery,
  fetchWebDocs,
  formLevelLabel,
  formatWebContext,
  isKbThin,
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