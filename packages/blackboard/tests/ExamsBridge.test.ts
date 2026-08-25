import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExamsBridge, type StepSubmission } from '../src/integrations/ExamsBridge';

function makeStep(overrides: Partial<StepSubmission> = {}): StepSubmission {
  return {
    stepNumber: 1,
    elements: [],
    recognizedLatex: 'x = 5',
    expectedAnswer: 'x=5',
    timeSpentMs: 1000,
    ...overrides,
  };
}

describe('ExamsBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates locally when no apiBase is configured', async () => {
    const bridge = new ExamsBridge({});
    const result = await bridge.submitStep(makeStep());
    expect(result.correct).toBe(true);
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(1);
    expect(result.feedback).toBe('Correct!');
  });

  it('marks non-matching answers as incorrect', async () => {
    const bridge = new ExamsBridge({});
    const result = await bridge.submitStep(makeStep({ recognizedLatex: 'x = 4', expectedAnswer: 'x=5' }));
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedback).toContain('Expected');
  });

  it('returns "no answer" feedback when answer is missing', async () => {
    const bridge = new ExamsBridge({});
    const result = await bridge.submitStep(makeStep({ recognizedLatex: undefined, expectedAnswer: undefined }));
    expect(result.correct).toBe(false);
    expect(result.feedback).toBe('No answer to validate');
  });

  it('falls back to local validation when the API request fails', async () => {
    const bridge = new ExamsBridge({ apiBase: 'http://localhost:9999' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));
    const result = await bridge.submitStep(makeStep());
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.correct).toBe(true);
  });

  it('uses the API response when the server returns a result', async () => {
    const bridge = new ExamsBridge({ apiBase: 'http://localhost:9999' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ stepNumber: 1, correct: false, score: 0, maxScore: 1, feedback: 'nope' }), { status: 200 }),
    );
    const result = await bridge.submitStep(makeStep());
    expect(result.correct).toBe(false);
    expect(result.feedback).toBe('nope');
  });

  it('submits an exam with aggregated local results', async () => {
    const bridge = new ExamsBridge({});
    await bridge.submitStep(makeStep({ stepNumber: 1, recognizedLatex: 'x=5', expectedAnswer: 'x=5' }));
    await bridge.submitStep(makeStep({ stepNumber: 2, recognizedLatex: 'y=4', expectedAnswer: 'y=4' }));
    const exam = await bridge.submitExam();
    expect(exam.totalScore).toBe(2);
    expect(exam.maxScore).toBe(2);
    expect(exam.percentage).toBe(100);
    expect(exam.passed).toBe(true);
  });

  it('tracks queued steps via getSteps and clears with reset', async () => {
    const bridge = new ExamsBridge({});
    await bridge.submitStep(makeStep({ stepNumber: 1 }));
    expect(bridge.getSteps()).toHaveLength(1);
    bridge.reset();
    expect(bridge.getSteps()).toHaveLength(0);
  });

  it('sends auth token in headers', async () => {
    const bridge = new ExamsBridge({ apiBase: 'http://localhost:9999', authToken: 'tok123' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ stepNumber: 1, correct: true, score: 1, maxScore: 1, feedback: 'ok' }), { status: 200 }),
    );
    await bridge.submitStep(makeStep());
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok123');
  });
});
