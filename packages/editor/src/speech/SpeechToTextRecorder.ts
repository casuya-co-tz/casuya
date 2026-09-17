import type { SpeechToTextRecorderOptions, SpeechUiState } from './types.js';

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

async function blobTo16kWav(blob: Blob): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('AudioContext unavailable');
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = decoded.numberOfChannels > 1 ? mixToMono(decoded) : decoded.getChannelData(0);
    const offline = new OfflineAudioContext(1, Math.ceil(mono.length * 16000 / decoded.sampleRate), 16000);
    const buffer = offline.createBuffer(1, mono.length, decoded.sampleRate);
    buffer.copyToChannel(mono, 0);
    const src = offline.createBufferSource();
    src.buffer = buffer;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), 16000);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function mixToMono(decoded: AudioBuffer): Float32Array {
  const len = decoded.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] ?? 0;
  }
  for (let i = 0; i < len; i++) mono[i] /= decoded.numberOfChannels;
  return mono;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function createSpeechToTextRecorder(options: SpeechToTextRecorderOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'casuya-editor-stt';
  btn.setAttribute('aria-label', options.label ?? 'Speak');
  btn.textContent = options.label ?? '🎤 Voice';

  let recording: {
    stream: MediaStream;
    recorder: MediaRecorder;
    parts: Blob[];
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const setState = (state: SpeechUiState) => {
    btn.classList.toggle('recording', state === 'recording');
    btn.classList.toggle('processing', state === 'processing');
    btn.disabled = state === 'processing';
    options.onStateChange?.(state);
  };

  const applyText = (text: string) => {
    const target = options.target;
    if (target) {
      const next = options.append && target.value.trim() ? `${target.value.trim()} ${text}` : text;
      target.value = next;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    options.onTranscript?.(text);
  };

  btn.addEventListener('click', async () => {
    if (recording) {
      const active = recording;
      recording = null;
      clearTimeout(active.timer);
      active.recorder.onstop = async () => {
        active.stream.getTracks().forEach((t) => t.stop());
        setState('processing');
        try {
          const encoded = new Blob(active.parts, { type: active.recorder.mimeType || 'audio/webm' });
          const wav = await blobTo16kWav(encoded);
          const text = await options.client.transcribe(wav, options.lang ?? 'auto');
          applyText(text);
          setState('idle');
        } catch {
          setState('error');
        }
      };
      active.recorder.stop();
      return;
    }

    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const parts: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      recorder.start(250);
      const timer = setTimeout(() => btn.click(), 30000);
      recording = { stream, recorder, parts, timer };
      setState('recording');
    } catch {
      setState('error');
    }
  });

  return btn;
}
