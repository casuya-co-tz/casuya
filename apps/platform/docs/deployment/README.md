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

- `apps/platform/docker/Dockerfile` — Production container (gunicorn)
- `apps/platform/vercel.json` — Static frontend on Vercel
- `infra/docker-compose.yml` — Full local stack (postgres + redis + backend + nginx)
- `infra/render.yaml` — Render deployment config
