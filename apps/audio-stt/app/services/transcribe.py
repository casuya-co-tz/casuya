"""Casuya Audio-STT ���?" Sherpa-ONNX transcription engine (baked at build).

Mirrors `apps/audio-tts/app/services/synthesize.py`: lazily loads the engine so
`/health` stays green during rolling Railway deploys. The ASR model (Kiswahili
`sw` + English) was `git clone`d from `k2-fsa/sherpa-onnx` and baked into the
image at build time; at boot we import the Python package and point it at the
ONNX model files on disk.
"""

from __future__ import annotations

from app.config import get_settings

_sherpa = None


def _load_engine():
    global _sherpa
    if _sherpa is None:
        import sherpa_onnx  # type: ignore[import-not-found]

        settings = get_settings()
        # Single short-utterance "zipformer" model answering for both sw + en;
        # model files live under /opt/sherpa-onnx-models (baked at build).
        _sherpa = sherpa_onnx.OnlineRecognizer.from_transducer(
            tokens_path="/opt/sherpa-onnx/models/tokens.txt",
            encoder="/opt/sherpa-onnx/models/encoder.onnx",
            decoder="/opt/sherpa-onnx/models/decoder.onnx",
            joiner="/opt/sherpa-onnx/models/joiner.onnx",
            num_threads=2,
            sample_rate=settings.sherpa_sample_rate,
            feature_dim=80,
            enable_endpoint_detection=True,
            rule1_min_trailing_silence=2.4,
            rule2_min_trailing_silence=1.2,
            rule3_min_utterance_length=0.0,
            hotwords_string=settings.sherpa_hotwords,
        )
    return _sherpa


def transcribe_wav(pcm16_wav: bytes) -> str:
    """Transcribe a 16 kHz PCM-mono WAV blob to text (Kiswahili/English)."""
    import io
    import wave

    engine = _load_engine()
    with wave.open(io.BytesIO(pcm16_wav), "rb") as wf:
        frames = wf.readframes(wf.getnframes())
    stream = engine.create_stream()
    stream.accept_waveform(sample_rate=get_settings().sherpa_sample_rate, waveform=frames)
    stream.input_finished()
    return " ".join(engine.decode_stream(stream)).strip()


def model_ready() -> bool:
    try:
        _load_engine()
        return True
    except Exception:
        return False
