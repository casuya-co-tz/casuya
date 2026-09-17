import type { SpeakOptions, SpeechClientConfig, SpeechLang } from './types.js';

const TTS_MAX_CHARS = 1000;

export class SpeechClient {
  private config: SpeechClientConfig;

  constructor(config: SpeechClientConfig) {
    this.config = config;
  }

  private token(): string {
    const value = this.config.getToken();
    if (!value) throw new Error('Authentication required for speech API');
    return value;
  }

  async synthesize(text: string, lang: SpeechLang = 'auto', speed = 1): Promise<Blob> {
    const trimmed = text.trim().slice(0, TTS_MAX_CHARS);
    if (!trimmed) throw new Error('No text to speak');
    const resp = await fetch(`${this.config.apiBase.replace(/\/$/, '')}/v1/audio/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token()}`,
      },
      body: JSON.stringify({
        text: trimmed,
        lang: lang === 'auto' ? 'sw' : lang,
        speed,
      }),
    });
    if (!resp.ok) throw new Error(`TTS failed (${resp.status})`);
    return resp.blob();
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<{ stop: () => void }> {
    const noop = { stop: () => undefined };
    options.onLoading?.();
    try {
      const blob = await this.synthesize(text, options.lang, options.speed ?? 1);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay = () => options.onStart?.();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        options.onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        options.onError?.(new Error('Audio playback failed'));
      };
      await audio.play();
      return {
        stop: () => {
          audio.pause();
          URL.revokeObjectURL(url);
        },
      };
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
      return noop;
    }
  }

  async transcribe(wav: Blob, lang: SpeechLang = 'auto'): Promise<string> {
    const fd = new FormData();
    fd.append('audio', wav, 'speech.wav');
    if (lang === 'sw' || lang === 'en') fd.append('language', lang);
    const resp = await fetch(`${this.config.apiBase.replace(/\/$/, '')}/v1/audio/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token()}` },
      body: fd,
    });
    if (!resp.ok) throw new Error(`STT failed (${resp.status})`);
    const data = (await resp.json()) as { text?: string };
    return data.text?.trim() ?? '';
  }
}
