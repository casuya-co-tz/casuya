FROM python:3.12-slim

WORKDIR /app

# Minimal toolchain: curl for downloads, ca-certificates + bzip2 for the
# Sherpa-ONNX Whisper voice/ASR assets (mirrors apps/audio-tts/Dockerfile).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Critical: install the Python package so `import sherpa_onnx` works at boot.
# This is the cp312 manylinux wheel from PyPI — no source build, no g++.
RUN pip install --no-cache-dir sherpa-onnx

# Bake Whisper-small multilingual ASR (better WER than base on classroom speech).
# int8 encoder/decoder are the CPU recommendation from the sherpa-onnx docs.
# Override WHISPER_MODEL=base at build time to keep the smaller image if needed.
ARG WHISPER_MODEL=small
RUN mkdir -p /opt/sherpa-onnx-models \
    && curl -fL --retry 3 -o /opt/sherpa-onnx-models/whisper-${WHISPER_MODEL}.tar.bz2 \
        https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-${WHISPER_MODEL}.tar.bz2 \
    && tar -xjf /opt/sherpa-onnx-models/whisper-${WHISPER_MODEL}.tar.bz2 -C /opt/sherpa-onnx-models \
    && rm /opt/sherpa-onnx-models/whisper-${WHISPER_MODEL}.tar.bz2

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD gunicorn app:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}