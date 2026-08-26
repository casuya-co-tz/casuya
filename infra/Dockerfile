# syntax=docker/dockerfile:1
# Multi-stage build for the Casuya hybrid monorepo.
# Stage 1 compiles the JS/TS packages (design system, runtime, editor, etc.)
# Stage 2 assembles the Python (FastAPI) backend and bundles the compiled frontend.

# ---- Stage 1: Node / pnpm build ----
FROM node:20-alpine AS node-build
WORKDIR /build
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY libs ./libs
COPY apps ./apps
RUN pnpm install --frozen-lockfile=false
RUN pnpm build

# ---- Stage 2: Python runtime ----
FROM python:3.12-slim AS python-runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps for psycopg2 / building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/platform/requirements.txt ./apps/platform/requirements.txt
RUN pip install --upgrade pip && pip install -r apps/platform/requirements.txt

COPY apps/platform ./apps/platform
COPY libs/core ./libs/core
RUN pip install -e libs/core

# Bundle the compiled frontend static assets from the node stage
COPY --from=node-build /build/apps/platform/frontend ./apps/platform/frontend

EXPOSE 8000
WORKDIR /app/apps/platform
CMD ["gunicorn", "backend.main:app", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
