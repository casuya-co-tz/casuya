"""Request/response schemas for the Casuya Audio-TTS microservice."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TtsPayload(BaseModel):
    """Text to synthesize with Piper.

    `lang` is used by the student client (and future ABC/MTTS integrations) to
    pick the right cached voice; the engine uses the voice baked into the image.
    Allowed: `sw` (Kiswahili) or `en` (English).
    """

    text: str = Field(min_length=1, max_length=1000)
    lang: str = Field(default="sw", pattern="^(sw|en)$")
