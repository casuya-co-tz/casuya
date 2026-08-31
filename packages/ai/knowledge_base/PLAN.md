# Knowledge Base — Super Speed API Plan (AI API Key Ready)

**Location:** `C:\Users\Admin\Desktop\knowledge_base` → `knowledge_base_api\`  
**Version:** v1.13 → v2.0 API  
**Goal:** <10ms retrieval for any syllabus/exam/chunk via AI API key, RAG-ready for LLM context window.

---

## 1) Current State (v1.13)

- **2,610 JSON** (31 syllabi, 2,398 exams, 70 schemes/lessons) + **258 PDFs** + **28 templates** + **14 marking schemes**
- Flat 2-level FS: `syllabi/o_level|a_level`, `exams/ftna|csee|acsee|internal/form1-6` — **0.22 ms/file**, full scan **0.56s** for 2,610 files
- `index.json` 581KB — lazy load 1.3ms, but must parse + scan for filtered queries
- No chunking, no embeddings, no FTS, no cache, no code PK lookup, no DB

**Bottleneck for AI API:** LLM `chat/completions` needs 3-5 chunks (500 tokens each) in <50ms, but current requires scanning 2,610 files or loading 11MB full.

---

## 2) Target — Super Speed for AI API Key

| Metric | Current | Target |
|---|---|---|
| Single exam by code | 0.22ms × scan | **0.5ms** via `knowledge.db` PK |
| Filtered search (form/subject) | 0.56s scan | **1-3ms** FTS5 + vector |
| RAG 3 chunks | 0.56s + file opens | **<10ms** via `chunks.jsonl` + `embeddings.npy` |
| Full KB load | 11MB / 2,610 files | **15MB `knowledge.db` single file** |
| Index parse | 581KB | **2KB manifest + sharded 25/50KB indexes** |

---

## 3) Optimized Directory (v2.0 API)

```
knowledge_base_api/
├── PLAN.md                          # This plan
├── manifest.json                    # 2KB — AI discovers capabilities
├── index.json                       # 581KB master (backward compat)
├── index/
│   ├── syllabi.json                 # 25 entries — code PK (033 → physics_f1_f4.json)
│   ├── exams.json                   # 2,398 entries — filter: level, form, subject, year, exam_type
│   ├── schemes.json                 # 70 entries
│   ├── lessons.json                 # 70 entries
│   └── chunks.json                  # 8,200 entries — for RAG (chunk_id, subject, form, tokens)
├── db/
│   └── knowledge.db                 # SQLite + FTS5 + vector (15MB, single file, mmap)
│       ├── syllabi (31 rows)        # PK subject_code, FTS topic, units JSON
│       ├── exams (2,398 rows)       # PK (subject, form, year, exam_type), FTS questions, JSON
│       ├── chunks (8,200 rows)      # PK chunk_id, FTS text, tokens
│       └── embeddings (8,200 rows)  # vector(1536) for text-embedding-3-small
├── chunks/                          # RAG-ready, 500 tokens/chunk, JSONL per subject
│   ├── syllabi/o_level/biology_001.jsonl
│   ├── exams/internal/form1/physics_001.jsonl
│   └── exam_formats/031.jsonl
├── embeddings/
│   ├── chunks.npy                   # float32 8200×1536
│   └── chunks.meta.json             # chunk_id → file, offset
├── cache/
│   ├── memory/                      # orjson + gzip, hot 100 files pre-loaded
│   └── redis/                       # optional, for API key result cache (10s TTL)
├── api/
│   └── v1/
│       ├── openapi.json             # OpenAPI 3.0 spec for AI tool calling
│       ├── syllabi/{code}.json      # GET /syllabi/033 → 0.5ms (code PK)
│       ├── exams/{level}/{form}/{subject}/{year}.json
│       ├── search?q=&form=&subject=&code=  # Hybrid FTS + vector, 1-3ms
│       └── chat/completions         # RAG endpoint — injects 3 chunks + system prompt
├── syllabi/                         # Keep flat (already optimal) + by_code symlink
│   ├── o_level/ + by_code/033.json → o_level/physics_f1_f4.json
│   └── a_level/ + by_code/012.json → a_level/mathematics_a_level.json
├── exams/internal/form1-6/          # Keep flat + by_code/031/form1.json
├── exam_formats/templates/          # Keep 14 pilots + marking schemes
├── marking_schemes/                 # 14 files
└── references/                      # 2 files
```

---

## 4) Speed Optimizations

1. **Single-file DB** `knowledge.db` (SQLite + FTS5): `mmap` + `WAL` mode → **0.5ms** random PK vs `0.22ms×N` FS scan; hybrid `FTS5 (keyword) + vector (semantic)` in **1-3ms**; single 15MB file to ship to edge.
2. **Code PK** `by_code/033.json` symlink → `O(1)` direct lookup vs `subject_name` scan; AI calls `GET /syllabi/033` not `search?subject=Physics`.
3. **Sharded indexes** — AI loads only `index/syllabi.json` (25, 8KB) or `index/exams.json` filtered (50KB) not full 581KB.
4. **Chunks 500 tokens** — fits LLM 4k-8k context, pre-split at topic boundaries, `chunks.jsonl` streamed line-by-line.
5. **orjson + gzip + mmap** — `3×` faster than `json.load`; `cache/memory` keeps hot 100 pilot exams in RAM (Physics/Chemistry/Biology F1-F4).
6. **CDN/edge** — `knowledge_base_api/` on Cloudflare R2 `Cache-Control: public, max-age=86400`, `ETag` for `index.json`; API key auth at edge.
7. **API key handling** — `api_keys.json` (key → tier), `rate_limit.json` (100 req/min free, 1000 pro), `X-API-Key` header, `cache/redis` 10s result cache.

---

## 5) API Spec (for AI tool calling)

```yaml
GET /api/v1/syllabi/{code}           # 031 → Physics syllabus JSON
GET /api/v1/exams/{level}/{form}/{subject}/{year}  # ftna/form1/physics/2026
GET /api/v1/search?q=pressure&form=form1&subject=physics  # FTS5 + vector
POST /api/v1/chat/completions        # {messages, form, subject} → RAG 3 chunks injected
Headers: X-API-Key: sk-..., Content-Type: application/json
Rate-Limit: 100/min, Cache: 10s
```

**Example AI tool:**
```json
{"name":"get_syllabus","parameters":{"code":"031"}}
{"name":"search_exams","parameters":{"q":"Archimedes principle","form":"form1"}}
{"name":"get_marking_scheme","parameters":{"code":"033","year":"2025/2026"}}
```

---

## 6) Build Steps (2 min)

```bash
# 1. DB
python build_db.py  # 2,610 JSON → db/knowledge.db (FTS5 + vector)
# 2. Chunks
python chunk.py --tokens 500  # 2,610 → chunks/ 8,200 JSONL
# 3. Embeddings
python embed.py --model text-embedding-3-small  # chunks → embeddings/chunks.npy
# 4. Sharded indexes + by_code symlinks
python build_index.py  # index.json → index/*.json + syllabi/by_code/
# 5. Manifest + OpenAPI
python build_manifest.py  # manifest.json + api/v1/openapi.json
# 6. Cache
python warm_cache.py  # preload hot 100 to cache/memory/
```

**Benchmark target:** `knowledge.db` query `SELECT * FROM exams WHERE code='031' AND form='form1' LIMIT 1` → **<1ms**.

---

## 7) Maintenance

- **Add new NECTA paper:** drop JSON to `exams/csee/` → `python build_db.py --incremental` → auto updates `db/` + `index/` + `chunks/`
- **Versioning:** `index.json v1.13 → v2.0` with `manifest.json` `version` field, `ETag` for clients
- **Backwards compat:** keep `knowledge_base/` flat FS, `knowledge_base_api/` is view, not replacement

---

## 8) Security for AI API Key

- `api_keys.json` not in repo, env `KNOWLEDGE_API_KEYS`
- `X-API-Key` validated at edge (Cloudflare Worker), logged to `logs/api.log`
- No PDF raw in API response (only JSON), PDFs served via signed URL 5min expiry

---

**Next:** Run build steps above to generate `knowledge_base_api/` — ready for AI API key integration.
