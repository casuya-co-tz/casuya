import { describe, it, expect, vi, afterEach } from 'vitest';
import { OcrBridge } from '../src/integrations/OcrBridge';
import { MathBridge } from '../src/integrations/MathBridge';

// Mock the heavy dynamic imports so unit tests stay fast and offline.
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockResolvedValue({ data: { text: 'x = 5', confidence: 90 } }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('katex', () => ({
  renderToString: vi.fn().mockReturnValue('<span class="katex">x=5</span>'),
  render: vi.fn((_latex: string, el: HTMLElement) => {
    el.innerHTML = '<span class="katex">x=5</span>';
  }),
  default: {
    renderToString: vi.fn().mockReturnValue('<span class="katex">x=5</span>'),
    render: vi.fn((_latex: string, el: HTMLElement) => {
      el.innerHTML = '<span class="katex">x=5</span>';
    }),
  },
}));

afterEach(() => vi.clearAllMocks());

describe('OcrBridge (tesseract path)', () => {
  it('recognizes text via the tesseract worker', async () => {
    const bridge = new OcrBridge({ provider: 'tesseract' });
    const result = await bridge.recognize('data:image/png;base64,xyz');
    expect(result.latex).toBe('x = 5');
    expect(result.confidence).toBeCloseTo(0.9, 5);
    expect(Array.isArray(result.symbols)).toBe(true);
  });

  it('disposes the worker and can recognize again with a fresh worker', async () => {
    const bridge = new OcrBridge({ provider: 'tesseract' });
    const first = await bridge.recognize('img1');
    expect(first.latex).toBe('x = 5');
    await bridge.dispose();
    const fresh = await bridge.recognize('img2');
    expect(fresh.latex).toBe('x = 5');
  });
});

describe('MathBridge (katex path)', () => {
  it('renders LaTeX to an HTML string via KaTeX', async () => {
    const bridge = new MathBridge({});
    const html = await bridge.renderToHtml('x = 5');
    expect(html).toContain('katex');
  });

  it('renders LaTeX into a DOM element via KaTeX', async () => {
    const bridge = new MathBridge({});
    const el = document.createElement('div');
    await bridge.renderToDom('x = 5', el);
    expect(el.innerHTML).toContain('katex');
  });

  it('exposes dimensions using a hidden DOM node', async () => {
    const bridge = new MathBridge({});
    const dims = await bridge.getDimensions('x = 5');
    expect(typeof dims.width).toBe('number');
    expect(typeof dims.height).toBe('number');
  });

  it('throws a clear error if KaTeX cannot be loaded', async () => {
    vi.doMock('katex', () => { throw new Error('missing'); });
    const bridge = new MathBridge({});
    // loadKatex swallows the error and rethrows a friendly message
    await expect(bridge.renderToHtml('x')).rejects.toThrow(/KaTeX/);
  });
});
