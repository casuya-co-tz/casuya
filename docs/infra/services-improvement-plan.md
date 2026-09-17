# Casuya — Platform Services Improvement Plan

**Author:** Engineering review (2026-09-17)  
**Status:** Implemented (Phases 0–4 core) — manual production verification pending  
**Related:** [`audio-stt-tts-improvement-plan.md`](./audio-stt-tts-improvement-plan.md) (audio track — largely done), [`audio-integrations.md`](./audio-integrations.md)

This document is the **starting plan** for hardening every deployable Casuya
service beyond STT/TTS. It follows the same audit → phased delivery pattern used
for the audio stack.

Use this as the checklist for the next engineering sprint(s).

---

## 0. Executive summary

### Deployable inventory

| Service | Path | Host | Role |
|---|---|---|---|
| Platform backend | `apps/platform` | Railway | Main FastAPI API |
| Platform frontend | `apps/platform/frontend` | Vercel | Static student/teacher/admin UI |
| Payments | `apps/payments` | Railway | AzamPay checkout, subscriptions, webhooks |
| Audio TTS | `apps/audio-tts` | Railway | Sherpa-ONNX TTS (`sw` + `en`) |
| Audio STT | `apps/audio-stt` | Railway | Sherpa-ONNX Whisper STT |
| Casuya AI | `packages/ai` | Railway | Tutoring, plans, exams, content HTTP API |
| Editor demo | `packages/editor` | Vercel | Lesson builder demo |
| Runtime demo | `packages/runtime` | Vercel | Lesson player demo |
| DS Playground | `apps/ds-playground` | Vercel | Design-system playground |

**Libraries (not standalone):** `packages/bridge`, `packages/blackboard`,
`packages/editor` (npm), `packages/runtime` (npm), `packages/ds-*`, `libs/core`.

### What is already well made

| Area | Notes |
|---|---|
| Platform backend architecture | Layered routers, Redis rate limits, `/health` + `/readyz`, global error handlers |
| Platform pytest suite | **36 files** under `apps/platform/tests/backend/` — high quality, **not run in root CI** |
| Bridge | node:test across sync, security, network |
| Blackboard / Editor libs | vitest on core math, exporters, importers |
| AI library | 23 Jest tests, provider failover chain, knowledge base |
| Audio microservices | Consistent FastAPI template, Docker CI smoke, infra docs |

### Top gaps blocking “production sign-off”

| ID | Issue | Severity | Service |
|---|---|---|---|
| S-01 | Root CI never runs platform pytest (only `import backend.main`) | 🔴 CI lie |
| S-02 | Payments microservice has **zero tests** | 🔴 Risk |
| S-03 | Casuya AI HTTP has **no auth** on POST endpoints | 🔴 Security |
| S-04 | Casuya AI swallows errors → HTTP 200 + empty payloads | 🔴 Reliability |
| S-05 | Runtime `"test"` script is a stub; 22 Jest tests bypassed | 🟡 CI gap |
| S-06 | Payments has no rate limits | 🟡 Abuse |
| S-07 | Payments has no `.env.example` | 🟡 Ops |
| S-08 | AI `RateLimiter` exists but is not wired in `server.ts` | 🟡 Unused |
| S-09 | AI has `/health` only — no `/readyz` | 🟡 Deploy |
| S-10 | `docker-compose.yml` missing payments, audio, AI | 🟡 DevEx |
| S-11 | Vercel demo deploys use `continue-on-error: true` | 🟡 Silent fail |
| S-12 | `CONTRIBUTING.md` / `render.yaml` docs drift | 🟢 Docs |

### Target outcome

After Phases 0–2:

- **CI tells the truth** — platform pytest, runtime Jest, and smoke tests run on every PR.
- **Money path is tested** — payments checkout, webhook, subscription flows have pytest coverage.
- **AI service is hardened** — API key auth, rate limits, `/readyz`, real error status codes.
- **Local dev can run full stack** — compose profile for platform + payments + audio + AI.

---

## 1. Scope and non-goals

### In scope

- Root CI (`.github/workflows/ci.yml`)
- `apps/platform/package.json` test wiring
- `apps/payments/` (tests, rate limits, env docs)
- `packages/ai/server.ts` (auth, readyz, rate limiter, error responses)
- `packages/runtime/package.json` test script
- `infra/docker-compose.yml` (optional full-stack profile)
- Docs: `CONTRIBUTING.md`, deployment README, this plan

### Out of scope (this plan)

- Replacing AzamPay or adding new payment providers
- Replacing free-chain AI providers with paid APIs
- Frontend JS unit test suite (separate initiative)
- Horizontal scaling / Kubernetes
- Blackboard OCR production provider (evaluate later)
- DS package test coverage (low priority)

---

## 2. Architecture (current production chain)

```
www.casuya.co.tz (Vercel static)
    ↓ Bearer JWT
casuya-platform-production (Railway)
    ├── CASUYA_PAYMENTS_URL      → apps/payments
    ├── CASUYA_AUDIO_TTS_URL     → apps/audio-tts
    ├── CASUYA_AUDIO_STT_URL     → apps/audio-stt
    └── CASUYA_AI_URL            → packages/ai (server.ts)
```

Each microservice should mirror the audio pattern:

- `/health` (open) + `/readyz` (model/DB gate)
- Internal `X-API-Key` from platform only
- Per-route or global rate limits for expensive endpoints
- Pytest or Jest in root CI

---

## 3. Phased delivery

### Phase 0 — CI truth (P0, ~1 day)

**Goal:** Stop shipping regressions that tests would have caught.

| Task | Files | Acceptance |
|---|---|---|
| P0-1 Wire platform pytest into root CI | `.github/workflows/ci.yml`, `apps/platform/package.json` | `pytest apps/platform/tests/backend/` runs on every PR; green on main |
| P0-2 Fix platform `package.json` test script | `apps/platform/package.json` | `"test": "pytest tests/backend -q"` (or via turbo) |
| P0-3 Wire runtime Jest into turbo test | `packages/runtime/package.json`, root `turbo.json` if needed | `"test": "npm run test:all"`; CI runs real tests |
| P0-4 Remove or document orphaned nested workflows | `apps/platform/.github/`, `packages/*/.github/` | Either delete or add comment in CONTRIBUTING that root CI is canonical |

**Exit criteria**

- [ ] CI job fails when a platform auth or audio proxy test fails
- [ ] CI job fails when a runtime security test fails
- [ ] `pnpm test` at repo root exercises platform pytest + runtime Jest

---

### Phase 1 — Payments hardening (P0, ~2–3 days)

**Goal:** The money path is tested, bounded, and operable.

| Task | Files | Acceptance |
|---|---|---|
| P1-1 Add `apps/payments/tests/` smoke suite | `tests/test_health.py`, `tests/test_checkout_mock.py`, `tests/test_webhook.py` | Checkout mock flow, webhook HMAC, 401 without API key |
| P1-2 Add `.env.example` | `apps/payments/.env.example` | All required vars documented (AzamPay, DB, API key) |
| P1-3 Add rate limits | `app/middleware/` or FastAPI dependency | Checkout/webhook endpoints bounded (mirror platform pattern) |
| P1-4 Fix `/stats` scalability | `app/routes_misc.py` | Aggregate via SQL `COUNT`/`SUM`, not full-table load |
| P1-5 Wire payments pytest into CI | `.github/workflows/ci.yml` | Payments tests run on PR |
| P1-6 Docker CI smoke (optional) | `.github/workflows/payments-docker.yml` | Build image, probe `/health` + `/readyz` |

**Exit criteria**

- [ ] `pytest apps/payments/tests/` passes locally and in CI
- [ ] Production requires `API_KEY`; mock mode documented for dev
- [ ] New engineer can configure payments from `.env.example` alone

---

### Phase 2 — Casuya AI service hardening (P0, ~2 days)

**Goal:** AI microservice matches audio/payments security posture.

| Task | Files | Acceptance |
|---|---|---|
| P2-1 Add `X-API-Key` auth middleware | `packages/ai/server.ts`, `packages/ai/src/config.ts` | 401 without key when `CASUYA_AI_API_KEY` set |
| P2-2 Add `/readyz` | `server.ts` | Returns `{ status, kb_ready, providers_ready }`; Railway healthcheck can use it |
| P2-3 Wire existing `RateLimiter` | `server.ts`, `src/utilities/rate-limiter.ts` | Per-IP or per-key limits on POST routes |
| P2-4 Stop silent 200 on hard failures | `server.ts` (`safeAsync`) | Provider/validation errors return 4xx/5xx with `{ error, detail }`; empty fallback only for soft degrade |
| P2-5 Platform env parity | `apps/platform/.env.example`, `backend/config/settings.py` | `CASUYA_AI_API_KEY` documented and forwarded |
| P2-6 Jest integration test for auth | `packages/ai/tests/integration/` | 401 without key, 200 with key |

**Exit criteria**

- [ ] Unauthenticated POST to AI URL returns 401 in production
- [ ] `/readyz` fails when knowledge base or providers cannot initialize
- [ ] Platform logs show real AI errors instead of empty `{ questions: [] }`

---

### Phase 3 — Dev stack & docs (P1, ~1–2 days)

**Goal:** One-command local full stack; docs match reality.

| Task | Files | Acceptance |
|---|---|---|
| P3-1 Extend docker-compose | `infra/docker-compose.yml`, `infra/nginx/default.conf` | Profile `full` starts platform + postgres + redis + payments + audio-tts + audio-stt + ai |
| P3-2 Update deployment docs | `apps/platform/docs/deployment/README.md`, `CONTRIBUTING.md` | Lists all Railway services; removes “only deployable app” claim |
| P3-3 Archive or delete `infra/render.yaml` | `infra/render.yaml`, README note | No confusion about Render vs Railway |
| P3-4 Vercel deploy strictness | `.github/workflows/deploy.yml` | Remove `continue-on-error: true` for editor/runtime OR add Slack/issue on failure |

**Exit criteria**

- [ ] `docker compose --profile full up` documented and working
- [ ] New contributor onboarding doc lists all 5 Railway services

---

### Phase 4 — Backlog (P2) — implemented core items

| ID | Task | Status |
|---|---|---|
| B-01 | Audio pytest in CI (stub engine + synthetic WAV fixtures) | ✅ `ci.yml` backend job |
| B-02 | Service-level rate limits on audio-tts/stt | ✅ 60/min TTS, 30/min STT |
| B-03 | `libs/core` pytest in CI | ✅ `pytest libs/core/tests` |
| B-04 | Blackboard OCR production provider evaluation | ✅ Mathpix proxy, Recognize button, fixture harness |
| B-05 | Frontend JS smoke tests (Playwright: login + lesson load) | ✅ `apps/platform/e2e/` + CI job |
| B-06 | DS playground tests + real typecheck for ds-docs | ✅ vitest smoke + `tsc` on ds-docs |
| B-07 | Platform startup: fail fast when DB unreachable (config flag) | ✅ `REQUIRE_DATABASE_ON_STARTUP` |
| P3-4 | Vercel deploy strictness (editor/runtime) | ✅ removed `continue-on-error` |
| P3-3 | Render blueprint deprecation note | ✅ `infra/render.yaml` header |

---

## 4. Service scorecard (baseline)

| Service | Tests | Health | Rate limit | Env docs | Root CI |
|---|---|---|---|---|---|
| Platform backend | ✅ 36+ pytest | ✅ /health + /readyz | ✅ | ✅ | ✅ pytest in CI |
| Platform frontend | ✅ Playwright smoke | N/A | N/A | via platform | ✅ e2e job |
| Payments | ✅ 10 pytest | ✅ | ✅ | ✅ | ✅ pytest in CI |
| Audio TTS | ✅ stub pytest | ✅ | ✅ 60/min | ✅ | ✅ pytest + docker |
| Audio STT | ✅ stub pytest | ✅ | ✅ 30/min | ✅ | ✅ pytest + docker |
| Casuya AI | ✅ 23 jest (lib) | ⚠️ /health only | ❌ unused util | partial | ✅ via turbo |
| Runtime | ✅ 22 jest | N/A | N/A | README | ❌ stub script |
| Bridge | ✅ node:test | N/A | N/A | ✅ | ✅ |
| Blackboard | ✅ vitest | N/A | N/A | README | ✅ |
| Editor | ✅ vitest | N/A | N/A | README | ✅ |
| libs/core | ✅ 9 pytest | N/A | N/A | README | ✅ pytest in CI |

---

## 5. Recommended start order

**Week 1 (start here)**

1. **Phase 0** — CI truth (platform pytest + runtime Jest). Lowest effort, highest leverage.
2. **Phase 1** — Payments tests + `.env.example`. Business-critical path.

**Week 2**

3. **Phase 2** — AI auth + readyz + error handling.
4. **Phase 3** — docker-compose full profile + doc cleanup.

**When stable**

5. Phase 4 backlog items as capacity allows.

---

## 6. Testing plan

### CI (every PR)

```bash
pnpm check:layers
pnpm check:deploy
pnpm build && pnpm typecheck && pnpm lint
pnpm test                                    # includes runtime Jest after Phase 0
pytest apps/platform/tests/backend/ -q     # after Phase 0
pytest apps/payments/tests/ -q               # after Phase 1
pytest apps/audio-tts/tests/ -q              # after Phase 4
pytest apps/audio-stt/tests/ -q              # after Phase 4
pytest libs/core/tests/ -q                   # after Phase 4
```

### Manual smoke (after each phase deploy)

| Check | Command / action |
|---|---|
| Platform health | `curl -sf https://casuya-platform-production.up.railway.app/health` |
| Payments readyz | `curl -sf $PAYMENTS_URL/readyz` |
| AI readyz | `curl -sf $AI_URL/readyz` (after Phase 2) |
| Audio readyz | `curl -sf $TTS_URL/readyz` && `curl -sf $STT_URL/readyz` |
| End-to-end | Login → lesson → Listen; teacher → generate plan; student → mock checkout |

---

## 7. Environment variables checklist

Ensure Railway + `.env.example` files stay aligned:

| Variable | Set on | Consumed by |
|---|---|---|
| `CASUYA_PAYMENTS_URL` | Platform | Platform proxy |
| `CASUYA_PAYMENTS_API_KEY` | Platform + Payments | Internal auth |
| `CASUYA_AUDIO_TTS_URL` / `_API_KEY` | Platform + TTS | Audio proxy |
| `CASUYA_AUDIO_STT_URL` / `_API_KEY` | Platform + STT | Audio proxy |
| `CASUYA_AI_URL` | Platform | AI proxy |
| `CASUYA_AI_API_KEY` | Platform + AI | **Add in Phase 2** |

---

## 8. Sign-off checklist

Before marking this plan **Implemented**:

- [x] Phase 0 complete — CI runs platform pytest + runtime Jest
- [x] Phase 1 complete — payments tested, rate-limited, documented
- [x] Phase 2 complete — AI authenticated, readyz, honest errors
- [x] Phase 3 complete — full-stack compose + docs updated
- [x] Phase 4 complete — audio + core CI, audio rate limits, DB fail-fast
- [ ] All new CI steps green on `main` (fix in progress: libs/core loader, e2e, runtime deploy)
- [ ] Manual smoke checklist passed on production — run `scripts/smoke-production.ps1`

---

## 9. References

- Audio improvement plan (completed): [`audio-stt-tts-improvement-plan.md`](./audio-stt-tts-improvement-plan.md)
- Audio architecture: [`audio-integrations.md`](./audio-integrations.md)
- Platform deployment: [`apps/platform/docs/deployment/README.md`](../../apps/platform/docs/deployment/README.md)
- Layer rules: [`AGENTS.md`](../../AGENTS.md)
