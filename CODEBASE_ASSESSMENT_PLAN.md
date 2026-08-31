# Codebase Assessment & Fix Plan

> Generated from full codebase audit on 2026-08-31

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| P0 (Critical) | 3 | Security (2), Performance (1) |
| P1 (High) | 8 | Security (2), Performance (4), API (2) |
| P2 (Medium) | 12 | Security (5), Performance (3), API (3), Code Quality (1) |
| **Total** | **23** | |

---

## Phase 1 — P0 Critical (do first)

### S-01 | Remove hardcoded JWT secret default
- **File:** `apps/platform/backend/config/settings.py:46`
- **Issue:** `jwt_secret` defaults to `"insecure-development-secret-change-me"`. If env var is missing in production, all tokens can be forged.
- **Fix:** Make the field required with no default, or raise at startup when default is used in non-dev environments.
- **Time:** 5 min

### S-02 | Remove hardcoded database password
- **File:** `apps/platform/backend/config/settings.py:42`
- **Issue:** `database_url` default contains real password `Mkalanga1994!`. Committed to version control.
- **Fix:** Replace with placeholder `postgresql://user:password@localhost:5432/casuya_platform`. Require real URL via env var.
- **Time:** 5 min

### P-01 | Make transcode service non-blocking
- **File:** `apps/platform/backend/services/transcode_service.py:45-52,114-119`
- **Issue:** `_has_ffmpeg()` and `transcode_to_hls()` use sync `subprocess.run()`. Blocks event loop for up to 30 min (3 renditions × 10 min timeout).
- **Fix:** Use `asyncio.create_subprocess_exec()` or `asyncio.to_thread()`. Queue work via `BackgroundTasks` or RQ.
- **Time:** 15 min

---

## Phase 2 — P1 High

### S-03 | Remove/gate dev auth bypass
- **File:** `apps/platform/backend/middleware/auth.py:27-28,57-58`
- **Issue:** In dev mode, JWT payloads with `sub` starting with `"dev-"` skip DB verification. If `environment` is misconfigured in production, fabricated tokens bypass auth.
- **Fix:** Remove bypass entirely or gate behind explicit `DEBUG_AUTH_BYPASS=False` flag. Never silently pass on exceptions.
- **Time:** 10 min

### S-04 | Don't silently swallow Redis cache failures
- **File:** `apps/platform/backend/middleware/auth.py:41-42`
- **Issue:** `except Exception: pass` on Redis get. Corrupted Redis value + failed DB query chains to dev bypass.
- **Fix:** Log the exception. Proceed to DB lookup but never fall through to dev bypass.
- **Time:** 5 min

### P-02 | Batch notification inserts
- **File:** `apps/platform/backend/api/notifications.py:39-45,53-58`
- **Issue:** Broadcasting to a role calls `send_notification()` per user — N separate `db.commit()` calls. 10k students = 10k commits.
- **Fix:** Build list of `Notification` objects, `db.add_all()`, single `db.commit()`. Move dispatch to background task.
- **Time:** 10 min

### P-03 | Standardize payment_service DB sessions
- **File:** `apps/platform/backend/services/payment_service.py` (7 functions)
- **Issue:** `_direct_azampay_checkout`, `_apply_local_webhook`, `create_plan`, `list_plans`, `get_plan`, `update_plan`, `delete_plan` all call `next(get_db())` directly, bypassing FastAPI DI.
- **Fix:** Accept `db: Session` parameter, passed from API routes via `Depends(get_db)`.
- **Time:** 20 min

### P-04 | Fix progress.py standalone DB sessions
- **File:** `apps/platform/backend/api/progress.py:30,54,103`
- **Issue:** `_resolve_student_id`, `record_activity`, `get_student_stats` all create standalone sessions via `next(get_db())`.
- **Fix:** Add `db: Session = Depends(get_db)` to route handlers. Pass into `_resolve_student_id()`.
- **Time:** 10 min

### P-05 | Fix note_service standalone session
- **File:** `apps/platform/backend/services/note_service.py:39-40`
- **Issue:** `save_note()` creates its own session. `get_note()` optionally takes `db`.
- **Fix:** Always accept `db: Session` parameter. Follow `bookmark_service.py` pattern.
- **Time:** 5 min

### A-01 | Stop swallowing exceptions in uploads
- **File:** `apps/platform/backend/api/uploads.py:116-117,181-182`
- **Issue:** `_merge_with_db_meta` and `upload_file` catch `Exception` and silently return. DB failures are invisible to operators.
- **Fix:** Add `logger.warning()` calls. At minimum log the error.
- **Time:** 5 min

---

## Phase 3 — P2 Medium

### S-05 | bridge_auth: don't fall through on invalid JWT
- **File:** `apps/platform/backend/middleware/auth.py:78-82`
- **Fix:** If JWT is present, it's the only auth method tried. No shared key fallback.
- **Time:** 5 min

### S-06 | Remove unsafe-inline/eval from CSP
- **File:** `apps/platform/backend/middleware/security_headers.py:26`
- **Fix:** Migrate to nonces/hashes for inline scripts. Audit frontend for `eval()`.
- **Time:** 30 min (hardening step)

### S-07 | Enforce file upload size limit
- **File:** `apps/platform/backend/api/uploads.py:160`
- **Fix:** Check `file.size` before `await file.read()`. Set max (e.g., 50MB).
- **Time:** 5 min

### S-08 | Sanitize path in serve_file
- **File:** `apps/platform/backend/api/uploads.py:223-259`
- **Fix:** Reject filenames containing `/`, `\\`, or `..`. Verify resolved path stays within `storage_root`.
- **Time:** 5 min

### S-09 | Add in-memory rate limiter fallback
- **File:** `apps/platform/backend/middleware/rate_limit.py:74-75`
- **Fix:** Log Redis failure. Fall back to `collections.deque` per IP when Redis is down.
- **Time:** 10 min

### P-06 | Cache _scan_files results
- **File:** `apps/platform/backend/api/uploads.py:76-95`
- **Fix:** Cache filesystem scan with 30s TTL. Or use DB as source of truth.
- **Time:** 10 min

### P-07 | Reuse httpx client in notification SMS
- **File:** `apps/platform/backend/services/notification_service.py:17-33`
- **Fix:** Create module-level `httpx.Client()` or `httpx.AsyncClient` with connection pool.
- **Time:** 5 min

### P-08 | Cache _has_ffmpeg result
- **File:** `apps/platform/backend/services/transcode_service.py:72-75`
- **Fix:** `@functools.lru_cache` on `_has_ffmpeg()`. ffmpeg availability doesn't change at runtime.
- **Time:** 2 min

### A-02 | Fix MIME type for DB-fallback file serving
- **File:** `apps/platform/backend/api/uploads.py:257`
- **Fix:** Store MIME type in `FileRecord`. Detect from extension as fallback.
- **Time:** 5 min

### A-03 | Add logging to payment exception handling
- **File:** `apps/platform/backend/services/payment_service.py:87-102`
- **Fix:** Separate network exceptions from programming bugs. Add `logger.exception()`.
- **Time:** 5 min

### A-04 | Return total count in notification pagination
- **File:** `apps/platform/backend/services/notification_service.py:55-75`
- **Fix:** Return `{"items": [...], "total": total, "offset": offset, "limit": limit}`.
- **Time:** 5 min

### C-01 | Replace bare `except Exception: pass` with logging
- **Files:** `uploads.py:67-68`, `rate_limit.py:74-75`, `auth.py:41-42,51-52`
- **Fix:** Add `logger.warning()` or `logger.exception()` in each location.
- **Time:** 10 min

---

## Execution Order

```
Phase 1 (P0):  ~25 min total
  S-01 → S-02 → P-01

Phase 2 (P1):  ~65 min total
  S-03 → S-04 → P-02 → P-03 → P-04 → P-05 → A-01

Phase 3 (P2):  ~95 min total
  S-05 → S-07 → S-08 → S-09 → P-06 → P-07 → P-08
  → A-02 → A-03 → A-04 → C-01 → S-06 (last, hardening)
```

**Total estimated time: ~3 hours**

---

## Files Modified (planned)

| File | Changes |
|------|---------|
| `config/settings.py` | Remove hardcoded secrets (S-01, S-02) |
| `services/transcode_service.py` | Async subprocess + lru_cache (P-01, P-08) |
| `middleware/auth.py` | Remove dev bypass, log Redis failures (S-03, S-04, S-05) |
| `api/notifications.py` | Batch inserts (P-02) |
| `services/payment_service.py` | Accept `db: Session` param (P-03, A-03) |
| `api/progress.py` | Use FastAPI DI for sessions (P-04) |
| `services/note_service.py` | Accept `db: Session` param (P-05) |
| `api/uploads.py` | Size limit, path sanitization, logging, MIME (S-07, S-08, A-01, A-02, P-06) |
| `middleware/rate_limit.py` | In-memory fallback + logging (S-09, C-01) |
| `services/notification_service.py` | Reuse httpx, return total (P-07, A-04) |
| `middleware/security_headers.py` | CSP nonce migration (S-06) |

---

## Verification

After each phase:
1. `python -m py_compile` on all modified `.py` files
2. Run test suite: `cd apps/platform && python -m pytest tests/ -x`
3. Check for any regressions in auth, payments, notifications
