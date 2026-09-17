import { describe, expect, it, vi } from 'vitest';
import { OcrBridge } from '../../src/integrations/OcrBridge';
import { HANDWRITING_FIXTURES } from './fixtures/handwriting-samples';

describe('handwriting OCR fixtures (B-04 benchmark harness)', () => {
  it('documents synthetic classroom samples under platform size limits', () => {
    for (const fixture of HANDWRITING_FIXTURES) {
      const bytes = Buffer.from(fixture.base64, 'base64').length;
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThan(512 * 1024);
    }
  });

  it('exercises the proxy provider against each fixture with mocked Mathpix', async () => {
    for (const fixture of HANDWRITING_FIXTURES) {
      const bridge = new OcrBridge({
        provider: 'proxy',
        apiBase: 'https://platform.test',
        authToken: 'token',
      });
      const latex = fixture.expectEmpty ? '' : 'x = 2';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ latex, confidence: latex ? 0.9 : 0, symbols: [] }), {
          status: latex ? 200 : 422,
        }),
      );

      if (fixture.expectEmpty) {
        await expect(bridge.recognize(fixture.base64)).rejects.toThrow(/422/);
      } else {
        const result = await bridge.recognize(fixture.base64);
        expect(result.latex).toBe('x = 2');
      }

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.image).toBe(fixture.base64);
      fetchSpy.mockRestore();
    }
  });
});
