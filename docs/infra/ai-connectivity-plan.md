# Casuya AI — Tight Connectivity Plan

**Author:** Engineering review (2026-09-17)  
**Status:** P0–P4 implemented locally  
**Related:** [`services-improvement-plan.md`](./services-improvement-plan.md) (Phase 2 AI hardening)

This plan turns Casuya AI from a **silently-degrading** integration into a
**super-AI** stack: syllabus-grounded responses, honest errors, traceable
fallbacks, and production-ready health probes.

---

## 0. Executive summary

### Problem

| Symptom | Root cause |
|---|---|
| Quiz returns weak sentence-MCQs | Platform `_call_ai_service` → `None` → local fallback; AI returns `{ questions: [] }` with HTTP 200 |
| Tutoring ignores TIE syllabus | Platform sends `curriculum_context`; AI route drops it; `SyllabusAdapter` not wired at boot |
| Moderation always “safe” on failure | AI `soft: true` → `{ flagged: false }`; platform pattern-matches locally |
| Math calls AI for stubs | `/api/math/*` returns `{ solved: true }`; platform already has `_safe_eval` |
| Ops cannot tell AI is down | Startup probes `/health` only; responses lack `source` field |

### Target outcome (after P0–P1)

- AI service returns **503** when providers fail or output is empty (no fake success).
- Platform bridge **raises structured errors**, retries transient failures, uses **settings URL**.
- Every user-facing AI response includes **`source`**: `casuya-ai` | `offline` | `kb-fallback`.
- `SyllabusAdapter` wired at AI boot; routes honor inbound `curriculum_context`.
- `GET /ai/status` and startup `/readyz` probe give ops truthful connectivity.

### Non-goals (P3–P4 backlog)

- Replacing free-chain providers with paid-only APIs
- Real symbolic math engine on AI service (platform-local math is sufficient)
- Frontend UI badges (backend fields first)

---

## 1. Architecture

```
Frontend / Blackboard
        │
        ▼
Platform  /ai/*  (auth, rate limit, source tagging)
        │
        ▼
ai_bridge/client.py  ──POST + X-API-Key──►  casuya-ai  /api/*
        │                                         │
        │                                         ├── Failover providers (Groq→…→local)
        │                                         ├── Knowledge base RAG
        │                                         └── SyllabusAdapter ──GET──► Platform /syllabus/ai/*
        │
        └── explicit offline fallbacks (logged, source=offline)
```

### Route contract matrix

| Platform caller | AI endpoint | Required body fields | P1 fix |
|---|---|---|---|
| `generate_quiz_questions` | `/api/questions/generate` | `content`, `count`, `subject_slug`, `form_level`, `instructions`, `curriculum_context` | Pass all fields |
| `get_tutoring_*` | `/api/tutoring/explain` | `question`, `context`, `subject_slug`, `form_level`, `curriculum_context` | Inject curriculum into prompt |
| `generate_practice_questions` | `/api/tutoring/quiz` | `question`, `context`, `count`, `form_level` | OK |
| `generate_test_questions` | `/api/tests/generate` | KB-grounded payload | OK |
| `generate_exam_paper` | `/api/exams/generate` | sections + `curriculum_context` | OK |
| `teacher_plans` | `/api/plans/*` | full prompt + metadata | Offline fallback retained |
| `moderate_content` | `/api/content/moderate` | `content` | No soft-fail |
| `math.*` | *(removed hop)* | — | Platform-local only |

---

## 2. Phased delivery

### Phase P0 — Stop lying (~1 day)

| ID | Task | Files |
|---|---|---|
| P0-1 | Remove `soft: true` on questions + moderate; validate non-empty AI output | `packages/ai/server.ts`, route handlers |
| P0-2 | `AiServiceError` + retries (502/503/429) + settings URL | `ai_bridge/client.py` |
| P0-3 | Callers catch errors → explicit offline fallback + `source` | `prompts.py`, `tests.py`, `moderation.py`, `exam.py` |
| P0-4 | Skip fake AI math hop | `math.py` |
| P0-5 | Platform responses include `source`; optional `allow_offline=0` → 503 | `api/ai.py` |
| P0-6 | Update outdated server header comment | `packages/ai/server.ts` |

**Acceptance**

- [x] Empty question generation returns 503 from AI service (not `{ questions: [] }`)
- [x] Platform quiz response includes `"source": "casuya-ai"` or `"source": "offline"`
- [x] Moderation failure does not return `{ flagged: false }` from AI service

### Phase P1 — Wire curriculum loop (~1 day)

| ID | Task | Files |
|---|---|---|
| P1-1 | Boot `CasuyaAI` with `SyllabusAdapter` | `packages/ai/server.ts` |
| P1-2 | Honor `body.curriculum_context` in tutoring + questions | `routes/tutoring.ts`, `routes/questions.ts` |
| P1-3 | Pass `formLevel`, `instructions` to question generator | `routes/questions.ts` |
| P1-4 | Startup probe `/readyz` (+ API key when set) | `startup.py` |
| P1-5 | `GET /ai/status` proxy for frontend/admin | `api/ai.py` |
| P1-6 | Env docs: `CASUYA_PLATFORM_URL` on AI service | `.env.example`, plan |

**Acceptance**

- [x] AI `/readyz` shows `kb_ready` + provider chain
- [x] Tutoring with `subject_slug` + `form_level` uses NECTA template when syllabus available
- [x] Platform `/ai/status` reflects AI reachability

### Phase P2 — Resilience (backlog)

- Circuit breaker on platform bridge (30s open after 3 failures)
- `X-Request-Id` correlation
- Platform pytest with mock AI HTTP server

### Phase P3 — Math cleanup (backlog)

- Remove `/api/math/*` stubs from AI server or implement real engine
- Blackboard uses platform `/api/math/*` only

### Phase P4 — Observability (backlog)

- Structured logs: `{ endpoint, provider, latency_ms, kb_hits, source }`
- Frontend badge from `source` field

---

## 3. Environment variables

| Variable | Service | Purpose |
|---|---|---|
| `CASUYA_AI_URL` | Platform | AI microservice base URL |
| `CASUYA_AI_API_KEY` | Platform + AI | Shared secret (`X-API-Key`) |
| `CASUYA_PLATFORM_URL` | AI | SyllabusAdapter base (e.g. `https://platform.railway.app`) |
| `GROQ_API_KEY`, etc. | AI | Provider failover chain |

---

## 4. Production verification

```bash
# AI readiness (auth required when CASUYA_AI_API_KEY set)
curl -sf -H "X-API-Key: $CASUYA_AI_API_KEY" "$CASUYA_AI_URL/readyz"

# Platform AI status (authenticated)
curl -sf -H "Authorization: Bearer $TOKEN" "$PLATFORM/ai/status"

# Tutoring should return source=casuya-ai when providers configured
curl -X POST "$PLATFORM/ai/tutoring/explain" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Ohm'\''s law?","subject_slug":"physics","form_level":2}'
```

---

## 5. Progress tracker

| Phase | Status |
|---|---|
| P0 — Stop lying | ✅ Done |
| P1 — Curriculum loop | ✅ Done |
| P2 — Resilience | ✅ Done |
| P3 — Math cleanup | ✅ Done |
| P4 — Observability | ✅ Done |
