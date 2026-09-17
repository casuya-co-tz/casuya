import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechClient } from '../src/speech/speech-client.js';

describe('SpeechClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('synthesizes TTS when authenticated', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['wav'], { type: 'audio/wav' }),
    });

    const client = new SpeechClient({
      apiBase: 'https://api.example',
      getToken: () => 'token-123',
    });

    const blob = await client.synthesize('Habari', 'sw', 1);
    expect(blob.type).toBe('audio/wav');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/v1/audio/tts',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects synthesis without token', async () => {
    const client = new SpeechClient({
      apiBase: 'https://api.example',
      getToken: () => null,
    });
    await expect(client.synthesize('Hi')).rejects.toThrow(/Authentication required/);
  });

  it('transcribes WAV upload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'habari' }),
    });

    const client = new SpeechClient({
      apiBase: 'https://api.example',
      getToken: () => 'token-123',
    });

    const text = await client.transcribe(new Blob(['wav'], { type: 'audio/wav' }));
    expect(text).toBe('habari');
  });

  it('sends language hint with STT upload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'habari' }),
    });

    const client = new SpeechClient({
      apiBase: 'https://api.example',
      getToken: () => 'token-123',
    });

    await client.transcribe(new Blob(['wav'], { type: 'audio/wav' }), 'sw');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    expect(body.get('language')).toBe('sw');
  });
});
