# Casuya Audio — Manual QA Checklist (Tanzania)

Run on a **low-end Android phone** (Chrome) and once on desktop with DevTools **2G throttling**.

## TTS (Listen)

- [ ] Kiswahili quiz question → Listen → Kiswahili voice (`sw`)
- [ ] English quiz question → Listen → English voice (`en`)
- [ ] Full lesson (2000+ chars) → plays completely (chunk crossfade, no 422)
- [ ] Speech rate **0.7×** and **1.5×** audibly different (logged-in, a11y slider)
- [ ] Second Listen on same text → instant or near-instant (IndexedDB cache)

## STT (Voice typing)

- [ ] Voice type in quiz/exam → text appears in input
- [ ] Exam voice button waits ~2.5 s after Listen before recording (`data-human-speech-only`)
- [ ] Swahili lesson → STT returns Swahili-ish text (language hint sent)
- [ ] **Airplane mode** → record → clip queued → reconnect → auto-transcribed

## Offline / 2G

- [ ] Airplane mode: cached TTS still plays
- [ ] 2G throttle: prefetch makes second Listen much faster
- [ ] STT upload ≤ ~200 KB for 10 s clip (16 kHz mono WAV)

## Deploy verification (Railway)

After rebuilding `audio-tts` + `audio-stt` images:

```bash
curl -sf https://<audio-tts-host>/readyz
curl -sf https://<audio-stt-host>/readyz
```

Production defaults: **Whisper-small** STT, **amy-medium** English TTS, **sw_CD-lanfrica-medium** Kiswahili TTS.
