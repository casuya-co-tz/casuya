# Casuya Performance Optimization Plan — "Giant-Scale" Speed

**Audience:** Tanzanian secondary students on low-end Android devices over 2G/3G.
**Goal:** Make the site and lesson loading feel instant, the way Google/WhatsApp/Facebook do on bad networks.
**Principle:** On 2G/3G, latency and bandwidth dominate. Speed = *send less, cache hard, serve from the edge, never block the UI.*

---

## 1. Relevance — why this matters *here* (not Silicon Valley)

The "giants" optimize for milliseconds; Casuya must optimize for **surviving a 100–400 ms RTT and ~100–500 kbps link**. Relevance of each technique to this product:

| Giant technique | Relevance to Casuya | Why |
|---|---|---|
| Edge CDN + long caching | **Critical** | Origin is one server; every lesson fetch crosses the world on 3G. Serve from nearest PoP. |
| Brotli/Gzip | **Critical** | `main.bundle.js` + lesson HTML are pure text; 20–35% smaller = seconds saved on 2G. |
| Immutable, hash-keyed URLs | **Critical** | Lessons rarely change; cache for 1 year, bust by content hash. No re-validation. |
| Service worker / offline | **Critical** | Product is "offline-first" (bridge engine) — second open must be instant + work offline. |
| Adaptive media (HLS/DASH) | **High** | A 50 MB `.mp4` is unusable on 3G; a 2 MB rendition is fine. |
| Code splitting | **High** | A student must not download teacher/admin code. |
| Server-side filtering/pagination | **High** | Client loads entire subject→topic→subtopic→lesson catalog today. |
| HTTP/2 + keep-alive | **Medium** | Multiplexing removes per-request stalls on high latency. |

---

## 2. Current-state audit (what we actually have)

Findings from the codebase (verified):

- **`docker/nginx/default.conf`** — proxies `/api/` and `/storage/` to the backend with **no gzip/brotli** and **no `Cache-Control`** on either. Only `/` (static HTML) has `max-age=3600`. Result: every lesson content and media request hits origin and is uncompressed.
- **`backend/api/lessons.py:55` `get_lesson_content_route`** — returns `HTMLResponse` with **no cache headers** (relies on the missing nginx config). Already emits `X-Content-Hash`, so content is hash-addressable.
- **`backend/services/lesson_service.py` `read_lesson_content`** — rebuilds KaTeX-injected HTML on **every** request. No precomputed/render cache beyond a 120 s Redis TTL.
- **Redis list cache** exists (`list_lessons`, `topics`, `subjects`) but TTLs are short (120–600 s) and there is no `Cache-Control` on the HTTP response, so clients re-request constantly.
- **Frontend** — static HTML/JS, **no build step**, shipped as one monolithic `main.bundle.js` classic script (shared global scope). No code splitting, no service worker.
- **Media** — served via `/storage/` proxied to backend; **no CDN** in front of it.
- **Student navigation** (`student-dashboard.js`) — loads `/subjects`, `/topics`, `/subtopics`, `/lessons` and filters **client-side**; a tap drills subject→topic→subtopic before any lesson appears.
- **`integrations/cloudflare.py`** exists — Cloudflare is the natural CDN/WAF but is not yet wired to static/media.

---

## 3. Plan (phased, highest leverage first)

### Phase 0 — Quick wins (hours, low risk, biggest perceived gain)
| ID | Change | File(s) | Impact | Effort |
|---|---|---|---|---|
| P0-1 | Add `gzip`/`brotli` + `Cache-Control` to nginx for `/api/`, `/storage/`, static | `docker/nginx/default.conf` | Huge on 2G/3G | Low |
| P0-2 | Set long `Cache-Control: public, max-age=31536000, immutable` on lesson content + purge-on-update (use `X-Content-Hash`) | `backend/api/lessons.py` | Lessons load once, then instant | Low |
| P0-3 | Add `Cache-Control: immutable` (1y) to `/static/lib/katex/*` and bundled JS/CSS | `docker/nginx/default.conf` | KaTeX/JS cached forever | Low |
| P0-4 | Precompress assets (`gz`/`br`) at build and serve precompressed | frontend build + nginx | Avoids on-the-fly compression CPU + speeds first byte | Low |
| P0-5 | Run the existing `npm run minify:js` and ship the minified bundle | `frontend/` | Smaller bundle | Low |

### Phase 1 — Frontend (days)
| ID | Change | File(s) | Impact |
|---|---|---|---|
| P1-1 | Split `main.bundle.js` into role bundles (student/teacher/admin) + lazy-load lesson view + blackboard only when opened | `frontend/assets/js/*` | Student stops downloading teacher/admin code |
| P1-2 | Service worker: cache app shell + visited lessons; offline-first | new `sw.js` + register | Instant second load, works offline |
| P1-3 | Server-side filter lessons by `subtopic_id`/`topic_id` (API already supports params) + **paginate** `list_lessons`; stop loading full catalog client-side | `student-dashboard.js`, `backend/api/lessons.py` | Fewer round-trips on 3G |
| P1-4 | Responsive images (WebP/AVIF) + `loading="lazy"` + blur-up in lessons | lesson renderer | Cuts image bytes |
| P1-5 | Adaptive video (HLS/DASH) instead of raw `.mp4` | uploads + player | 3G-playable video |
| P1-6 | Prefetch next subtopic lesson (low priority) when one is opened | `student-dashboard.js` | "Next" is instant |

### Phase 2 — Backend/API (days)
| ID | Change | File(s) | Impact |
|---|---|---|---|
| P2-1 | Precompute final KaTeX-injected HTML on publish/update; serve cached | `lesson_service.py`, `lessons.py` | Kills per-request rebuild |
| P2-2 | Real server: `nginx` + `uvicorn` workers, **HTTP/2** (or HTTP/3) | `docker/nginx`, deploy | Multiplexing on high latency |
| P2-3 | Aggregate dashboard endpoints (one call instead of `/analytics`+`/lessons`+`/bookmarks`) | new endpoint | Fewer requests |
| P2-4 | `selectinload`/covering queries to remove N+1 in list/overview paths | services | Lower origin latency |
| P2-5 | Purge Redis + CDN cache on lesson/topic/subject update (already invalidates Redis; extend to CDN) | `lesson_service.py`, `cache.py` | Consistency without staleness |

### Phase 3 — Infra (ongoing)
| ID | Change | Impact |
|---|---|---|
| P3-1 | Put static + `/storage/` media on **Cloudflare CDN/R2** (edge caching, WAF) | Global-giant latency |
| P3-2 | DB read replica + verify indexes (already present: `ix_lesson_subtopic_id`, `ix_lesson_status`, …) | Scales reads |
| P3-3 | Real-User-Monitoring from Tanzania (measure *their* 3G, not localhost) | Data-driven tuning |

---

## 4. What the giants do that we will copy (checklist)

- [ ] Immutable, hash-keyed URLs; cache bust by filename, not query string
- [ ] `stale-while-revalidate` (serve cache instantly, refresh in background)
- [ ] Stream/adapt media to the connection (HLS/DASH, responsive images)
- [ ] App shell + service worker (instant second load + offline)
- [ ] Ship the *minimum* JS for the current screen (code splitting)
- [ ] Compress everything (Brotli) and serve precompressed
- [ ] Serve from the edge (CDN), not the origin

---

## 5. Suggested execution order

1. **P0-1 → P0-3 → P0-4** (nginx compression + caching) — deploy same day, immediately felt on 2G/3G.
2. **P1-2** service worker — biggest UX jump (offline + instant repeat).
3. **P0-2 / P2-1** lesson-content caching + precompute — makes every lesson load once.
4. **P3-1** Cloudflare for static + media.
5. **P1-1 / P1-3** code splitting + server-side filtering — trims the payload students actually download.
6. **P1-4 / P1-5** media optimization — needed before video/image-heavy lessons are usable on 3G.

---

## 6. Success metrics (how we know it worked)

- First Contentful Paint (student dashboard) < 2 s on emulated 3G.
- Lesson content repeat view: **0 origin requests** (served from CDN/SW cache).
- Homepage/JS transfer on 3G reduced by ≥ 50% after splitting + Brotli.
- Video start time on 3G < 3 s (adaptive rendition).
- Offline: previously opened lessons open with no network.

---

*Scope note:* This plan targets the platform (`apps/platform`). The packages (`bridge`, `blackboard`, `runtime`, …) have their own loading concerns; call out if you want a per-package breakdown.
