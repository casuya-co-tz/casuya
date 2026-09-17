import type { SpeechClient } from './speech-client.js';

export type SpeechLang = 'sw' | 'en' | 'auto';

export type SpeechUiState = 'idle' | 'loading' | 'speaking' | 'recording' | 'processing' | 'error';

export interface SpeechClientConfig {
  apiBase: string;
  getToken: () => string | null;
}

export interface SpeakOptions {
  lang?: SpeechLang;
  speed?: number;
  onLoading?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export interface TextToSpeechButtonOptions {
  text: string;
  lang?: SpeechLang;
  speed?: number;
  label?: string;
  client: SpeechClient;
  onStateChange?: (state: SpeechUiState) => void;
}

export interface SpeechToTextRecorderOptions {
  client: SpeechClient;
  lang?: SpeechLang;
  label?: string;
  append?: boolean;
  target?: HTMLInputElement | HTMLTextAreaElement;
  onTranscript?: (text: string) => void;
  onStateChange?: (state: SpeechUiState) => void;
}
