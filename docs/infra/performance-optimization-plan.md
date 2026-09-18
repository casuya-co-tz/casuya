# Casuya — Web Performance Optimization Plan

**Author:** Engineering review (2026-09-18)
**Status:** Weeks 1–4 implemented in this repo
**Audience:** Tanzanian secondary schools on low-end Android and 2G/3G
**Related:** [`services-improvement-plan.md`](./services-improvement-plan.md)

This plan is the checklist for making the platform **fast and correct**. Speed
without working lessons, quizzes, video, or blackboard is a failed deploy.

`apps/platform/frontend/build-js.mjs` previously pointed at a missing
`PERFORMANCE_OPTIMIZATION_PLAN.md`. This file is that plan.

---

## 0. Executive summary

### What already works

| Area | Notes |
|---|---|
| Role-split JS bundles | Student first paint **30.8 KB gzip**; extras + speech on demand |
| Terser minify + `.js.gz` sidecars | Served by `PrecompressedStaticFiles` |
| Conservative service worker | Stale-while-revalidate for static assets |
| Lazy KaTeX | ~265 KB not paid until math renders |
| Aggregated lesson package | `GET /lessons/{id}/package` (was 5+ calls) |
| Redis lesson-content cache | 24h, invalidated on edit |
| RUM | FCP / TTFB / `effectiveType` → `/metrics/rum` |

### Gaps that block “superfast and working”

| ID | Issue | Severity | Week |
|---|---|---|---|
| P-01 | Student iframe skips `injectBridgeScript` — quiz/video/HLS never reports | 🔴 | 1 |
| P-02 | `vendor-blackboard.min.js` missing — blackboard fails to load | 🔴 | 1 |
| P-03 | Self-hosted font file missing — preload 404 on every portal page | 🔴 | 1 |
| P-04 | SW caches `/api/lessons/.../content`; real route is `/lessons/.../content` | 🔴 | 1 |
| P-05 | `api-cache.js` is dead code — dashboard duplicate GETs | 🟡 | 1 |
| P-06 | `hls.min.js` missing — HLS video broken on Chrome Android | 🔴 | 1 |
| P-07 | Student portal always loads `env.js` + `config.js` + bundle (duplicates) | 🟡 | 1 |
| P-08 | `blackboard-embed.js` loaded on every student page | 🟡 | 1 |
| P-09 | Student viewer ignores in-memory lesson content cache | 🟡 | 1 |
| P-10 | Progress sync fires on every iframe event, including `student_id: null` | 🟡 | 1 |
| P-11 | TTS prefetch of full lesson + quiz on open (2G spike) | 🟡 | 1 |
| P-12 | Monolithic student bundle (~334 KB raw) loaded before first paint | Done 30.8 KB gzip | 2 |
| P-13 | Three CSS files, no `.css.gz` sidecars | Done portal bundles | 2 |
| P-14 | Landing `index.html` has ~76 KB inline CSS + Google Fonts | CSS extracted; fonts self-hosted | 2 |
| P-15 | No content-hashed bundle filenames with `immutable` cache | Done `?v=` query hashes | 3 |
| P-16 | Dashboard waterfall (subjects + me + classroom + progress + stats) | Done one payload | 3 |
| P-17 | Cross-origin API (Vercel → Railway) bypasses SW lesson cache | Done IndexedDB | 3 |
| P-18 | `packages/bridge` + `packages/runtime` exist but are not the web player | Done games sandbox | 4 |

---

## 1. Target outcomes

After Weeks 1–3:

- Lessons, quizzes, HLS video, and blackboard **function** on Chrome Android.
- First student-portal paint is **under ~40 KB gzip** of JS (from ~81 KB).
- Repeat lesson opens are instant (memory + SW / IndexedDB).
- Progress sync is reliable (debounced, never `student_id: null`).
- Fonts and vendor files 200 instead of 404.

---

## 2. Week 1 — Correctness + wasted bytes

**Implemented (2026-09-18):** P-01 through P-11 in the platform frontend.

| ID | Status |
|---|---|
| P-01 Student lesson bridge | Done — `injectBridgeScript` in `student/lessons/iframe.js` |
| P-02 Blackboard vendor | Done — `vendor-blackboard.min.js` (~113 KB / 29 KB gzip) + `minify:vendor` in `build` |
| P-03 Font file | Done — `assets/fonts/plus-jakarta-sans-latin.woff2` (~27 KB) |
| P-04 Service worker lesson path | Done — matches `/lessons/{id}/content`; cache `v9` |
| P-05 Wire `api-cache.js` | Done — 30s GET cache + in-flight dedupe; cleared on logout |
| P-06 Vendor `hls.min.js` | Done — `frontend/static/lib/hls.min.js` (lazy-loaded) |
| P-07 Duplicate portal scripts | Done — portals load role bundle only |
| P-08 Lazy blackboard embed | Done — injected when a lesson with `[data-blackboard]` opens |
| P-09 Student lesson content cache | Done — viewer + next-lesson prefetch |
| P-10 Debounce progress sync | Done — 2s debounce; skip null `student_id` |
| P-11 Defer TTS prefetch | Done — `requestIdleCallback` (6s timeout) |

Fix broken loaders first. Then stop downloading the same bytes twice.

### P-01 Student lesson bridge

`modules/student/lessons/iframe.js` must inject `LESSON_BRIDGE_SCRIPT` the same
way `modules/lesson/lesson-viewer/viewer.js` already does:

```
html = injectBridgeScript(html);
iframe.srcdoc = injectNodeBase(html);
```

Without this, `casuya-quiz` / `casuya-progress` / HLS upgrade never run in the
primary student path.

### P-02 Blackboard vendor

- Run `npm run minify:vendor` → `assets/js/vendor-blackboard.min.js`
- Add `minify:vendor` to `apps/platform/frontend` `build` so CI/Vercel cannot
  ship a loader that 404s

### P-03 Font file

Ship `assets/fonts/plus-jakarta-sans-latin.woff2` (latin variable, ~27 KB) to
match `@font-face` in `assets/css/variables.css`. Keep `font-display: swap`.

### P-04 Service worker lesson path

In `sw.js`:

- Match `/lessons/{id}/content` **and** legacy `/api/lessons/{id}/content`
- Bump `CACHE_VERSION` so old caches drop

Cross-origin API traffic still cannot be intercepted (Vercel frontend, Railway
API). That is Week 3 (IndexedDB). Same-origin Docker/nginx deploys start
working immediately.

### P-05 Wire `api-cache.js`

- 30s TTL for cacheable GETs
- In-flight promise dedupe (dashboard double-fetch)
- Never cache `POST` / auth / progress / notifications / AI
- Honor `options.skipCache`

### P-06 Vendor `hls.min.js`

Place `frontend/static/lib/hls.min.js` (hls.js) so the lesson bridge lazy-load
path works on non-Safari Android.

### P-07 Duplicate portal scripts

Student / teacher / admin bundles already concatenate `env.js` + `config.js`.
Remove the extra `<script>` tags from portal HTML. Keep them on login /
landing (no role bundle).

### P-08 Lazy blackboard embed

Do not load `blackboard-embed.js` on every student page. Inject it when a
lesson with `[data-blackboard]` is opened.

### P-09 Student lesson content cache

Reuse `getCachedLessonContent` / `cacheLessonContent` (already in core) in
`modules/student/lessons/viewer.js` and populate it from `prefetchNextLesson`.

### P-10 Debounce progress sync

In the student iframe handler: skip `student_id` null; debounce
`casuya-progress` (~2s); still send quiz scores immediately.

### P-11 Defer TTS prefetch

Do not compete with lesson HTML parse. Prefetch via `requestIdleCallback`
(timeout ~6s) instead of immediately on open.

**Done when:** opening a seeded lesson shows iframe content, quiz scores POST
to `/progress/sync`, blackboard mounts, font returns 200, no duplicate
`env.js` on portal pages.

---

## 3. Week 2 — First-paint download

**Implemented (2026-09-18):** P-12, P-13, P-14 (CSS extract + self-hosted fonts), core slim, CI frontend build.

| ID | Status | Result |
|---|---|---|
| P-12 Student route split | Done | `student.bundle.js` **30.8 KB gzip** (was ~81 KB). Games/exams/library/payments/files/downloads/test-generator live in `student.extras.bundle.js` (12.3 KB gzip), loaded on first visit to those views and idle-prefetched. Speech is `speech.bundle.js` (8.1 KB gzip), loaded on Listen/Record or idle. |
| P-13 Portal CSS | Done | One `student.bundle.css` / teacher / admin file + `.css.gz` (student CSS **12.9 KB gzip**) |
| P-14 Landing CSS | Done | Inline CSS moved to cacheable `landing.css`. Self-hosted latin Manrope (24 KB) + Fraunces (67 KB) woff2; no Google Fonts. |
| Slim `core[]` | Done | Landing i18n, `site-features.js`, `auth-ui.js`, speech, and the teacher lesson-viewer are no longer in the student first-paint bundle |
| CI frontend build | Done | `.github/workflows/ci.yml` runs `apps/platform/frontend` `npm run build` |

Target was **under ~40 KB gzip** of JS for first paint. Met: **30.8 KB**.

---

## 4. Week 3 — Repeat visits + API shape

**Implemented (2026-09-18):** P-15 query hashes, P-16 dashboard aggregate, P-17 IndexedDB lesson HTML, progress paging, blackboard snapshots, `COUNT(*)` lesson limits.

| ID | Status | Result |
|---|---|---|
| P-15 Asset rev | Done | Portal HTML gets `?v=<sha256-10>` on JS/CSS (keeps `.gz` siblings). `window.CASUYA_ASSETS` + `casuyaAssetUrl()` cover extras, speech, blackboard vendor. |
| P-16 Dashboard API | Done | `GET /students/me/dashboard` — profile, classroom, subjects, `progress_by_subject`, stats in one round-trip. Overview uses that payload. |
| P-17 Lesson IndexedDB | Done | `casuya-lessons` IDB store (30 lessons, 1.5 MB cap) behind memory cache. Cross-origin Railway HTML survives reload. |
| Progress paging | Done | `GET /progress/{id}` returns `{items,total,offset,limit}` (default 200). Clients accept array or envelope. |
| Blackboard snapshots | Done | `/progress/sync` stores last 80 elements (200 KB cap). Mount restores via `importJSON` **before** the change listener. |
| Teacher lesson limits | Done | `count_lessons()` `COUNT(*)` instead of `len(list_lessons())`. |

---

## 5. Week 4 — Architecture

**Implemented (2026-09-18):** runtime sandbox for student games and lessons, bridge manifests, 2G `essential=1`, streamed gzip lesson HTML, precompressed `/static/lib` + `/static/lessons`, origin cache headers on uploads.

Post-Week-4 leftovers (same day): landing Google Fonts replaced with self-hosted woff2; teacher/admin lesson viewer uses `loadLessonHtml` (IndexedDB + `?essential=1`); service worker `casuya-static-v11` precaches landing fonts; `CasuyaBridge.renderLesson()` mounts a cached `{body_html}` package in a sandboxed iframe (or shadow DOM).

Offline + edge: Downloads pin HTML in IndexedDB; admin preview uses `loadLessonHtml`; teacher overview uses `GET /teachers/me/dashboard`; Cloudflare caches `/lessons/{id}/content`; CSP drops Google Fonts; Vercel caches `/static/`; `PUBLIC_ASSETS_BASE` 302s uploads and rewrites `/uploads/` in lesson/game/quiz HTML; game HTML is cached in IndexedDB.

| ID | Status | Result |
|---|---|---|
| P-18 Student games + lessons runtime | Done | Games and lessons mount `CasuyaRuntime` (sandboxed iframe). Missing IIFE or load error falls back to srcdoc. Runtime IIFE copied to `frontend/static/pkg/runtime/`. Lesson HTML still gets `injectBridgeScript` before load (quiz/HLS/progress). |
| Manifests + slug package | Done | `GET /lessons/manifests` → `[{slug,content_hash,title,id}]`. `GET /lessons/{slug}/package` → `{body_html}` for bridge; UUID still returns student metadata. |
| 2G `essential=1` | Done | Strips `<video>`/`<audio>`/YouTube iframes. Student `loadLessonHtml` appends `?essential=1` on `slow-2g`/`2g`. |
| Stream gzip HTML | Done | Processed lesson HTML writes `{slug}.html.gz`. Content route streams `FileResponse` with `Content-Encoding: gzip`. Compression middleware no longer buffers already-encoded or binary responses. |
| Precompressed static | Done | `/static/lib` points at `frontend/static/lib` (KaTeX/hls). `/static/lessons` uses `PrecompressedStaticFiles`. Build gzips `.js`/`.css` under `static/lib`. |
| Uploads cache | Done | `GET /uploads/{file}` sends `Cache-Control: public, max-age=31536000, immutable`. Cloudflare rules cache `/uploads/`. Set `PUBLIC_ASSETS_BASE` to 302 media onto R2/CDN and rewrite `/uploads/` in served HTML. |
| Downloads IDB | Done | Student Downloads pin HTML in IndexedDB (migrate off localStorage blobs). LRU never evicts pinned rows. |
| Edge lesson path | Done | Cloudflare caches `/lessons/{id}/content` (not only `/api/v1/...`). Vercel caches `/static/`. CSP `font-src 'self' data`. |
| Teacher dashboard | Done | `GET /teachers/me/dashboard` — overview, lesson_count, classroom total/code, bookmark_count. No roster stats on first paint. |
| Game HTML cache | Done | `loadGameHtml` uses the same IndexedDB store (`g:{id}`). Student/teacher/admin game viewers share it. |

---

## 6. Non-goals

- Rewriting the static HTML frontend as a Vite/React SPA
- Changing the FastAPI ↔ Vercel split in this sprint
- Minifying more without fixing 404s and the student bridge

---

## 7. Verification

| Check | How |
|---|---|
| Font 200 | DevTools network on `/student/` (Plus Jakarta) and `/` (Manrope + Fraunces); no `fonts.googleapis.com` |
| Blackboard mounts | Open a lesson; `[data-blackboard]` canvas appears |
| Quiz progress | Answer a quiz; `/progress/sync` fires with a real `student_id` |
| HLS | Chrome + `.m3u8` lesson; `hls.min.js` loads once |
| Duplicate scripts gone | Portal HTML has one bundle, not `env.js` + `config.js` + bundle |
| Cache hits | Two dashboard loads within 30s; second `/students/me/dashboard` is cached |
| 2G feel | Chrome DevTools: Slow 3G; first paint before games/exams JS |
| Dashboard one call | Student overview issues `GET /students/me/dashboard`, not five GETs |
| Repeat lesson | Second open of the same lesson uses memory/IndexedDB HTML |
| Offline download | Downloads view pins HTML in IndexedDB; viewer opens it without localStorage |
| Student game sandbox | Open a game; network loads `casuya-runtime.min.js` once, or srcdoc fallback |
| Manifests | `GET /lessons/manifests` is an array of `{slug, content_hash}` |
| 2G essential | `GET /lessons/{slug}/package?essential=1` has no `<video>` |
| CDN uploads | With `PUBLIC_ASSETS_BASE=https://cdn.example`, `GET /uploads/a.png` is 302 and lesson HTML `src="/uploads/..."` points at the CDN |
| Teacher dashboard | Teacher overview issues `GET /teachers/me/dashboard`, not four GETs |

---

## 8. Key files

| Concern | Path |
|---|---|
| Bundle builder | `apps/platform/frontend/build-js.mjs` |
| Service worker | `apps/platform/frontend/sw.js` |
| Student iframe | `apps/platform/frontend/assets/js/modules/student/lessons/iframe.js` |
| Student viewer | `apps/platform/frontend/assets/js/modules/student/lessons/viewer.js` |
| Request cache | `apps/platform/frontend/assets/js/modules/api-cache.js` |
| Fetch | `apps/platform/frontend/assets/js/modules/api-client/core/fetch.js` |
| Blackboard embed | `apps/platform/frontend/assets/js/blackboard-embed.js` |
| Lesson IndexedDB | `apps/platform/frontend/assets/js/modules/lesson/lesson-idb.js` |
| Student dashboard API | `apps/platform/backend/services/student_dashboard.py` |
| Gzip static | `apps/platform/backend/middleware/static_precompressed.py` |
| Lesson runtime | `apps/platform/frontend/assets/js/modules/student/game-runtime.js` |
| Landing fonts | `apps/platform/frontend/assets/fonts/` |
| Teacher dashboard API | `apps/platform/backend/services/teacher_dashboard.py` |
