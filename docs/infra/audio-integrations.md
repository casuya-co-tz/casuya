# Casuya — Audio Integrations: Sherpa-ONNX TTS + Sherpa-ONNX STT (Railway-Hosted)

**Sera (Policy):** reading audio support for lessons, exercises, and quizzes —
run the engines on **Railway**, reached through the platform proxy. **No audio
engine is ever deployed to Vercel.**

**Mwandishi:** Mtaalamu wa Infra
**Tarehe:** 2026-09-13 (updated, Railway-only build — contradiction removed)
**Status:** Live — platform proxy + offline cache + Whisper-small STT + VITS TTS

---

## 0. The Contradiction We Just Fixed (IMPORTANT — read first)

Two deploy targets exist in the repo today, and each handles `/api` **differently**.
That previously bombed the plan:

| Target | Hosts | How `/api` is reached | Audio impact |
|---|---|---|---|
| **Vercel** | `apps/platform/frontend/` (static: vanilla JS + Tailwind) | `vercel.json` has **NO `/api` rewrite or headers** | Cannot serve/forward any audio endpoint |
| **Railway** | `apps/platform/backend` (`backend:8000`) + `apps/payments` | nginx `location /api/ { proxy_pass http://backend:8000/; }` — `/api` is **stripped** at the edge; backend `casuya_api_proxy` re-adds `prefix="/api"` | **This is the only place audio belongs** |
| **Render** | `infra/render.yaml` | legacy, abandoned | do not deploy here |

**Decision (removes the contradiction):**
- **Sherpa-ONNX TTS + Sherpa-ONNX STT are Railway-only microservices.** Never put an
  engine on Vercel — Vercel is a static host with no `/api` path handling and
  no Python runtime.
- **Why not "also Vercel":** the student web player already reaches the backend
  through `/api/*` (same-origin via nginx on Railway). Splitting audio onto a
  second host (Vercel) would force a second API origin → CORS + API-key + 2G
  latency duplication. One proxy, one origin, one key. Keep it on Railway.
- `infra/render.yaml` is the **old** deployment path — do not add audio there.

---

## 1. Where each piece belongs (final placement — verified against the repo)

| Component | Best place (path) | Why (verified) |
|---|---|---|
| **Sherpa-ONNX TTS model + engine** | `apps/audio-tts/` — `Dockerfile`, `requirements.txt`, `railway.json`, `app/main.py`, `app/config.py`, `app/security.py`, `app/routes_tts.py` | Exact mirror of `apps/payments` (the established FastAPI microservice template). Engine (`sherpa-onnx` PyPI wheel) + Kiswahili/English VITS voice packs are **baked in from official `k2-fsa/sherpa-onnx` `tts-models` release assets at Docker build time** (below). |
| **Sherpa-ONNX STT model + engine** | `apps/audio-stt/` — same layout (`app/routes_stt.py`, `app/services/transcribe.py`, `app/config.py`) | Same template, separate Railway service → independent CPU scaling/healthchecks. Engine (`sherpa-onnx` PyPI wheel) + **Whisper-small multilingual** (default; `WHISPER_MODEL=base` at build for smaller RAM) baked from the `asr-models` GitHub release. |
| **Audio proxy router** | `apps/platform/backend/api/audio.py` | Registered **BEFORE** `casuya_api_proxy` in `backend/app/routers.py` (the catch-all `/{path:path}` MUST stay last — enforced by the file comment). |
| **Audio client (platform backend → services)** | `apps/platform/backend/services/services_bridge_client/audio.py` | Same `railway.internal` forwarding pattern as the existing bridge client |
| **Frontend TTS/STT buttons** | `apps/platform/frontend/assets/js/modules/...` — **plain vanilla JS** | The platform UI is vanilla JS + Tailwind (verified: no React build pipeline). A `.tsx` button would have nothing to compile it there. |
| **Editor palette components (first real ones)** | `packages/editor/component-library/text/TextToSpeechButton.tsx` + `component-library/audio/SpeechToTextRecorder.tsx` | `.tsx` home is `editor/component-library` only. These are the first real components in the currently-empty `text/` + `audio/` dirs. |
| **Env vars** | `apps/audio-tts/.env.example`, `apps/audio-stt/.env.example`, `apps/platform/.env.example` | `CASUYA_AUDIO_TTS_URL`, `CASUYA_AUDIO_STT_URL`, `CASUYA_AUDIO_TTS_API_KEY`, `CASUYA_AUDIO_STT_API_KEY` — mirrors `CASUYA_PAYMENTS_*` naming |
| **Railway deploy config** | `apps/audio-tts/railway.json` + `apps/audio-stt/railway.json` | Same `DOCKERFILE` builder + `healthcheckPath: "/readyz"` + `healthcheckTimeout` pattern as `apps/audio-tts` |
| **Docs** | `docs/infra/audio-integrations.md` (this file) | Lives under `docs/` |

---

## 2. Engines are built FROM GITHUB (not checked in)

Both engines are open source on GitHub — build them at Docker-image build time,
mirroring how the image already bundles runtime models:

| Engine | Source | Build step |
|---|---|---|
| **Sherpa-ONNX TTS** (Kiswahili `sw` + English `en`) | engine `k2-fsa/sherpa-onnx` (PyPI `sherpa-onnx` wheel); voices `vits-piper-sw_CD-lanfrica-medium` (22050 Hz) + `vits-piper-en_US-amy-medium` (22050 Hz) from the `tts-models` GitHub release | `pip install sherpa-onnx` in the `Dockerfile`, then `curl` + `tar -xjf` the two voice `.tar.bz2` assets at build time (no phonemize/`espeak-ng` source build — that is exactly what breaks piper on Railway). |
| **Sherpa-ONNX STT** | `k2-fsa/sherpa-onnx`; model **Whisper-small multilingual** (`sherpa-onnx-whisper-small.tar.bz2`, override `WHISPER_MODEL=base` for smaller images) from the `asr-models` GitHub release; int8 encoder/decoder + tokens | `pip install sherpa-onnx` in the `Dockerfile`, then `curl` + `tar -xjf` at build time; `modified_beam_search` decoding; optional `language=sw\|en` form field locks Whisper to lesson language |

> Rationale: keeps **all** deployed code reproducible from source, consistent
> with the `casuya_api_proxy`/payments approach (nothing proprietary or
> hand-downloaded at runtime). Voice pack versions are pinned by the exact
> release URLs in each `Dockerfile`; upgrade by bumping the URL.

---

## 3. Microservice template (mirror `apps/payments`)

Each of `apps/audio-tts` and `apps/audio-stt` gets the same self-contained shape
(already proven by payments in production):

```
apps/audio-tts/
  app/
    main.py            # FastAPI app assembly: /health, /readyz + routes_tts
    config.py          # pydantic Settings (app_name, api_key, models dir)
    security.py        # require_api_key + HMAC (same as payments/security.py)
    routes_tts.py      # GET /health + POST /v1/audio/tts -> { text, lang:"sw" } -> WAV bytes
    services/synthesize.py  # Sherpa-ONNX OfflineTts engine (lazy load)
  Dockerfile           # python:3.12-slim + pip install sherpa-onnx + bake voices
  requirements.txt     # fastapi uvicorn gunicorn pydantic-settings numpy
  railway.json         # healthcheckPath "/readyz"
  .env.example
apps/audio-stt/  (same tree; routes_stt.py: POST /v1/audio/stt multipart -> {text})
```

### 3.1 Health endpoints (so Railway's healthcheck doesn't 404)

Each service exposes `/health` (open, returns 200) and `/readyz` (open, reports
`{"status": "ok", ...}` with `voice_loaded` on TTS / `model` on STT after the
engine/model loads); only the `/v1/audio/*` endpoints require the internal
`X-API-Key`. `Dockerfile` runs
**gunicorn with 1 worker** bound to `0.0.0.0:${PORT:-8000}`. Both `railway.json`
files set `healthcheckPath: "/readyz"` + `healthcheckTimeout: 120` — never a
cloud-only assumption.

### 3.2 API key + HMAC (same as payments)

`app/security.py` copies `apps/payments/app/security.py` (already verified):
`require_api_key` (X-API-Key from settings), plus optional HMAC on webhook-ish
routes. The platform audio client sends the key on every call. Unset =
endpoints return 401 (never open in production).

---

## 4. Platform integration (register BEFORE the catch-all)

Add a new router `apps/platform/backend/api/audio.py` and register it in
`apps/platform/backend/app/routers.py` **before** the `casuya_api_proxy` module
(which MUST stay the last catch-all in the include tuple — the file comment
enforces this). Pattern-match the existing `api/*.py` routers.

| Endpoint | Verb | Body → | Response |
|---|---|---|---|
| `/api/v1/audio/tts` | POST | `{ "text":..., "lang":"sw", "speed": 1.0 }` (≤1000 chars; client chunks longer text) | WAV bytes + `Cache-Control: immutable` |
| `/api/v1/audio/stt` | POST | multipart `audio` (16 kHz mono WAV) + optional `language=sw\|en` | `{ "text":... }` |

The router forwards to `apps/audio-tts` / `apps/audio-stt` over
`railway.internal` (private network, not public) — the SAME `railway.internal`
pattern the payments bridge client already uses — with the shared
`require_api_key`/HMAC middleware. No `get_current_user`/role collisions.

---

## 5. Frontend placement (vanilla JS, not React)

`apps/platform/frontend` is **vanilla JS + Tailwind** — there is no React, no
`.tsx` build, no bundler. So:

- `TextToSpeechButton` (plain JS) + `SpeechToTextRecorder` (plain JS:
  `getUserMedia`/MediaRecorder) live in `apps/platform/frontend/assets/js/
  modules/student/lesson/...` and `fetch` `/api/v1/audio/*`.
- The **editor** UI (separate, React) gets the first real component-library
  pieces: `packages/editor/component-library/text/TextToSpeechButton.tsx` +
  `component-library/audio/SpeechToTextRecorder.tsx`.

Platform pointer: same `fetch`-based `casuya_api_proxy` path as payments — no
new client code needed beyond the two buttons.

---

## 6. Offline strategy (2G/3G, hosted engines) — **implemented**

1. **TTS:** IndexedDB WAV cache (`speech-storage.js` / `packages/bridge/media/audio.js`)
   + in-memory Map; `casuyaPrefetchTts()` warms cache after lesson render.
   Client splits text >1000 chars into sentence chunks with 80 ms crossfade.
2. **STT:** 16 kHz mono WAV via MediaRecorder; failed uploads queued in IndexedDB
   STT outbox; `drainPendingStt()` on `online` event replays with language hint.
3. **Rate limits:** 20 TTS / 15 STT per minute per **authenticated user**
   (falls back to IP when unauthenticated).
4. **Grading guard:** exam voice buttons use `data-human-speech-only="true"` —
   blocks recording during/just-after TTS playback (synthetic TTS→STT is unreliable).

---

## 7. Suggested Implementation Order

1. `apps/audio-tts/` microservice (sherpa-onnx build: PyPI wheel + voice pack
   release assets baked in the `Dockerfile` + `railway.json`).
2. `apps/audio-stt/` microservice (sherpa-onnx build from GitHub).
3. `api/audio.py` platform router, registered **before** the catch-all proxy.
4. Plain-JS `TextToSpeechButton` + `SpeechToTextRecorder` in the student lesson
   module (wire `fetch` to `/api/v1/audio/*`).
5. `packages/editor/component-library/text/TextToSpeechButton.tsx` +
   `.../audio/SpeechToTextRecorder.tsx` (first real components).
6. `.env.example` additions (`CASUYA_AUDIO_TTS_URL` / `CASUYA_AUDIO_STT_URL` +
   keys) on all three apps.

---

## 8. Open Questions (before building)

- ~~Confirm the exact Kiswahili TTS voice to pin in the TTS `Dockerfile`.~~
  **Resolved:** `vits-piper-sw_CD-lanfrica-medium` (Kiswahili) +
  `vits-piper-en_US-amy-low` (English), both from the
  `k2-fsa/sherpa-onnx` `tts-models` release (verified assets).
- ~~STT: pin a Kiswahili+English ASR model that actually exists in
  `k2-fsa/sherpa-onnx` releases.~~ **Resolved:** Whisper-base multilingual
  (`sherpa-onnx-whisper-base.tar.bz2`, `asr-models` release — verified asset,
  int8 encoder/decoder for CPU) baked into the `apps/audio-stt` Dockerfile.
  `OfflineRecognizer.from_whisper(language="")` auto-detects `sw`/`en`.
- TTS: Railway service per engine (recommended) vs one shared audio service.
- STT: bounded short utterances only (recommended) vs full dictation in v1.
- **STT quirk (measured 2026-09-14, both services live):** feeding the **piper
  TTS output back into Whisper-base** garbles to a wrong detected language
  (e.g. Swahili synthetic speech comes back as Arabic text) — even after forcing
  16 kHz resampling. This is Whisper's known weakness on synthetic/robotic audio
  (language auto-detection latches onto it), **not** a deployment fault: real
  speech transcribes accurately at 16 kHz and 8 kHz (verified against the model
  pack's `test_wavs` ground truth). If the product ever auto-scores spoken
  answers **against TTS-generated prompts**, plan for this — student audio is
  fine.
- Acknowledgements: no Vercel deployment for audio (decided, above).
