import type { SpeechUiState, TextToSpeechButtonOptions } from './types.js';

export function createTextToSpeechButton(options: TextToSpeechButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'casuya-editor-tts';
  btn.setAttribute('aria-label', options.label ?? 'Listen');
  btn.textContent = options.label ?? '🔊 Listen';

  let controller: { stop: () => void } | null = null;

  const setState = (state: SpeechUiState) => {
    btn.classList.toggle('loading', state === 'loading');
    btn.classList.toggle('speaking', state === 'speaking');
    btn.disabled = state === 'loading';
    options.onStateChange?.(state);
  };

  btn.addEventListener('click', () => {
    controller?.stop();
    controller = null;
    setState('loading');
    options.client
      .speak(options.text, {
        lang: options.lang,
        speed: options.speed,
        onStart: () => setState('speaking'),
        onEnd: () => setState('idle'),
        onError: () => setState('error'),
      })
      .then((ctrl) => {
        controller = ctrl;
      })
      .catch(() => setState('error'));
  });

  return btn;
}
