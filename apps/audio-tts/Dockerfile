# Casuya Audio-TTS — Sherpa-ONNX TTS (Kiswahili `sw` + English `en` VITS
# voices), built exactly like the proven `apps/audio-stt` image: the engine is
# a real PyPI wheel and the voices are official `k2-fsa/sherpa-onnx`
# `tts-models` release assets, both verified to exist.
#
# Why not piper (rhasspy): `piper` needs the `piper-phonemize` C++ module,
# whose PyPI wheel was removed, and building it from source keeps failing inside
# Railway's sandbox (espeak-ng-data resource fetch). sherpa-onnx ships real
# cp312 wheels on PyPI and its TTS voices are ready-made `.tar.bz2` assets on
# GitHub Releases — no source build, no phonemize compile.

FROM python:3.12-slim

WORKDIR /app

# curl (download voices), bzip2 (extract .tar.bz2), ca-certificates.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Engine (canonical PyPI wheel; mirrors audio-stt's `pip install sherpa-onnx`).
RUN pip install --no-cache-dir sherpa-onnx

# Voices baked in at build time from the k2-fsa/sherpa-onnx `tts-models` release
# (verified assets, see docs/infra/audio-integrations.md):
#   sw: vits-piper-sw_CD-lanfrica-medium  (Kiswahili, 22050 Hz, 1 speaker)
#   en: vits-piper-en_US-amy-low          (English, 22050 Hz, 1 speaker)
ARG SHERPA_TTS_DIR=/opt/sherpa-onnx-tts/models
RUN mkdir -p ${SHERPA_TTS_DIR} \
    && curl -fL --retry 3 -o /tmp/sw.tar.bz2 \
        https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-sw_CD-lanfrica-medium.tar.bz2 \
    && tar -xjf /tmp/sw.tar.bz2 -C ${SHERPA_TTS_DIR} \
    && rm /tmp/sw.tar.bz2 \
    && curl -fL --retry 3 -o /tmp/en.tar.bz2 \
        https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-low.tar.bz2 \
    && tar -xjf /tmp/en.tar.bz2 -C ${SHERPA_TTS_DIR} \
    && rm /tmp/en.tar.bz2

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}