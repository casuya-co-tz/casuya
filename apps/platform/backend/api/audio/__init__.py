"""Casuya Audio proxy barrel (platform backend).

Merges the TTS + STT proxy submodule routers into a single `/v1/audio` router
(own tags), mirroring `backend/api/payments/__init__.py`. Own submodules NEVER
declare a `/{path:path}` proxy, so this barrel is safe to wire directly into
`backend/app/routers.py` BEFORE `casuya_api_proxy` (the catch-all that MUST be
registered last).
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.api.audio.stt import router as stt_router
from backend.api.audio.tts import router as tts_router

router = APIRouter(prefix="/v1/audio", tags=["audio"])

router.include_router(tts_router)
router.include_router(stt_router)

__all__ = ["router"]
