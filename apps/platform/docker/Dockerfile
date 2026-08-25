# Casuya Platform — multi-stage build
FROM node:26-alpine AS frontend
WORKDIR /app
COPY frontend/ frontend/
RUN mkdir -p /app/build && cp -r frontend/* /app/build/

FROM python:3.14-slim
RUN groupadd -r casuya && useradd -r -g casuya -d /app -s /sbin/nologin casuya

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY integrations/ integrations/
COPY database/ database/
COPY storage/ storage/
COPY --from=frontend /app/build/ frontend/

RUN chown -R casuya:casuya /app/storage

USER casuya

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://localhost:'+os.environ.get('PORT','8000')+'/health')" || exit 1

# Honour Koyeb's injected PORT (defaults to 8000 for local/Docker runs).
CMD ["sh", "-c", "gunicorn backend.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}"]
