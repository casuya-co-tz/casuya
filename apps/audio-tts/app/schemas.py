"""Request/response schemas for the Casuya Audio-TTS microservice."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TtsPayload(BaseModel):
    """Text to synthesize with Sherpa-ONNX TTS.

    `lang` picks the voice baked into the image, and is also used by the
    student client (and future ABC/MTTS integrations) for caching.
    Allowed: `sw` (Kiswahili) or `en` (English).
    """

    text: str = Field(min_length=1, max_length=1000)
    lang: str = Field(default="sw", pattern="^(sw|en)$")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
