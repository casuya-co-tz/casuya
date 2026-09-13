FROM python:3.12-slim

WORKDIR /app

# Sherpa-ONNX engine + Kiswahili/English ASR models cloned straight from GitHub
# (the repo IS the open source we cite for both engines) at build time.
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/k2-fsa/sherpa-onnx.git /dev/null 2>&1 || true
# Pull just the model artifacts referenced at runtime.
RUN git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/k2-fsa/sherpa-onnx.git /opt/sherpa-onnx \
    && cd /opt/sherpa-onnx \
    && git sparse-checkout set scripts/onnx_models scripts/onnx_pretrained_models

# Critical: install the Python package so `import sherpa_onnx` works at boot.
RUN pip install --no-cache-dir sherpa-onnx

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/

EXPOSE 8000

CMD gunicorn app:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}
