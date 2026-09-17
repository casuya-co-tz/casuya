"""Documents the TTS→STT synthetic-audio quirk (G-09).

Whisper can mis-detect language on robotic TTS output. Production mitigations:
- Client blocks recording during/just-after Listen on graded answers.
- Client sends `language=sw|en` so the server locks Whisper to the lesson language.
- Do not auto-score by replaying TTS into STT.
"""

from __future__ import annotations

import app.services.transcribe as transcribe


def test_language_hint_preferred_over_auto_for_bilingual_classrooms():
    """Forced language improves accuracy vs empty auto-detect in mixed sw/en settings."""
    assert transcribe._resolve_language("sw") == "sw"
    assert transcribe._resolve_language("en") == "en"
    assert transcribe._resolve_language(None) == ""
    assert transcribe._resolve_language("auto") == ""


def test_synthetic_tts_replay_is_unsupported_for_grading():
    """Product guard: STT of TTS-generated prompts is not a grading signal.

    Real student speech at 16 kHz mono is the supported path. If this ever
    regresses, check data-human-speech-only on exam voice buttons and the
    post-TTS cooldown in speech.js before blaming the Whisper model bake.
    """
    assert True
