# Deployment Documentation

Deployment configuration and infrastructure notes for the Casuya platform.

## Environments

| Environment | Domain | Database | AzamPay Mode |
|-------------|--------|----------|--------------|
| Development | localhost:8765 | SQLite / local Postgres | Sandbox |
| Staging | staging.casuya.co.tz | Postgres | Sandbox |
| Production | casuya.co.tz | Postgres | Live |

## Infrastructure

- `infrastructure/cloudflare/` — DNS, CDN, cache-purge config
- `infrastructure/environments/` — Per-environment configuration
- `infrastructure/monitoring/` — Uptime checks, error tracking
- `infrastructure/ssl/` — SSL certificate notes

## Deployment Files

- `infra/Dockerfile` — Production container (gunicorn)
- `apps/platform/vercel.json` — Static frontend on Vercel
- `infra/docker-compose.yml` — Local stack (postgres + redis + backend + nginx)
- `infra/docker-compose.full.yml` — Optional profile adding payments, audio TTS/STT, casuya-ai
- `infra/render.yaml` — Legacy Render config (abandoned; Railway is canonical)

## Railway microservices

| Service | Path | Health |
|---|---|---|
| Platform backend | `apps/platform` | `/health`, `/readyz` |
| Payments | `apps/payments` | `/health`, `/readyz` |
| Audio TTS | `apps/audio-tts` | `/health`, `/readyz` |
| Audio STT | `apps/audio-stt` | `/health`, `/readyz` |
| Casuya AI | `packages/ai` | `/health`, `/readyz` |
