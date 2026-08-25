import { describe, it, expect, vi } from 'vitest';
import { OcrBridge } from '../src/integrations/OcrBridge';

describe('OcrBridge', () => {
  it('returns a mock result for the mock provider', async () => {
    const bridge = new OcrBridge({ provider: 'mock' });
    const result = await bridge.recognize('fake-image');
    expect(typeof result.latex).toBe('string');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.symbols).toEqual([]);
  });

  it('throws when mathpix credentials are missing', async () => {
    const bridge = new OcrBridge({ provider: 'mathpix' });
    await expect(bridge.recognize('data:image/png;base64,abc')).rejects.toThrow(/credentials/);
  });

  it('calls the mathpix API with credentials when configured', async () => {
    const bridge = new OcrBridge({ provider: 'mathpix', apiId: 'id1', apiKey: 'key1' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ latex: 'x=5', confidence: 0.9, symbols: [] }), { status: 200 }),
    );
    const result = await bridge.recognize('data:image/png;base64,abc');
    expect(result.latex).toBe('x=5');
    const url = fetchSpy.mock.calls[0][0];
    expect(String(url)).toContain('mathpix.com');
  });

  it('strips the data URL prefix when sending to mathpix', async () => {
    const bridge = new OcrBridge({ provider: 'mathpix', apiId: 'id1', apiKey: 'key1' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ latex: 'x=5' }), { status: 200 }),
    );
    await bridge.recognize('data:image/png;base64,BASE64DATA');
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.src).toBe('data:image/png;base64,BASE64DATA');
  });
});
