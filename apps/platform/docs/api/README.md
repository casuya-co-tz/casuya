# API Documentation

Endpoint documentation for the Casuya platform backend.

## Structure

- `api/` — HTTP routers (FastAPI)
- `api/lessons.py` — Lesson CRUD endpoints
- `api/auth.py` — Authentication endpoints (register, login, refresh)
- `api/students.py` — Student management
- `api/teachers.py` — Teacher management
- `api/analytics.py` — Analytics endpoints
- `api/search.py` — Search endpoints

## Conventions

- All endpoints return JSON
- Authentication required via JWT Bearer token
- Request validation via Pydantic models
- Routers call services, never integrations directly

## Health Check

```text
GET /health
```
