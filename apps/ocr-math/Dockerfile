FROM python:3.12-slim

WORKDIR /app

# Pillow/pix2text image backends + ffmpeg-free decode deps (libglib for some
# cv2 fallback paths). Mirrors the audio images: no build toolchain needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Critical: install CPU-only torch BEFORE pix2text so pip keeps the small
# CPU wheel instead of pulling the multi-GB CUDA build. Index URL is pinned.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD gunicorn app:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}