# Casuya — Audio Integrations: Piper TTS + Sherpa-ONNX STT (Railway-Hosted)

**Sera (Policy):** reading audio support for lessons, exercises, and quizzes —
run the engines on **Railway**, reached through the platform proxy. **No audio
engine is ever deployed to Vercel.**

**Mwandishi:** Mtaalamu wa Infra
**Tarehe:** 2026-09-13 (updated, Railway-only build — contradiction removed)
**Status:** Ready to scaffold — microservices mirror `apps/payments`

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
- **Piper TTS + Sherpa-ONNX STT are Railway-only microservices.** Never put an
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
| **Piper TTS model + engine** | `apps/audio-tts/` — `Dockerfile`, `requirements.txt`, `railway.json`, `app/main.py`, `app/config.py`, `app/security.py`, `app/routes_tts.py` | Exact mirror of `apps/payments` (the established FastAPI microservice template). **Engine + Kiswahili/English voice models are `git clone`d from GitHub at build time** (below). |
| **Sherpa-ONNX STT model + engine** | `apps/audio-stt/` — same layout (`app/routes_stt.py`, `app/routes_misc.py`) | Same template, separate Railway service → independent CPU scaling/healthchecks |
| **Audio proxy router** | `apps/platform/backend/api/audio.py` | Registered **BEFORE** `casuya_api_proxy` in `backend/app/routers.py` (the catch-all `/{path:path}` MUST stay last — enforced by the file comment). |
| **Audio client (platform backend → services)** | `apps/platform/backend/services/services_bridge_client/audio.py` | Same `railway.internal` forwarding pattern as the existing bridge client |
| **Frontend TTS/STT buttons** | `apps/platform/frontend/assets/js/modules/...` — **plain vanilla JS** | The platform UI is vanilla JS + Tailwind (verified: no React build pipeline). A `.tsx` button would have nothing to compile it there. |
| **Editor palette components (first real ones)** | `packages/editor/component-library/text/TextToSpeechButton.tsx` + `component-library/audio/SpeechToTextRecorder.tsx` | `.tsx` home is `editor/component-library` only. These are the first real components in the currently-empty `text/` + `audio/` dirs. |
| **Env vars** | `apps/audio-tts/.env.example`, `apps/audio-stt/.env.example`, `apps/platform/.env.example` | `CASUYA_AUDIO_TTS_URL`, `CASUYA_AUDIO_STT_URL`, `CASUYA_AUDIO_TTS_API_KEY`, `CASUYA_AUDIO_STT_API_KEY` — mirrors `CASUYA_PAYMENTS_*` naming |
| **Railway deploy config** | `apps/audio-tts/railway.json` + `apps/audio-stt/railway.json` | Same `DOCKERFILE` builder + `/health` + `healthcheckTimeout` pattern as `apps/payments/railway.json` |
| **Docs** | `docs/infra/audio-integrations.md` (this file) | Lives under `docs/` |

---

## 2. Engines are built FROM GITHUB (not checked in)

Both engines are open source on GitHub — build them at Docker-image build time,
mirroring how the image already bundles runtime models:

| Engine | GitHub repo (pin a tag/commit) | Build step |
|---|---|---|
| **Piper TTS** | `rhasspy/piper` (engine) + `rhasspy/piper-voices` (Kiswahili `sw` + English voices) | `git clone --depth 1 --branch <tag>` inside `Dockerfile`, then download the targeted voice models once at build; `ENTRYPOINT` runs `python -m piper.http_server --model ${PIPER_VOICE_MODEL}` |
| **Sherpa-ONNX STT** | `k2-fsa/sherpa-onnx` | `git clone --depth 1 --tag <release>` + download ONNX ASR models (Kiswahili/eng, short-utterance) at build |

> Rationale: keeps **all** deployed code reproducible from source, consistent
> with the `casuya_api_proxy`/payments approach (nothing proprietary or
> hand-downloaded at runtime). Lock a specific tag so `pnpm validate`/CI stays
> deterministic; upgrade by bumping the tag.

---

## 3. Microservice template (mirror `apps/payments`)

Each of `apps/audio-tts` and `apps/audio-stt` gets the same self-contained shape
(already proven by payments in production):

```
apps/audio-tts/
  app/
    main.py            # FastAPI app assembly, includes health + readyz
    config.py          # pydantic Settings (app_name, api_key, model urls, coords)
    security.py        # require_api_key + HMAC (same as payments/security.py)
    routes_tts.py      # POST /v1/audio/tts  -> { text, lang:"sw" } -> WAV bytes
    routes_misc.py     # GET /health, GET /readyz, GET /metrics
  Dockerfile           # python:3.12-slim + git clone pipeline + voices
  requirements.txt     # fastapi uvicorn gunicorn pydantic-settings httpx
  railway.json         # healthcheckPath "/health"
  .env.example
apps/audio-stt/  (same tree; routes_stt.py: POST /v1/audio/stt multipart -> {text})
```

### 3.1 Health endpoints (so Railway's healthcheck doesn't 404)

`/app/routes_misc.py` mirrors payments exactly — `/health` returns 200 with
`{"status": "ok", "service": "<app_name>", "environment": ...}`, and
`Dockerfile` runs **gunicorn with 1 worker** bound to `0.0.0.0:${PORT:-8000}`
(the same CMD payments uses). `railway.json` sets `healthcheckPath: "/health"`
+ `healthcheckTimeout: 120` — never a cloud-only assumption.

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
| `/api/v1/audio/tts` | POST | `{ "text":..., "lang":"sw" }` | WAV bytes (or cached `{audio_url}`) |
| `/api/v1/audio/stt` | POST | multipart audio (wav/ogg/webm) | `{ "text":... }` |

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

## 6. Offline strategy (2G/3G, hosted engines)

1. **TTS:** cached WAV (ETag/last-modified + immutable cache key) → repeated
   reads served from device cache; only first fetch hits Railway.
2. **STT:** recorder caches raw audio blob locally on failure; transcripts sync
   via `packages/bridge/recovery.js` when online (dead-letter inversion already
   fixed for payments). Offline → "audio saved, transcribe later".
3. **Queue:** pending TTS/STT requests travel the existing `pending_outbox`
   bridge — same outbox pattern as payments.

---

## 7. Suggested Implementation Order

1. `apps/audio-tts/` microservice (piper build from GitHub + railway.json).
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

- Confirm the exact **Kiswahili Piper voice model** + Sherpa-ONNX ASR model tag
  to pin in the two `Dockerfile`s.
- TTS: Railway service per engine (recommended) vs one shared audio service.
- STT: bounded short utterances only (recommended) vs full dictation in v1.
- Acknowledgements: no Vercel deployment for audio (decided, above).
