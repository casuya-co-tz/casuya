# Casuya Platform — Performance Optimization Plan

Target: AI-provider-level speed (sub-100ms TTFB, instant perceived load).

---

## Priority 1: Redis Caching (5-50x faster reads)

Your backend already imports `redis_client` in `database.py`. Wire it into read-heavy endpoints.

### What to cache
| Endpoint | TTL | Pattern |
|----------|-----|---------|
| `GET /lessons/` | 5 min | `lessons:list:{subtopic_id}:{status}` |
| `GET /lessons/{id}` | 10 min | `lesson:{id}` |
| `GET /lessons/{id}/content` | 30 min | `lesson:content:{slug}` |
| `GET /subjects/` | 1 hour | `subjects:list` |
| `GET /topics/` | 30 min | `topics:list:{subject_id}` |
| `GET /subtopics/` | 30 min | `subtopics:list:{topic_id}` |

### Implementation
In `lesson_service.py`, wrap `read_lesson_content`:

```python
def read_lesson_content(slug: str) -> str | None:
    cache_key = f"lesson:content:{slug}"
    cached = redis_client.get(cache_key)
    if cached:
        return cached.decode() if isinstance(cached, bytes) else cached

    # ... existing DB/filesystem read ...
    if html:
        redis_client.setex(cache_key, 1800, html)  # 30 min
    return html
```

Invalidate on `update_lesson`, `create_lesson_from_html`, `delete_lesson`.

---

## Priority 2: Edge Deployment Near Tanzania

Your `vercel.json` is locked to `iad1` (US East). Tanzanian users hit 200-400ms latency.

### Options (best to worst)
1. **Cloudflare Workers** — deploy API at edge, <30ms globally
2. **Vercel Edge Functions** — move lesson/content serving to edge
3. **Multi-region Vercel** — remove `--scope iad1`, let Vercel route to nearest

### Quick fix
Remove `"regions": ["iad1"]` from `vercel.json` and let Vercel auto-route.

---

## Priority 3: Response Compression

Add GZip/Brotli middleware to FastAPI. 60-80% smaller payloads.

```python
# backend/middleware/compression.py
from fastapi.middleware.gzip import GZipMiddleware

def setup_compression(app):
    app.add_middleware(GZipMiddleware, minimum_size=500)
```

Register in `main.py`.

---

## Priority 4: Frontend Loading

Your landing page is lean (vanilla HTML + Tailwind). Keep it this way.

### Immediate wins
- Add `fetchpriority="high"` to above-the-fold hero section
- Add `<link rel="preconnect" href="https://casuya-backend.onrender.com">` in `<head>`
- Lazy load below-fold images with `loading="lazy"`

### Service worker (`sw.js`)
Extend to cache API responses with stale-while-revalidate:

```javascript
// Cache API GETs for offline/repeat visits
if (event.request.method === 'GET' && url.startsWith(API_BASE)) {
  event.respondWith(
    caches.open('api-v1').then(cache =>
      fetch(event.request).then(resp => {
        cache.put(event.request, resp.clone());
        return resp;
      }).catch(() => cache.match(event.request))
    )
  );
}
```

---

## Priority 5: Database Optimization

### Indexes (run once)
```sql
CREATE INDEX IF NOT EXISTS ix_lesson_slug ON lessons(slug);
CREATE INDEX IF NOT EXISTS ix_quiz_lesson_id ON quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS ix_progress_student_lesson ON progress_records(student_id, lesson_id);
CREATE INDEX IF NOT EXISTS ix_bookmark_student ON bookmarks(student_id);
CREATE INDEX IF NOT EXISTS ix_notes_student ON notes(student_id);
```

### N+1 queries
Use `selectin` / `joinedload` in SQLAlchemy for related data:

```python
from sqlalchemy.orm import selectinload

lessons = db.query(Lesson).options(
    selectinload(Lesson.subtopic)
).all()
```

---

## Priority 6: Bundle Size

`main.js` is 6300+ lines. Split into modules:
- `auth.js` — login, token refresh, guard
- `admin.js` — admin dashboard
- `student.js` — student dashboard
- `teacher.js` — teacher dashboard
- `shared.js` — request(), render(), utils

Load only what the user's role needs.

---

## Priority Table

| Priority | Action | Expected Impact | Effort |
|----------|--------|-----------------|--------|
| 1 | Redis caching on read endpoints | 5-50x faster repeated reads | Medium |
| 2 | Edge deployment near Tanzania | 200ms → 30ms latency | Low |
| 3 | Response compression (GZip) | 60-80% smaller payloads | Low |
| 4 | Frontend: preconnect, lazy load, fetchpriority | Instant perceived speed | Low |
| 5 | DB indexes + N+1 fixes | 2-10x faster queries | Low |
| 6 | Split main.js by role | 60-70% less JS per user | Medium |
| 7 | Service worker API caching | Instant repeat visits | Low |
| 8 | Streaming responses (AI endpoints) | Instant perceived speed | High |

---

## Implementation Order

1. **Now** — Redis caching layer on lessons/subjects endpoints
2. **Now** — GZip middleware (5 lines of code)
3. **Now** — Remove `regions: ["iad1"]` from vercel.json
4. **This week** — Add preconnect, lazy load, fetchpriority to HTML
5. **This week** — Run DB index creation SQL
6. **Next sprint** — Split main.js by role
7. **Next sprint** — Service worker API caching
8. **Later** — Edge deployment via Cloudflare Workers

---

## Architecture Overview

```
User (Tanzania)
    │
    ├── CDN/Edge (Cloudflare)
    │   ├── Static assets (HTML, CSS, JS, images)
    │   └── API responses (cached)
    │
    ├── Vercel Edge Functions
    │   └── Lesson content serving
    │
    ├── FastAPI Backend (Render)
    │   ├── Redis cache layer
    │   ├── GZip compression
    │   └── Connection pooling
    │
    └── PostgreSQL (Render/Supabase)
        ├── Read replicas (optional)
        └── Indexes on hot paths
```
