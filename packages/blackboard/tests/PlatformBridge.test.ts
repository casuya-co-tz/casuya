import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformBridge } from '../src/integrations/PlatformBridge';
import type { Element } from '../src/types';

function fakeElement(): Element {
  return { id: 'e1', tool: 'pen', points: [{ x: 0, y: 0 }], color: '#000', width: 2, opacity: 1, createdAt: Date.now() };
}

describe('PlatformBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes only the configured bridges', () => {
    const bridge = new PlatformBridge({
      apiBase: 'http://localhost:9999',
      exams: {},
      math: {},
    });
    expect(bridge.getExamsBridge()).not.toBeNull();
    expect(bridge.getMathBridge()).not.toBeNull();
    expect(bridge.getOcrBridge()).toBeNull();
  });

  it('advances the step counter and returns a validation result', async () => {
    const bridge = new PlatformBridge({
      apiBase: 'http://localhost:9999',
      studentId: 's1',
      lessonId: 'l1',
      exams: {},
    });
    const mockBlackboard = {
      getElements: vi.fn().mockReturnValue([fakeElement()]),
      clear: vi.fn(),
    };
    (bridge as any).blackboard = mockBlackboard;
    (bridge as any).exams = { submitStep: vi.fn().mockResolvedValue({ stepNumber: 1, correct: true }) };

    const res = await bridge.nextStep();
    expect(res.step).toBe(2);
    expect(mockBlackboard.clear).toHaveBeenCalled();
    expect(res.result.correct).toBe(true);
  });

  it('saves progress to the API and tolerates offline failures', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const bridge = new PlatformBridge({ apiBase: 'http://localhost:9999', studentId: 's1', lessonId: 'l1' });
    const mockBlackboard = {
      exportJSON: vi.fn().mockReturnValue({ elements: [fakeElement()], width: 880, height: 560 }),
    };
    (bridge as any).blackboard = mockBlackboard;

    await expect(bridge.saveProgress()).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('loads progress when the API responds with elements', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ step: 3, elements: [fakeElement()] }), { status: 200 }),
    );
    const bridge = new PlatformBridge({ apiBase: 'http://localhost:9999', studentId: 's1', lessonId: 'l1' });
    const importJSON = vi.fn();
    (bridge as any).blackboard = { importJSON };
    const ok = await bridge.loadProgress();
    expect(ok).toBe(true);
    expect(bridge.getCurrentStep()).toBe(3);
    expect(importJSON).toHaveBeenCalled();
  });

  it('returns false from loadProgress when the API returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 404 }));
    const bridge = new PlatformBridge({ apiBase: 'http://localhost:9999', studentId: 's1', lessonId: 'l1' });
    (bridge as any).blackboard = { importJSON: vi.fn() };
    const ok = await bridge.loadProgress();
    expect(ok).toBe(false);
  });

  it('forwards auth token to child bridges', () => {
    const bridge = new PlatformBridge({ apiBase: 'http://localhost:9999', exams: {} });
    const setAuthSpy = vi.fn();
    (bridge as any).exams = { setAuthToken: setAuthSpy };
    bridge.setAuthToken('abc');
    expect(setAuthSpy).toHaveBeenCalledWith('abc');
  });
});
