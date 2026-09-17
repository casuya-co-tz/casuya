# Casuya — STT/TTS Improvement Plan

**Author:** Engineering review (2026-09-17)  
**Status:** Implemented (Phases 0–4 core) — see manual QA in [`audio-manual-qa.md`](./audio-manual-qa.md)  
**Related:** [`audio-integrations.md`](./audio-integrations.md) (architecture baseline)

This document is the full implementation plan to take the existing Sherpa-ONNX
TTS/STT stack from **v1 foundation** to **production-ready for Tanzanian
secondary schools on low-end Android and 2G/3G networks**.

---

## 0. Executive summary

### Current state (what works)

| Area | Status |
|---|---|
| Engine choice (Sherpa-ONNX VITS + Whisper-base) | ✅ Good for `sw` + `en` |
| Railway microservices + platform proxy + API keys | ✅ Solid |
| Site-wide `.casuya-listen` / `.casuya-record` wiring | ✅ Lessons, quizzes, exams, a11y |
| TTS in-memory cache + browser fallback | ✅ Basic |
| Health/readyz + lazy model load | ✅ Deploy-safe |

### Gaps blocking “production-perfect” delivery

| ID | Issue | Severity |
|---|---|---|
| B-01 | Text length mismatch: frontend 3200 / platform 3400 / service **1000** | 🔴 Bug |
| B-02 | A11y speech-rate slider ignored for Sherpa TTS (API path) | 🔴 Bug |
| B-03 | No TTS chunking — “Listen to lesson” fails or truncates | 🔴 Bug |
| G-01 | Offline TTS cache (IndexedDB) documented but not built | 🟡 Gap |
| G-02 | STT offline queue (“transcribe later”) not built | 🟡 Gap |
| G-03 | STT requires login — no public fallback | 🟡 Gap |
| G-04 | Deprecated `ScriptProcessorNode` for mic capture | 🟡 Gap |
| G-05 | No STT upload size/duration limits on backend | 🟡 Gap |
| G-06 | Weak Swahili language detection (strips non-ASCII) | 🟡 Gap |
| G-07 | Editor `TextToSpeechButton` / `SpeechToTextRecorder` missing | 🟡 Gap |
| G-08 | No per-endpoint rate limits for CPU-heavy audio routes | 🟡 Gap |
| G-09 | TTS→STT loop garbles synthetic speech (documented quirk) | ⚠️ Known |

### Target outcome

After all phases:

- Students can **listen to full lessons** on 2G without repeated network hits.
- Voice typing **survives offline** and syncs when connectivity returns.
- Speech speed, language, and length behave **consistently** across UI and API.
- Audio services are **protected from abuse** and **bounded** in payload size.

---

## 1. Scope and non-goals

### In scope

- `apps/platform/frontend/assets/js/modules/speech.js`
- `apps/platform/frontend/assets/js/a11y.js`
- `apps/platform/backend/api/audio/tts.py`, `stt.py`
- `apps/platform/backend/middleware/rate_limit.py`
- `apps/audio-tts/` (schemas, routes, synthesize)
- `apps/audio-stt/` (routes, transcribe)
- `packages/bridge/` (IndexedDB cache + outbox for audio)
- `packages/editor/component-library/` (new React components)
- Tests and docs updates

### Out of scope (v1 of this plan)

- Replacing Sherpa-ONNX with cloud APIs (Google, Azure, etc.)
- On-device STT/TTS on the phone (WebAssembly Sherpa) — future option
- Real-time streaming TTS/STT (WebSocket)
- Swahili-only fine-tuned Whisper model (evaluate in Phase 4 only if accuracy insufficient)
- Vercel deployment of any audio engine

---

## 2. Architecture (unchanged core)

```
Browser (speech.js, a11y.js)
    │  Bearer JWT
    ▼
Platform backend  /v1/audio/tts  |  /v1/audio/stt
    │  X-API-Key (internal)
    ▼
Railway: audio-tts (Sherpa VITS)  |  audio-stt (Sherpa Whisper-base)
```

**New layers added by this plan:**

```
speech.js
    ├── IndexedDB WAV cache (packages/bridge)
    ├── TTS chunk queue (sentence split → sequential play)
    └── STT offline outbox (failed uploads → bridge recovery)

platform proxy
    ├── Aligned validation (length, speed, audio size)
    └── Stricter rate limits per audio endpoint
```

---

## 3. Implementation phases

### Phase 0 — Bug fixes (P0)  
**Goal:** Fix failures users hit today.  
**Estimate:** 1–2 days  
**Dependencies:** None

#### 0.1 Align TTS text length limits (B-01)

**Problem:** Frontend sends up to 3200 chars; microservice rejects above 1000.

**Decision:** Standardize on **1000 chars per synthesis request** with **client-side chunking** for longer content (see 0.3). Platform proxy max becomes 1000 + small JSON overhead.

| File | Change |
|---|---|
| `apps/audio-tts/app/schemas.py` | Keep `max_length=1000` (canonical) |
| `apps/platform/backend/api/audio/tts.py` | Change `max_length` from 3400 → **1000** |
| `apps/platform/frontend/assets/js/modules/speech.js` | Change `capText(txt, 3200)` → **`capText(txt, 1000)`** per chunk |

**Acceptance criteria:**

- [ ] POST with 1001 chars to platform returns 422 before hitting microservice
- [ ] POST with ≤1000 chars succeeds end-to-end
- [ ] Existing smoke tests updated

#### 0.2 Wire speech speed through TTS API (B-02)

**Problem:** `a11y.js` passes `rate` to `casuyaSpeakText`, but API path ignores it.

| File | Change |
|---|---|
| `apps/audio-tts/app/schemas.py` | Add `speed: float = Field(default=1.0, ge=0.5, le=2.0)` |
| `apps/audio-tts/app/routes_tts.py` | Pass `payload.speed` to `text_to_wav` |
| `apps/audio-tts/app/services/synthesize.py` | Accept `speed` param; pass to `engine.generate(..., speed=speed)` |
| `apps/platform/backend/api/audio/tts.py` | Forward optional `speed` in JSON body |
| `apps/platform/frontend/assets/js/modules/speech.js` | Include `speed: options.rate \|\| 1` in fetch body |

**Acceptance criteria:**

- [ ] Speed 0.7 produces measurably longer WAV than speed 1.3 (duration check in test)
- [ ] A11y slider changes playback speed for logged-in users
- [ ] Invalid speed (<0.5 or >2.0) returns 422

#### 0.3 TTS chunking for long content (B-03)

**Problem:** “Listen to lesson” sends title + body; exceeds 1000 chars.

| File | Change |
|---|---|
| `apps/platform/frontend/assets/js/modules/speech.js` | Add `splitIntoChunks(text, maxLen)` — split on `.`, `!`, `?`, `\n`; merge short segments; cap each chunk ≤1000 |
| Same | Add `speakChunks(chunks, options)` — fetch/play sequentially; `casuyaStopAll()` cancels queue |
| Same | `casuyaSpeakText` uses chunking when `txt.length > 1000` |
| `apps/platform/frontend/assets/js/a11y.js` | `speak(getSelectedText())` benefits automatically |

**Acceptance criteria:**

- [ ] 3000-char lesson plays as 3+ sequential WAV segments without error
- [ ] Stop button halts mid-lesson and clears queue
- [ ] Each chunk cached independently in `_ttsCache`

---

### Phase 1 — Offline and 2G resilience (P1)  
**Goal:** Match documented offline strategy in `audio-integrations.md` §6.  
**Estimate:** 3–5 days  
**Dependencies:** Phase 0

#### 1.1 Persistent TTS cache via bridge (G-01)

**Problem:** In-memory `Map` (24 entries) lost on refresh; every revisit hits network.

| File | Change |
|---|---|
| `packages/bridge/src/media/audio.js` | **New** — `getCachedWav(key)`, `putCachedWav(key, blob)`, `evictOlderThan(ms)` using IndexedDB |
| `packages/bridge/src/index.js` | Export audio cache helpers |
| `apps/platform/frontend/assets/js/modules/speech.js` | On TTS fetch: check IndexedDB before network; on success: write to IDB + memory Map |
| Cache key | `sha256(lang + "|" + text + "|" + speed)` or simple `lang\|text\|speed` if hash unavailable |

**Acceptance criteria:**

- [ ] Second listen to same text served from IndexedDB (no network in DevTools)
- [ ] Cache survives page reload
- [ ] Eviction after 7 days or 50 MB cap (configurable)

#### 1.2 STT offline outbox (G-02)

**Problem:** Failed transcription loses recorded audio.

| File | Change |
|---|---|
| `packages/bridge/src/sync/outbox.js` (or existing recovery) | Add `audio_stt` outbox type: `{ wavBlob, targetSelector, createdAt }` |
| `apps/platform/frontend/assets/js/modules/speech.js` | On STT fetch failure: save to outbox; toast “Saved — will transcribe when online” |
| `packages/bridge/src/recovery.js` | On `online` event: drain STT outbox, POST to `/v1/audio/stt`, fill target input |

**Acceptance criteria:**

- [ ] Airplane mode → record → stop → audio queued locally
- [ ] Reconnect → automatic transcription + input filled
- [ ] Duplicate drain prevented (idempotent outbox IDs)

#### 1.3 Prefetch TTS for lesson content

| File | Change |
|---|---|
| `apps/platform/frontend/assets/js/modules/student/lessons/viewer.js` | After lesson render: background-prefetch TTS for title + each question prompt (low priority) |
| `speech.js` | Add `casuyaPrefetchTts(text, lang)` — fire-and-forget cache populate |

**Acceptance criteria:**

- [ ] First “Listen” click on prefetched text plays immediately
- [ ] Prefetch does not block UI or exceed 3 concurrent requests

#### 1.4 Client-side audio resampling for STT

**Problem:** Browser records at 44.1/48 kHz; larger uploads on 2G.

| File | Change |
|---|---|
| `apps/platform/frontend/assets/js/modules/speech.js` | After capture: resample to **16 kHz mono** via `OfflineAudioContext` before WAV encode |
| Alternative | Switch to `MediaRecorder` + server accepts webm (Phase 2) |

**Acceptance criteria:**

- [ ] Uploaded WAV is 16 kHz mono regardless of device sample rate
- [ ] Transcription accuracy unchanged vs current (manual test with Swahili phrase)

---

### Phase 2 — Quality and reliability (P2)  
**Goal:** Harden STT capture, limits, and abuse protection.  
**Estimate:** 2–3 days  
**Dependencies:** Phase 1 optional (can parallelize 2.3–2.4)

#### 2.1 Replace ScriptProcessorNode (G-04)

| File | Change |
|---|---|
| `apps/platform/frontend/assets/js/modules/speech.js` | Replace `createScriptProcessor` with **`MediaRecorder`** (`audio/webm;codecs=opus`) OR `AudioWorklet` + manual buffer |
| `apps/audio-stt/app/services/transcribe.py` | If WebM: add decode path (ffmpeg in Docker or `pydub`) before Whisper |
| `apps/platform/backend/api/audio/stt.py` | Accept `audio/webm` in addition to `audio/wav` |

**Recommendation:** Prefer **MediaRecorder → WebM** + server decode — simpler, less CPU on phone.

**Acceptance criteria:**

- [ ] Recording works on Chrome Android 10+
- [ ] No deprecation warnings in desktop DevTools
- [ ] Max recording still 60 s (configurable → 30 s recommended)

#### 2.2 STT upload bounds (G-05)

| File | Change |
|---|---|
| `apps/platform/backend/api/audio/stt.py` | Reject if `len(wav) > 1_048_576` (1 MB) or duration > 30 s (parse WAV header) |
| `apps/audio-stt/app/routes_stt.py` | Mirror limits; return 413/400 with clear message |
| `speech.js` | Reduce `_rec.timer` from 60000 → **30000** ms |

**Acceptance criteria:**

- [ ] 2 MB upload returns 413 from platform
- [ ] 45 s recording auto-stops at 30 s

#### 2.3 Audio endpoint rate limits (G-08)

| File | Change |
|---|---|
| `apps/platform/backend/middleware/rate_limit.py` | Add to `ENDPOINT_LIMITS`: `/v1/audio/tts`: **20**, `/v1/audio/stt`: **15** (per IP per minute) |
| Consider | Per-user limit using JWT `sub` when authenticated |

**Acceptance criteria:**

- [ ] 21st TTS request in 60 s returns 429
- [ ] Normal lesson use stays under limit

#### 2.4 Improve language detection (G-06)

| File | Change |
|---|---|
| `apps/platform/frontend/assets/js/modules/speech.js` | Fix `detectLang`: do not strip non-ASCII; use Unicode letter classes |
| Same | Priority: explicit `data-lang` → user pref (`casuya_a11y.lang`) → heuristic → `"sw"` default for TZ |
| Lesson/quiz UI | Set `data-lang="sw"` on Kiswahili content where known |

**Acceptance criteria:**

- [ ] Swahili text with apostrophes detected as `sw`
- [ ] Explicit `data-lang="en"` overrides heuristic

#### 2.5 STT append mode

| File | Change |
|---|---|
| `speech.js` | Add `data-append="true"` on `.casuya-record`; when set, append transcribed text with leading space instead of replace |

**Acceptance criteria:**

- [ ] Notes field: existing text + new speech = concatenated

---

### Phase 3 — UX polish and editor (P3)  
**Goal:** Complete product surface and accessibility.  
**Estimate:** 3–4 days  
**Dependencies:** Phase 0–2

#### 3.1 Loading and error UX

| File | Change |
|---|---|
| `speech.js` | TTS: add `.casuya-listen.loading` class during fetch; STT: already has `processing` state |
| `a11y.js` | Show “Loading audio…” in `#speech-status` before first chunk plays |

#### 3.2 Swahili browser TTS fallback

| File | Change |
|---|---|
| `speech.js` | In `findVoice()`: prefer `sw-TZ`, `sw-KE` before English when `detectLang` returns `sw` |
| `a11y.js` | Share voice picker with `speech.js` (dedupe `findVoice`) |

#### 3.3 Editor component library (G-07)

| File | Change |
|---|---|
| `packages/editor/component-library/text/TextToSpeechButton.tsx` | **New** — props: `text`, `lang`, `speed`; calls shared hook |
| `packages/editor/component-library/audio/SpeechToTextRecorder.tsx` | **New** — props: `onTranscript`, `targetRef` |
| `packages/editor/component-library/audio/useSpeech.ts` | **New** — thin wrapper; platform uses vanilla JS, editor uses React hook with same API contract |

**Acceptance criteria:**

- [ ] Editor lesson builder can drop TTS/STT blocks onto canvas
- [ ] Components typecheck and export from `@casuya/editor`

#### 3.4 Optional: guest STT with browser API

| File | Change |
|---|---|
| `speech.js` | When not authed: try `webkitSpeechRecognition` / `SpeechRecognition` if available; toast if unsupported |

**Note:** Browser STT quality varies; document as best-effort for demos only.

---

### Phase 4 — Advanced (future, evaluate after Phases 0–3)  

#### 4.1 TTS→STT auto-grading guard (G-09)

If product needs “repeat after listening” scoring:

- Do **not** compare STT output of TTS-generated prompts directly.
- Use **human speech only** for grading, or force STT `language="sw"` / `language="en"` on server.
- Add integration test documenting expected failure mode for synthetic audio.

#### 4.2 Model upgrades

| Option | Trade-off |
|---|---|
| Whisper-small int8 | Better accuracy, ~2× CPU/RAM |
| Swahili-tuned ASR (if available in sherpa-onnx releases) | Better `sw` WER |
| Higher quality `sw` VITS voice | Larger Docker image |

Run WER benchmark on 20 Swahili + 20 English classroom phrases before switching.

#### 4.3 Horizontal scaling

| Change | Where |
|---|---|
| Railway replicas > 1 | `audio-tts`, `audio-stt` |
| gunicorn workers | Keep **1 worker** per replica (ONNX models are memory-heavy) |
| Request queue / Celery | Only if p95 latency > 5 s under load |

#### 4.4 On-device WASM (long-term)

Sherpa-ONNX JavaScript/WASM build for offline TTS on device — large bundle (~10–30 MB); only if IndexedDB cache insufficient.

---

## 4. File change matrix (quick reference)

| File | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| `speech.js` | ✅ chunk, speed, cap | ✅ IDB, outbox, resample, prefetch | ✅ MediaRecorder, append, lang | ✅ loading, sw voice |
| `a11y.js` | — | — | — | ✅ status, shared findVoice |
| `backend/api/audio/tts.py` | ✅ max 1000, speed | — | — | — |
| `backend/api/audio/stt.py` | — | — | ✅ size limit | — |
| `backend/middleware/rate_limit.py` | — | — | ✅ audio limits | — |
| `audio-tts/schemas.py` | ✅ speed | — | — | — |
| `audio-tts/synthesize.py` | ✅ speed param | — | — | — |
| `audio-stt/routes_stt.py` | — | — | ✅ size limit | — |
| `audio-stt/transcribe.py` | — | — | ✅ webm decode | — |
| `packages/bridge/media/audio.js` | — | ✅ new | — | — |
| `packages/bridge/recovery.js` | — | ✅ STT drain | — | — |
| `packages/editor/.../TextToSpeechButton.tsx` | — | — | — | ✅ new |
| `packages/editor/.../SpeechToTextRecorder.tsx` | — | — | — | ✅ new |

---

## 5. Testing plan

### Unit / smoke (each phase)

| Suite | Command | Covers |
|---|---|---|
| audio-tts | `pytest apps/audio-tts/tests/` | speed param, length validation, API key |
| audio-stt | `pytest apps/audio-stt/tests/` | size rejection, webm path |
| platform | `pytest apps/platform/tests/` | proxy forwarding, rate limits |
| bridge | `pnpm --filter casuya-bridge test` | IDB cache, outbox drain |
| blackboard/runtime | existing | no regressions |

### Manual QA checklist ( Tanzania context )

- [ ] Kiswahili quiz question: Listen → correct voice
- [ ] English quiz question: Listen → English voice
- [ ] Full lesson (2000+ chars): plays completely with chunking
- [ ] Speech rate 0.7x and 1.5x audibly different (API mode)
- [ ] Voice type answer in quiz → text appears in input
- [ ] Airplane mode: TTS from cache plays; STT queues and syncs on reconnect
- [ ] Low-end Android Chrome: mic permission, record, transcribe
- [ ] 2G throttling (DevTools): prefetch makes second listen instant

### Docker integration test (Phase 4)

- CI job building `audio-tts` + `audio-stt` images and hitting `/readyz` + one real synthesis/transcription — currently only stubbed in pytest.

---

## 6. Rollout order (suggested sprints)

| Sprint | Deliverables | User-visible win |
|---|---|---|
| **Sprint 1** | Phase 0 (all) | Lessons and long text work; speed slider works |
| **Sprint 2** | Phase 1.1 + 1.3 | Faster repeat listens; instant lesson buttons |
| **Sprint 3** | Phase 1.2 + 1.4 + Phase 2.2–2.4 | Offline STT; smaller uploads; safer backend |
| **Sprint 4** | Phase 2.1 + 2.5 + Phase 3 | Modern mic API; editor components; polish |
| **Backlog** | Phase 4 | Model upgrades, scaling, WASM |

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Chunked TTS feels disjointed | Short crossfade between chunks; split on sentence boundaries only |
| IndexedDB quota exceeded on low storage phones | Cap cache at 50 MB; LRU eviction |
| WebM decode adds Docker size (ffmpeg) | Prefer WAV resample on client (Phase 1.4) first; WebM in Phase 2 if needed |
| Stricter rate limits block classrooms | Rate limit by user ID; raise limits for `teacher` role if needed |
| Whisper-base poor on classroom Swahili | Phase 4 benchmark before model swap |

---

## 8. Success metrics

| Metric | Baseline (est.) | Target after Phase 3 |
|---|---|---|
| TTS failure rate on lessons >1000 chars | High (422 errors) | **0%** |
| Repeat TTS network requests | 100% | **<10%** (IDB cache hit) |
| STT data loss on offline | 100% | **0%** (outbox) |
| TTS p95 latency (cached) | N/A | **<200 ms** (local play) |
| TTS p95 latency (uncached, 2G) | Unknown | **<8 s** per chunk |
| STT upload size (avg) | ~500 KB–2 MB | **<200 KB** (16 kHz) |

---

## 9. Documentation updates (after each phase)

| Doc | Update |
|---|---|
| `docs/infra/audio-integrations.md` | Mark §6 offline items implemented; add chunking + speed API |
| `apps/platform/.env.example` | Any new vars |
| `AGENTS.md` | Optional one-line pointer to this plan |
| `packages/bridge/docs/caching.md` | Document audio WAV cache |

---

## 10. Sign-off checklist

Before closing the epic:

- [x] All Phase 0 acceptance criteria green
- [x] `pnpm validate` + `pnpm test` pass
- [ ] Manual QA checklist completed on Android device — [`audio-manual-qa.md`](./audio-manual-qa.md)
- [ ] Rate limits verified in staging
- [x] `audio-integrations.md` updated
- [x] No open 🔴 bugs from §0 table

---

*End of plan.*
