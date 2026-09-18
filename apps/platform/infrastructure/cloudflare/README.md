# Cloudflare

DNS, CDN, and cache-purge for **casuya.co.tz**.

API calls live in `apps/platform/integrations/cloudflare.py`.
Rules live in `apps/platform/docker/cloudflare/cache-rules.json`.

## Zone

| | |
|---|---|
| Zone | `casuya.co.tz` |
| Zone ID | `902d9fb7b7d88c2f7b8a20a8dffefaa1` |
| Account ID | `0f79cf0abd1bfed2afb8594bdecd196a` |
| Dashboard | [dash.cloudflare.com](https://dash.cloudflare.com/0f79cf0abd1bfed2afb8594bdecd196a/casuya.co.tz) |

Rules apply only to hostnames on this zone that are proxied (orange cloud).
Vercel `www` and a Railway API CNAME both qualify; `*.up.railway.app` does not.

Zone status is **pending** until the registrar uses Cloudflare nameservers
`aaron.ns.cloudflare.com` and `liberty.ns.cloudflare.com` (currently still
Sakura Host). Cache Rules are stored on the zone and take effect after that
cutover. R2 custom domain `cdn.casuya.co.tz` cannot attach while pending.

| | |
|---|---|
| Cache Rules | Deployed — 7 rules, ruleset `3d84c3e0d8e34b3b8d6f922dc8fa8eff` |
| R2 bucket | `casuya-uploads` (WEUR) |
| CDN | `https://cdn.casuya.co.tz` — set `PUBLIC_ASSETS_BASE` to this after objects are copied |

## Environment

```
CLOUDFLARE_ZONE_ID=902d9fb7b7d88c2f7b8a20a8dffefaa1
CLOUDFLARE_ACCOUNT_ID=0f79cf0abd1bfed2afb8594bdecd196a
CLOUDFLARE_API_TOKEN=          # Cache Purge + Zone Cache Rules Edit + R2
R2_ACCESS_KEY_ID=              # S3-compatible, not the API token
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=casuya-uploads
R2_S3_ENDPOINT=https://0f79cf0abd1bfed2afb8594bdecd196a.r2.cloudflarestorage.com
PUBLIC_ASSETS_BASE=            # optional https CDN/R2 custom domain for /uploads/
```

On boot, `deploy_cache_rules()` PUTs the zone Cache Rules entrypoint from
`cache-rules.json`. Without `CLOUDFLARE_API_TOKEN` it is a no-op.

Token permissions: **Cache Purge**, **Zone Cache Rules Edit** (or Zone
Rulesets Edit) on **casuya.co.tz**. R2 S3 keys are for object put/get only;
browsers must use `PUBLIC_ASSETS_BASE` (custom domain), never the S3 endpoint.

Set the same token on Railway so production boot can refresh the rules.
