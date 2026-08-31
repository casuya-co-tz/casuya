FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy top-level packages exactly as the app expects them
COPY backend/ backend/
COPY integrations/ integrations/
COPY database/ database/
COPY storage/ storage/

# Ensure storage mount points exist (lesson-packages etc. are .gitignored locally)
RUN mkdir -p storage/lesson-packages storage/quiz-packages storage/game-packages storage/backups

# Static frontend is served by FastAPI on the same origin
COPY frontend/ frontend/

EXPOSE 8000

# Railway injects $PORT; default to 8000 locally.
# Multiple workers scale concurrency; a Redis startup lock prevents the DDL
# reconciliation in init_db from racing across workers (see backend/config/database.py).
# Tune WEB_CONCURRENCY per instance (2-4 typically; with sync workers each also
# handles many I/O-bound requests via worker threads).
CMD ["sh", "-c", "gunicorn backend.main:app -w ${WEB_CONCURRENCY:-2} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --forwarded-allow-ips='*'"]