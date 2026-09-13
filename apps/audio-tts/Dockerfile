FROM python:3.12-slim

WORKDIR /app

# Piper + voices come straight from GitHub (the repo IS the open source we
# point to for each engine). Doing this at build time keeps the runtime image
# small and repeatable, exactly like apps/payments' Docker build mirrors.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# 1) Piper engine pinned to a tag.
ARG PIPER_TAG=1.2.0
RUN git clone --depth 1 --branch ${PIPER_TAG} https://github.com/rhasspy/piper.git /opt/piper \
    && pip install --no-cache-dir ./piper
# 2) Kiswahili + English voice clones (model files resolved at build).
RUN git clone --depth 1 https://github.com/rhasspy/piper-voices.git /opt/piper-voices

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/

EXPOSE 8000

CMD gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}
