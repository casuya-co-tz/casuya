# Math OCR — Self-Hosted Implementation Plan

**Status:** Implemented — `apps/ocr-math` shipped (Pix2Text, CPU torch), platform
`self-hosted` provider wired, tests green  
**Related:** [OCR Provider Evaluation](./ocr-provider-evaluation.md) (B-04 buy decision)  
**Decision date:** 2026-09-18

## 1. Goal

Replace the Mathpix cloud API dependency with a self-hosted, open-source Math OCR
microservice that converts handwritten/printed math images into LaTeX — without
blowing up the client bundle, without adding a 1.5 GB PyTorch stack to the main
platform service, and without losing the existing "Recognize" blackboard workflow.

## 2. Decision Summary

| Choice | Decision | Why |
|---|---|---|
| **Model** | [Pix2Text](https://github.com/breezedeus/Pix2Text) (MIT) | ~200 MB image (not 1.5 GB), outputs LaTeX directly, CPU-only |
| **Architecture** | New microservice `apps/ocr-math/` | Mirrors `apps/audio-stt/` / `apps/audio-tts/` exactly |
| **Client-side changes** | **None** | `OcrBridge` `proxy` provider already calls `POST /v1/ocr/handwriting` |
| **Backend changes** | Minimal | Swap `recognize_mathpix()` for a call to the internal service |
| **Fallback** | Keep Mathpix path | Dual-provider: `self-hosted` primary, `mathpix` fallback |

### Alternatives considered

| Option | Verdict | Reason |
|---|---|---|
| Client-side WASM (LaTeX-OCR, etc.) | **Rejected** | 2G/3G + low-end Android; MB-scale model on device unacceptable |
| LaTeX-OCR (lukas-blecher) | **Rejected** | ~1.5 GB PyTorch stack; needs bigger container than Railway budget |
| Mathpix (keep only) | **Fallback only** | Paid API, external dependency, per-request cost |
| Tesseract.js (client) | **Offline plain text only** | No LaTeX output; already wired as offline fallback |
| Nougat (Meta) | **Rejected** | Full-document, CC-BY-NC license, heavy |

## 3. Architecture

```
Student blackboard (Recognize button)
        |
        v
blackboard-embed.js ── POST /v1/ocr/handwriting (Bearer JWT)
        |
        v
apps/platform (FastAPI) ── httpx ── apps/ocr-math (Pix2Text, X-API-Key)
        |                           |
        |   (self-hosted provider)  v
        +--[fallback]───────── Mathpix API (optional)
```

- The platform keeps the `proxy` role: auth, rate limits, and internal-key
  handling stay server-side, exactly like audio-tts/audio-stt.
- The new service is a separate Railway container (own Dockerfile, own
  `railway.json`, ~200 MB image) so the main platform is unaffected.

## 4. New Microservice — `apps/ocr-math/`

Replicates the proven `apps/audio-stt/` pattern.

```
apps/ocr-math/
  .env.example              # CASUYA_OCR_API_KEY=
  Dockerfile                # python:3.12-slim, pip install pix2text, COPY app/
  railway.json              # DOCKERFILE builder, /readyz healthcheck
  requirements.txt          # fastapi, uvicorn, gunicorn, pydantic, pix2text, Pillow, numpy
  app/
    __init__.py             # create_app(), app = create_app(), /readyz
    config.py               # pydantic_settings BaseSettings + lru_cache get_settings()
    security.py             # require_api_key() HMAC X-API-Key header check
    schemas.py              # OcrRequest(image: str), OcrResponse(latex, confidence, symbols)
    routes_ocr.py           # GET /health, POST /v1/ocr/recognize
    middleware/
      rate_limit.py         # in-memory sliding window (30/min)
    services/
      recognize.py          # Pix2Text wrapper, lazy-loaded, model_ready()
  tests/
    conftest.py             # sys.path insert, clear API key
    test_app.py             # TestClient smoke tests, stubbed engine
```

### Key file — `app/services/recognize.py`

```python
"""Pix2Text math OCR engine (lazy-loaded, CPU-only)."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from PIL import Image

_engine: Any = None


def _load_engine() -> Any:
    global _engine
    if _engine is None:
        from pix2text import Pix2Text
        _engine = Pix2Text()
    return _engine


def recognize_math(image_bytes: bytes) -> dict:
    img = Image.open(BytesIO(image_bytes))
    engine = _load_engine()
    texts = engine.recognize(img)
    latex_parts = []
    symbols = []
    for item in texts:
        if item.get("type") == "equation":
            latex_parts.append(item.get("text", ""))
            symbols.append({
                "latex": item.get("text", ""),
                "bbox": item.get("bbox", {"x": 0, "y": 0, "w": 0, "h": 0}),
            })
    full_latex = " ".join(t for t in latex_parts if t)
    avg_confidence = sum(item.get("prob", 0) for item in texts) / max(len(texts), 1)
    return {
        "latex": full_latex,
        "confidence": round(float(avg_confidence), 4),
        "symbols": symbols,
    }


def model_ready() -> bool:
    try:
        _load_engine()
        return True
    except Exception:
        return False
```

### Key file — `app/routes_ocr.py`

```python
"""OCR routes for the Casuya Math OCR microservice.

`GET /health` is deliberately open (Railway healthcheck probe); only
`POST /v1/ocr/recognize` requires the internal `X-API-Key`.
"""

from __future__ import annotations

import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException

from app.schemas import OcrRequest, OcrResponse
from app.security import require_api_key
from app.services.recognize import recognize_math

router = APIRouter()

MAX_IMAGE_BYTES = 512 * 1024


@router.get("/health")
def health():
    return {"status": "ok", "service": "casuya-ocr-math"}


@router.post("/v1/ocr/recognize", response_model=OcrResponse)
def ocr_recognize(payload: OcrRequest, _auth: None = Depends(require_api_key)):
    image = payload.image.strip()
    if image.startswith("data:"):
        image = image.split(",", 1)[-1]
    try:
        raw = base64.b64decode(image, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image payload")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image exceeds {MAX_IMAGE_BYTES // 1024} KB limit")
    try:
        result = recognize_math(raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    if not result.get("latex"):
        raise HTTPException(status_code=422, detail="No recognizable math in image")
    return result
```

### Key file — `Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Minimal runtime for Pix2Text/Pillow image decoding.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD gunicorn app:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}
```

### Key file — `requirements.txt`

```
fastapi==0.141.1
uvicorn[standard]==0.52.4
gunicorn>=26.1.0
pydantic==2.13.4
pydantic-settings==2.15.0
numpy>=1.26.4
pix2text>=0.12
Pillow>=10.0
```

### Key file — `railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/readyz",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### `app/__init__.py` (pattern)

```python
"""Casuya Math OCR routing assembly (mirrors apps/audio-stt/app/__init__.py)."""

from __future__ import annotations

from fastapi import FastAPI

from app.config import get_settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes_ocr import router as ocr_router
from app.services.recognize import model_ready

settings = get_settings()


def include_routers(app: FastAPI) -> None:
    app.include_router(ocr_router)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0")
    app.add_middleware(RateLimitMiddleware)
    include_routers(app)
    return app


app = create_app()


@app.get("/readyz")
def readyz():
    ready = model_ready()
    return {"status": "ok" if ready else "degraded", "model_loaded": ready}
```

## 5. Platform Backend Changes

### `apps/platform/backend/config/settings.py` — add

```python
# Self-hosted Math OCR microservice (Pix2Text; Railway-hosted, reached
# over railway.internal). The engine is baked into the image at build time;
# the platform only forwards here with the internal key.
casuya_ocr_url: str = "http://localhost:8030"
casuya_ocr_api_key: str | None = None

# Handwriting OCR provider: "none" | "mathpix" | "self-hosted"
ocr_provider: str = "none"  # none | mathpix | self-hosted
mathpix_app_id: str | None = None
mathpix_app_key: str | None = None
```

### `apps/platform/backend/services/ocr_service.py` — add

```python
def recognize_self_hosted(image_b64: str, service_url: str, api_key: str | None) -> dict:
    """Call the internal Pix2Text OCR microservice."""
    decode_image_payload(image_b64)
    cleaned = image_b64.strip()
    image = cleaned.split(",", 1)[-1] if cleaned.startswith("data:") else cleaned

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            f"{service_url.rstrip('/')}/v1/ocr/recognize",
            headers=headers,
            json={"image": image},
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"OCR service error: {resp.status_code}")
    return resp.json()
```

### `apps/platform/backend/api/ocr/handwriting.py` — update dispatch

```python
def _ocr_configured() -> bool:
    settings = get_settings()
    if settings.ocr_provider == "self-hosted" and settings.casuya_ocr_url:
        return True
    if settings.ocr_provider == "mathpix" and settings.mathpix_app_id and settings.mathpix_app_key:
        return True
    return False
```

The `recognize_handwriting()` handler branches on provider: `self-hosted`
calls `recognize_self_hosted()`, otherwise falls back to `recognize_mathpix()`.
Status endpoint reports the active provider.

## 6. Docker Compose + Deploy

### `infra/docker-compose.full.yml` — add

```yaml
  ocr-math:
    profiles: [full]
    build:
      context: ../apps/ocr-math
      dockerfile: Dockerfile
    ports:
      - "8030:8000"
    restart: unless-stopped
```

### `.env.example` (root + `apps/platform`) — add

```
# Handwriting OCR — self-hosted provider (Pix2Text microservice)
OCR_PROVIDER=self-hosted
CASUYA_OCR_URL=http://localhost:8030
CASUYA_OCR_API_KEY=
# Optional Mathpix fallback
# MATHPIX_APP_ID=
# MATHPIX_APP_KEY=
```

### CI — extend the audio-docker workflow pattern

Add a `docker-smoke` matrix entry (or a dedicated workflow) that builds
`apps/ocr-math`, boots it, and probes `/health` + `/readyz` — mirroring
`.github/workflows/audio-docker.yml`.

## 7. Tests

| Location | Coverage |
|---|---|
| `apps/ocr-math/tests/test_app.py` | `/health`, `/v1/ocr/recognize` with stubbed engine, auth rejection, 400 invalid base64, 413 size limit, 422 no-math |
| `apps/platform/tests/backend/test_ocr.py` | Extend to cover `self-hosted` provider branch (mock httpx) |
| `packages/blackboard/tests/OcrBridge.test.ts` | **No changes** — `proxy` provider already returns `{latex, confidence, symbols}` |

## 8. Nothing Changes Client-Side

| Component | Why |
|---|---|
| `blackboard-embed.js` | Already calls `POST /v1/ocr/handwriting` (Recognize button + grade-time OCR) |
| `OcrBridge.ts` `recognizeProxy()` | Already works with any backend returning `{latex, confidence, symbols}` |
| `ocr-providers.ts` | Capability matrix stays as-is |
| KaTeX rendering | Already handles `$...$` / `$$...$$` |
| Grading flow | `enrichWorkWithOcr()` already reads `recognizedLatex` |

## 9. Rollout

1. Scaffold `apps/ocr-math/` (files above + tests).
2. Build image locally; run `pytest apps/ocr-math`; probe `/health` + `/readyz`.
3. Add platform `ocr_service.recognize_self_hosted()` + provider switch; run
   `pytest apps/platform/tests/ -v`.
4. Register service in `infra/docker-compose.full.yml`; extend CI smoke.
5. Deploy `apps/ocr-math` to Railway (own service, ~200 MB image).
6. Set `OCR_PROVIDER=self-hosted` + `CASUYA_OCR_URL=<railway.internal>` + API key
   on the platform; redeploy platform.
7. Verify: blackboard Recognize button → LaTeX → KaTeX rendering; quiz grading
   enrichment uses real LaTeX.

## 10. Estimated Effort

| Phase | Time |
|---|---|
| Scaffold microservice + engine | 2–3 hours |
| Platform provider switch | 30 minutes |
| Docker/deploy config + CI | 15 minutes |
| Tests | 1 hour |
| Deploy + verify end-to-end | 30 minutes |
| **Total** | **~4–5 hours** |

## 11. Risks / Mitigations

| Risk | Mitigation |
|---|---|
| Pix2Text accuracy below Mathpix on classroom handwriting | Benchmark against golden fixtures in `packages/blackboard/tests/evaluation/fixtures/` before cutover; keep Mathpix as fallback |
| Image size growth | Bump model class / swap to LaTeX-OCR later on a larger Railway plan |
| Model download at build time | Bake into Docker image (audio pattern); override at build via ARG |
| Startup latency on first request | Lazy model load; `/readyz` gates Railway healthcheck (120s timeout) |
| Incompatibility with future full-page OCR | Design `/v1/ocr/recognize` response to support multiple `symbols` entries now |

## 12. Follow-ups (out of scope here)

- Visual equation editor (replace the `prompt()` LaTeX dialog) — student UX.
- Benchmark harness for Tanzanian classroom samples.
- Optional offline Tesseract.js fallback already shipped in `OcrBridge`.