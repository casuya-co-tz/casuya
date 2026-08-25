import { describe, it, expect, vi } from 'vitest';
import { MathBridge } from '../src/integrations/MathBridge';

describe('MathBridge', () => {
  it('checks equivalence locally with string normalization fallback', async () => {
    const bridge = new MathBridge({});
    const result = await bridge.checkEquivalence('2x + 3', '2x+3');
    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  }, 15000);


  it('detects non-equivalent expressions via normalization', async () => {
    const bridge = new MathBridge({});
    const result = await bridge.checkEquivalence('2x + 3', '2x + 5');
    expect(result.equivalent).toBe(false);
  });

  it('prefers the API for equivalence when reachable', async () => {
    const bridge = new MathBridge({ apiBase: 'http://localhost:9999' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ equivalent: true, confidence: 0.95 }), { status: 200 }),
    );
    const result = await bridge.checkEquivalence('x', 'x');
    expect(result.equivalent).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it('falls back locally when the math API fails', async () => {
    const bridge = new MathBridge({ apiBase: 'http://localhost:9999' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('down'));
    const result = await bridge.checkEquivalence('2x+3', '2x+3');
    expect(result.equivalent).toBe(true);
  });

  it('solves equations locally with a string fallback when mathjs is unavailable', async () => {
    const bridge = new MathBridge({});
    const result = await bridge.solveEquation('x + 1 = 2');
    expect(result).toHaveProperty('steps');
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result).toHaveProperty('solution');
  });

  it('uses the API for solving when reachable', async () => {
    const bridge = new MathBridge({ apiBase: 'http://localhost:9999' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ steps: ['x+1=2', 'x=1'], solution: 'x=1', latex: 'x=1' }), { status: 200 }),
    );
    const result = await bridge.solveEquation('x + 1 = 2');
    expect(result.solution).toBe('x=1');
  });

  it('converts LaTeX to readable text', () => {
    const bridge = new MathBridge({});
    expect(bridge.latexToText('\\frac{1}{2}')).toBe('(1)/(2)');
    expect(bridge.latexToText('\\sqrt{4}')).toBe('sqrt(4)');
    expect(bridge.latexToText('3 \\cdot 2')).toBe('3 · 2');
    expect(bridge.latexToText('x^{2} + y^{2}')).toBe('x^(2) + y^(2)');
  });
});
