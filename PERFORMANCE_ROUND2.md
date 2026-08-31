# Performance Round 2 — 10k+ User Bottlenecks

> Generated from deep performance audit focusing on 10k+ concurrent users

## P0 — Will break the system

### 1. Unbounded `SELECT *` on list endpoints
- **Files:** `api/users.py:19`, `api/students.py:70-85`, `api/teachers.py:40-44`, `api/games.py:37-38`
- **Issue:** No pagination — returns all rows into memory
- **Impact:** 10k students = 50-100MB JSON response, OOM on Railway
- **Fix:** Add `offset`/`limit` query params (default 50, max 200)

### 2. Async routes calling sync DB code
- **File:** `api/uploads.py` — `list_files`, `list_files_public`
- **Issue:** `async def` handlers call `_merge_with_db_meta()` which does synchronous DB queries
- **Impact:** Event loop frozen during DB I/O, all concurrent requests stall
- **Fix:** Change to `def` so FastAPI runs in threadpool, or wrap in `asyncio.to_thread`

### 3. Duplicate Redis cache with double-expiry race
- **Files:** `middleware/cache.py`, `services/upload_service.py`
- **Issue:** Two separate expiry mechanisms (Redis TTL + embedded timestamp) can disagree
- **Fix:** Remove embedded timestamp, rely solely on Redis TTL

## P1 — Severe degradation

### 4. Notification SMS sent synchronously in loop
- **File:** `api/notifications.py:39,69`
- **Issue:** 10k students × synchronous SMS = 33 min request, DB held open
- **Fix:** Offload to background job, paginate user query

### 5. RUM summary loads unbounded Redis list
- **File:** `api/metrics.py` — `rum_summary`
- **Issue:** `LRANGE 0 1999` loads 2000 items, no list cap
- **Fix:** Cap list with `LTRIM`, add response cache

### 6. Only 2 gunicorn workers = 6 max DB connections
- **File:** `Dockerfile`
- **Impact:** 5000 requests queued per worker at 10k users
- **Fix:** Set `WEB_CONCURRENCY=4`, increase pool size

### 7. No CORS middleware
- **File:** `main.py`
- **Impact:** All cross-origin API calls from Vercel frontend fail
- **Fix:** Add `CORSMiddleware` with allowed origins

## P2 — Significant inefficiency

### 8. Missing DB indexes on hot paths
- **Tables:** `notifications(user_id,is_read)`, `assignment_submissions(student_id)`, `payments(status)`, `file_records(kind)`
- **Fix:** Add composite + single-column indexes

### 9. New httpx client per request
- **Files:** `services/ai_service.py`, `api/casuya_api_proxy.py`
- **Fix:** Module-level `httpx.AsyncClient` with connection pooling

### 10. bcrypt cost factor 12 = 250ms/hash
- **File:** `services/auth_service.py`
- **Impact:** 2 workers × 250ms = 2 logins/sec = 83 min for 10k
- **Fix:** Reduce to cost 10, increase workers

## P3 — Lower priority

### 11. Service worker precache hardcoded
### 12. CSP nonce generation (acceptable)
### 13. Quiz HTML filesystem fallback

---

## Execution Order

```
P0:  #1 (pagination) → #2 (async fix) → #3 (cache dedup)
P1:  #6 (workers) → #7 (CORS) → #4 (background notifications) → #5 (RUM cap)
P2:  #8 (indexes) → #9 (httpx reuse) → #10 (bcrypt)
P3:  #11 (SW precache) — optional
```
