# casuya-platform

Student, admin, and teacher web platform for Casuya (`casuya.co.tz`) focused on lesson delivery, quizzes, games, progress tracking, and analytics for schools operating on unreliable and low-bandwidth internet connections.

---

## Vision

Casuya is designed for Tanzanian secondary education and prioritizes:

* Low-end Android devices
* 2G and 3G networks
* Offline-first experiences
* High scalability
* Modular and replaceable components
* Fast lesson delivery
* Low operational costs

Speed is a product feature, not merely an optimization.

---

# Architecture Overview

```text
Admin
│
├── Create Subject
├── Create Topic
├── Create Subtopic
└── Paste Complete HTML Lesson
        │
        ▼
casuya-platform
        │
        ▼
casuya-core
        │
        ├── Validate
        ├── Compress
        ├── Package
        └── Sign
        │
        ▼
Supabase Storage
        │
        ▼
Student
        │
        ▼
casuya-runtime
        │
        ├── Load
        ├── Render
        └── Execute
        │
        ▼
casuya-bridge
        │
        ├── Cache
        ├── Queue
        ├── Synchronize
        └── Restore Progress
        │
        ▼
Supabase PostgreSQL
```

---

# Project Structure

```text
casuya-platform/
│
├── backend/
├── frontend/
├── database/
├── storage/
├── integrations/
├── docs/
├── tests/
├── scripts/
├── docker/
└── infrastructure/
```

---

# Backend

FastAPI application implementing:

```text
backend/
├── main.py
├── config/
├── api/
├── services/
├── middleware/
├── models/
└── tasks/
```

### Responsibilities

#### api/

* HTTP routers
* Request validation
* Response serialization
* Authentication guards

#### services/

* Business logic
* Database transactions
* Integration orchestration
* Domain rules

#### models/

* SQLAlchemy entities
* Relationships
* Constraints

#### middleware/

* Authentication
* Permissions
* Rate limiting
* Error handling
* Request logging

#### tasks/

* Background jobs
* Scheduled work
* Cleanup processes
* Notification delivery

---

# Router Rules

Routers must:

* Validate requests
* Call services
* Return responses

Routers must never:

* Execute business logic
* Query external services directly
* Call integrations directly
* Manipulate storage directly

Flow:

```text
Router
    ↓
Service
    ↓
Integration
    ↓
Database / Storage / External Service
```

---

# Frontend

```text
frontend/
├── admin/
├── student/
├── teacher/
├── shared/
└── assets/
```

### Admin Portal

Features:

* Subject management
* Topic management
* Subtopic management
* Lesson management
* HTML lesson upload
* Lesson preview
* Publishing workflow
* User management
* Analytics dashboard
* Payment management

### Student Portal

Features:

* Lesson viewing
* Quizzes
* Games
* Progress tracking
* Offline support
* Session recovery
* Downloads

### Teacher Portal

Features:

* Student reports
* Assignment management
* Analytics
* Performance dashboards

### Shared

Contains:

* Components
* Layouts
* Utilities
* Hooks
* Services

---

# Database

Contains:

* Migrations
* Seed data
* Schema notes
* Backups

Primary entities:

* Users
* Roles
* Students
* Teachers
* Subjects
* Topics
* Subtopics
* Lessons
* Lesson Versions
* Quizzes
* Games
* Progress
* Analytics
* Payments
* Notifications
* Settings
* Audit Logs

---

# Storage

Stores large files outside the database.

```text
storage/
├── lesson-packages/
├── images/
├── videos/
├── audio/
├── exports/
└── backups/
```

Database rows should store metadata and package references only.

Large HTML lessons should never be stored directly in database rows.

---

# Integrations

```text
integrations/
├── casuya_core
├── casuya_runtime
├── casuya_bridge
├── supabase
├── cloudflare
├── azampay
└── africastalking
```

Integrations may only be called from:

```text
backend/services/*
```

Never from routers.

---

# Local Development

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Run commands from the project root:

```bash
cd casuya-platform
```

Health endpoint:

```text
http://localhost:8000/health
```

---

# Current Status

Implemented:

* Project structure
* Configuration layer
* SQLAlchemy models
* Database relationships
* Main application wiring
* Router registration
* Development scaffolding

Stubbed:

* API routes
* Services
* Middleware
* External integrations

Recommended implementation order:

1. Authentication
2. Subjects
3. Topics
4. Subtopics
5. Lessons
6. casuya-core packaging flow
7. Progress tracking
8. Analytics
9. Notifications
10. Payments

---

# Developer Principles

1. Performance first.
2. Offline first.
3. Package lessons instead of storing large HTML blobs.
4. Keep business logic inside services.
5. Keep integrations isolated.
6. Prefer caching over repeated queries.
7. Everything should be modular and replaceable.
8. Never break existing lesson packages.
9. Optimize for low-end Android devices first.
10. Maintain backward compatibility whenever possible.
11. Avoid unnecessary dependencies.
12. Design for 100,000+ concurrent students.

---

---

# Architectural Contract

This section is frozen. Future changes should implement functionality
while preserving these boundaries unless there is a compelling reason to
revise the architecture itself.

## `backend/api`

Responsibilities:

* HTTP endpoints
* Request validation
* Response serialization
* Authentication guards

Must not:

* Call integrations directly
* Implement business logic
* Access storage directly

## `backend/services`

Responsibilities:

* Business rules
* Transactions
* Orchestration
* Integration coordination

May call:

* Models
* Tasks
* Integrations
* Storage

## `backend/models`

Responsibilities:

* SQLAlchemy entities
* Relationships
* Constraints
* Query helpers

Must not:

* Call integrations
* Contain application workflows

## `backend/tasks`

Responsibilities:

* Background jobs
* Scheduled tasks
* Cleanup
* Notifications
* Analytics aggregation

## `integrations/`

Responsibilities:

* Adapters only
* External systems only
* No business logic

Examples:

```text
integrations/
├── casuya_core.py
├── casuya_runtime.py
├── casuya_bridge.py
├── supabase.py
├── cloudflare.py
├── azampay.py
└── africastalking.py
```

## Dependency Rules

```text
api
    ↓
services
    ↓
models
```

```text
services
    ↓
integrations
```

```text
tasks
    ↓
services
    ↓
integrations
```

Forbidden:

```text
api → integrations
models → integrations
models → services
integrations → api
integrations → services
```

## Example Flow — Publish Lesson

```text
Admin
    ↓
POST /lessons
    ↓
api/lessons.py
    ↓
lesson_service.py
    ↓
casuya_core.py
    ↓
Supabase Storage
    ↓
SQLAlchemy Models
    ↓
Response
```

## Example Flow — Student Opens Lesson

```text
Student
    ↓
GET /lessons/{id}
    ↓
api/lessons.py
    ↓
lesson_service.py
    ↓
Lesson Model
    ↓
Return package URL
    ↓
casuya-runtime
    ↓
casuya-bridge
```

## Repository Boundaries

`casuya-platform` owns:

* Users
* Subjects
* Topics
* Subtopics
* Lessons
* Quizzes
* Games
* Progress
* Payments
* Analytics
* Notifications
* APIs
* Dashboards

`casuya-platform` consumes, but does not implement the internals of:

```text
casuya-core
casuya-runtime
casuya-bridge
Supabase
Cloudflare
AzamPay
Africa's Talking
```

# Related Packages

## casuya-core

Python package responsible for:

* Validation
* Minification
* Packaging
* Signing
* Metadata generation

## casuya-runtime

JavaScript runtime responsible for:

* Loading lesson packages
* Rendering lessons
* Executing lessons
* Session restoration

## casuya-bridge

JavaScript synchronization engine responsible for:

* Offline queues
* Progress tracking
* Caching
* Batch synchronization
* Network recovery
* Analytics collection

---

## Security & Operations

### Middleware pipeline (applied in order)

1. **CORS** — explicit allowed origins, methods (GET/POST/PUT/PATCH/DELETE), headers (Authorization, Content-Type, X-CSRF-Token)
2. **Rate Limiting** — Redis-backed, per-endpoint limits (auth: 5-10/min, payments: 10-30/min), graceful degradation if Redis unavailable
3. **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
4. **Error Handling** — structured JSON error responses

### Authentication

- bcrypt password hashing (cost factor 12)
- Short-lived JWT access tokens (15 min default) + refresh tokens (7 day expiry)
- Token type claim (`access` vs `refresh`) enforced in `decode_access_token`
- Optional `role` claim in access token for permission checks

### Background Jobs

- Redis Queue (RQ) for async processing (default/high/low priority queues)
- Payment checkout and SMS notification handled asynchronously
- Job idempotency via `idempotency_key` on Payment model

### Payments

- Sandbox toggle via `AZAMPAY_SANDBOX=true` — skips real checkout, returns mock response
- Idempotency keys prevent duplicate charges
- Webhook handler is idempotent (skips processing if already `success`)

### Error Tracking

- Sentry integration via `SENTRY_DSN` environment variable
- Traces sampled at 0.2 in production, 1.0 in development
- Integrations: FastAPI, SQLAlchemy, Redis

---

## CI/CD Pipeline

The `.github/workflows/tests.yml` workflow runs on every push and PR:

1. **secret-scan** — `detect-secrets` scans all files for credentials
2. **lint** — `ruff check` + `ruff format --check`
3. **backend-tests** — pytest with Postgres + Redis service containers, includes migration test via Alembic

Dependabot is configured for pip, Docker, GitHub Actions, and npm weekly updates.
