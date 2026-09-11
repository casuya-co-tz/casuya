# System Evaluation — Restrict Platform to Mathematics, Chemistry & Physics Only

**Status:** DRAFT for review
**Date:** 2026-09-10
**Change under evaluation:** The website must shift from all subjects to only **3 subjects: Mathematics, Chemistry, Physics**. All other subjects (Biology, English, Kiswahili, History, Geography, Civics/Historia, Business Studies, Bible Knowledge, Computing/ICT, Agriculture, Bookkeeping, Economics, etc.) must be removed from **all frontend writing, text, and database**.

---

## Executive summary

The subject set is **database-driven**, not a hardcoded whitelist. There is **no `ALLOWED_SUBJECTS`/`VALID_SUBJECTS` list** in the backend — the backend accepts whatever slug the DB contains. This means the change is mostly a **data + frontend array + AI knowledge-base trimming exercise**, plus targeted test updates. The core compiler (`libs/core`) and the exam-paper local generation are subject-agnostic and **do not need changes**.

Roughly **6 categories** of work, in dependency order:

1. Database seeds (canonical syllabi, reference schemes, dev data)
2. Backend TIE dataset + search/subject mappings
3. Database `subjects` table purge (deployment step)
4. Frontend subject arrays + `<select>` lists + landing/footer copy
5. AI knowledge base + AI subject constants/frameworks
6. Tests + docs

---

## 1. Database seeds — canonical syllabi (apps/platform/database/seeds)

### 1a. `data/*.json` syllabus files — REMOVE non-kept

`seed_necta_syllabus.py:36-48` globs **every** `data/*.json`. Kept:
- `mathematics.json` (Basic Mathematics)
- `chemistry.json`
- `physics.json`

Remove (12 files): `biology.json`, `english.json`, `kiswahili.json`, `geography.json`, `history.json`, `civics.json`, `business-studies.json`, `bible_knowledge.json`, `economics.json`, `historia-ya-tanzania-na-maadili.json`, `advanced-mathematics.json`, `basic-applied-mathematics.json`.

### 1b. `data/reference/*.json` — bundled reference schemes

Kept (8 committed files):
- `mathematics_form_one(_scheme).json`, `mathematics_form_two(_scheme).json`
- `chemistry_form_one(_scheme).json`, `chemistry_form_two(_scheme).json`
- `physics_form_one(_scheme|_scheme_term2|term2).json`, `physics_form_two(_scheme|_scheme_term2|term2).json`

Remove (~22 files, 8 subjects incl. source markdown):
`biology_form_one(_scheme)`, `biology_form_two(_scheme)`, `english_form_one(_scheme)` + `english_form_one_source.md`, `english_form_two(_scheme)`, `kiswahili_form_one/two(_scheme)`, `history_form_one/two(_scheme)`, `geography_form_one/two(_scheme)`, `historia_tanzania_maadili_form_one/two(_scheme)`, `bible_knowledge_form_one(_scheme)`, `business_studies_form_one/two(_scheme)` + `business_studies_form_one_source.md`.

> Note: `english_form_one_source.md` and `business_studies_form_one_source.md` are the raw source documents — delete them too.

### 1c. Seed orchestrators

- `seed_necta_syllabus.py:11-17` — docstring lists "Biology / English Language / Kiswahili" sources; tidy.
- `seed_admin_math.py:26,44-46` — imports all `NECTA_SYLLABUS`; automatically scoped once 1a is trimmed.
- `seed_dev_data/data.py:3-10` — `subjects_data` lists Mathematics, Chemistry, Physics **+ Biology, English, Kiswahili**. Remove the 3 non-kept entries. **Also remove their topics/subtopics rows elsewhere in the same file** (lines 39-45 biology, 46-55 english, 57-64 kiswahili, and matching subtopics at lines 123-148, 171-192).
- `seeds/extract_subjects.py` — regeneration helper; review only (used to rebuild per-subject JSON).

---

## 2. Backend TIE dataset + subject mapping (apps/platform/backend)

### 2a. `data/tie_syllabus.py:33-59`

`SUBJECT_SLUG_FILES` (15 entries) — keep only `mathematics`, `additional_mathematics`, `chemistry`, `physics`.
Remove: `english`, `kiswahili`, `history`, `historia_ya_tanzania_na_maadili`→`history_civics.json`, `geography`, `biology`, `computer_science`, `business_studies`, `bookkeeping`, `agriculture`, `bible_knowledge`.

Also decide: `ALIASES` (`civics`, `moral_education`, `history_civics` → `historia_ya_tanzania_na_maadili`) — harmless if target file is gone, but the alias target would 404; prune aliases pointing at removed subjects.

### 2b. `data/tie_syllabus/*.json`

Remove non-kept files:
`english.json`, `kiswahili.json`, `history.json`, `history_civics.json`, `geography.json`, `biology.json`, `computer_science.json`, `business_studies.json`, `bookkeeping.json`, `agriculture.json`, `bible_knowledge.json`
Keep: `mathematics.json`, `additional_mathematics.json`, `chemistry.json`, `physics.json`

> `tie_competences/` only contains `mathematics_form1-4` — no change.

### 2c. `services/reference_library/search.py:13-31`

`_SUBJECT_RULES` regex map — prune entries targeting removed subjects:
- Keep: `advanced/additional mathematics`, `basic mathematics/mathematics/hisabati`, `chemistry|kemia`, `physics|fizikia`
- Remove: bookkeeping/accountancy (:16), business studies (:17), computer science (:18), bible knowledge (:19), agriculture (:20), biology (:21), geography (:22→:24), historia-yatz (:25), civics/uraia (:26), history (:27-28), english (:29), kiswahili (:30)

Alternative (safer during transition): leave the map intact but let ended subjects simply return no docs. Recommend pruning for cleanliness + memory.

### 2d. `services/teacher_plans/constants/misc.py:8-16`

`KISWAHILI_SUBJECTS` set (`kiswahili`, `history_civics`, `historia-ya-tanzania-na-maadili`, `civics`, `elimu-ya-dini-islamu`, `uraia-na-maadili`) — used for Sukuma/Kiswahili handling in plan generation. If those subjects are gone, this set is dead code — remove or leave (harmless dead branch). **Verify usage before removing.**

---

## 3. Database `subjects` table — production purge (deployment)

Subject set is DB-driven (seeds fill `subjects` via `seed_admin_math.py`). For the **existing production DB**, a deployment step must delete rows for removed subjects **and their dependent rows**:

- `subjects` rows (Biology, English, Kiswahili, History, Geography, Civics/Historia, Business Studies, Bible Knowledge, Computing/ICT, Agriculture, Bookkeeping, + any others seeded).
- **Cascade risks:** `topics`, `subtopics`, `lessons`, `schemes`, `reference_docs`, `assignments`, `exam_papers`, `progress/attempts`, teacher `subjects` `M2M`, classroom subject links. **This is the highest-risk area** — orphaned FK rows may already exist from prior seeding. Requires an audit of FK constraints (`models/lesson.py` Subject model) and a data migration or `DELETE ... WHERE slug IN (...)` with cascade handling.
- Consider **soft-hide vs hard-delete**: soft-hide (exclude via a filter) is safer initially; hard delete requires a migration.

**Frontend impact of a live DB:** existing users who selected removed subjects will see breakdowns unless data is purged or hidden.

### 3b. API layer — no whitelist to change

- `api/subjects.py:13-44` GET/POST `/subjects` — no whitelist; DB governs.
- `api/syllabus.py`, `api/reference_docs.py`, `api/ai.py` — subject slug is a loose query param, no validation. **No hardcoded allowed-list to trim.** Optionally add a `VALID_SUBJECTS` check post-trim to reject unknown slugs at API boundary.

---

## 4. Frontend — subject arrays, selects, copy (apps/platform/frontend)

### 4a. Source modules (remove non-kept entries; keep mathematics, chemistry, physics)

| File | Location | Notes |
|---|---|---|
| `assets/js/modules/admin-dashboard/admin-library.js` | `:3-16` SUBJECTS (12) | keep 3 |
| `assets/js/modules/admin-dashboard/admin-lessons.js` | `:78-91` select list (12) | keep 3 |
| `assets/js/modules/student/library.js` | `:7-20` SUBJECTS (12) | keep 3 |
| `assets/js/modules/teacher/library.js` | `:4-17` SUBJECTS (12) | keep 3 |
| `assets/js/modules/teacher/plans-syllabus.js` | `:4-17` plansSubjects (12) | keep 3 (`sw` flags gone) |
| `assets/js/modules/teacher/ai-assistant.js` | `:14-27` + `:50-63` two selects (12) | keep 3 |
| `assets/js/modules/api-client/core/quiz.js` | `:10` subjectLabels (13) | keep 3 |
| `assets/js/modules/api-quiz.js` | `:79` slugMap (14) | keep 3 |

### 4b. Minified/bundled copies (regenerate, do NOT hand-edit)

- `teacher.bundle.js` (`subjectLabels` :340, `slugMap` :585, `plansSubjects` :4202-4215, SUBJECTS :4767-4780)
- `student.bundle.js` (:585, :4606-4619)
- `admin.bundle.js` (:585, :5015-5028)
- Regenerate via `cd apps/platform/frontend && npm run minify:js` after editing sources.

### 4c. Landing / marketing copy (Swahili)

- `assets/js/i18n/swahili/landing.js:35-48` — `subjects.title/desc/kiswahili/english/civics/history/geography/biology/more…` — rewrite to 3 subjects. Also `:86 footer.subjects`.
- `assets/js/i18n/swahili/demo.js:39-49` — `demo.subject_bio` (Biolojia) etc. — remove non-kept demo copy.
- `assets/js/i18n/swahili/navigation.js:6` — generic `nav.subjects` label (fine, but audit).
- Embedded Swahili strings in `teacher.bundle.js` (:1732,1768,1780,1795-1797,1819) — regenerate after landing.js edit.
- `contact.html:68-69` — contact form subject `<select>`; audit.
- Nav/footer `#subjects` anchors: `index.html` subjects section; `privacy.html:87`, `help.html:119`, `forgot-password.html:97,284`, `reset-password.html:57,196`, `register.html:111,371` — references to removed subjects in copy need scrubbing.

### 4d. Student UI

- `student/subjects.js` — renders subject cards from **`/subjects` API** (auto-updates once DB trimmed).
- `student/overview.js:22,120,159,162` — subject List from API dropdowns (auto-updates).

---

## 5. AI package (packages/ai)

### 5a. Subject constants / frameworks (code)

| File | Change |
|---|---|
| `src/prompts/subject-frameworks.ts:19-120` | FRAMEWORKS — keep `mathematics`, `physics`, `chemistry` (:20,:31,:41). Remove `biology`(:51), `geography`(:61), `history`(:71), `civics`(:81), `kiswahili`(:90), `english`(:100), `computing`(:110). Fallback COMMON (:122) unaffected. |
| `server-utils/tutoring.ts:11-42` | SUBJECT_NAME map — prune non-kept; `resolveSubject()` regex — keep math/chem/phys resolution. |
| `src/tutoring/prompts.ts:7-16` + `:45` | SUBJECT_SLUG_MAP — remove biology/english/kiswahili entries (Kiswahili NECTA template flag becomes dead). |
| `src/question-generation/curriculum-context.ts:6-13` | SUBJECT_SLUG_MAP — remove biology/english/kiswahili. |
| `src/recommendations/content-catalog.ts:28-38` | catalog entries `biology`, `english`, `history` — remove or rework. |
| `src/types/tutoring.ts:11-20` | `TutoringSubject` enum still has HISTORY/LITERATURE/LANGUAGE/COMPUTING/ARTS/GENERAL — harmless (classifier categories), but decide whether to trim. |
| `src/types/translation.ts:18` | `HISTORY` TranslationTarget — prune if unused post-change. |
| `src/types/personalization.ts:76` | `history: PersonalizationEvent[]` field — check usage. |
| `src/prompts/necta-templates.ts:12` + `src/prompts/necta/kiswahili.ts` | Kiswahili NECTA template — dead if Kiswahili removed; remove or leave. |

### 5b. Knowledge base (large data purge — biggest volume)

- `knowledge_base/exams/internal/` — remove non-kept subject dirs; **keep `mathematics(80)`, `chemistry(120)`, `physics(120)`**; remove all others (biology, english_language, kiswahili, geography, history, historia_ya_tanzania_na_maadili, civics, business_studies, bible_knowledge, book_keeping, commerce, economics, agriculture, computer_science, divinity, academic_communication, basic_applied_mathematics, basic_mathematics → **watch out: `basic_mathematics` vs `mathematics` mapping**; decide retained name).
- `knowledge_base/syllabi/o_level/` — keep `basic_mathematics`, `chemistry`, `physics` (+ `physics_f1_f4`); remove others (19 → 3).
- `knowledge_base/syllabi/a_level/` — keep `mathematics`, `chemistry`, `physics`; remove others (14 → 3).
- `knowledge_base/schemes/form1-form5/` — keep Mathematics, Chemistry, Physics per form; remove Biology, Civics, Geography, History, HTM, English, Kiswahili, Book Keeping, Business Studies, Bible Knowledge, Literature, etc.
- `knowledge_base/lessons/form1-form6/` — keep math/chem/phys-tagged lessons; remove others.
- `knowledge_base/exam_formats/parsed/` + `templates/` — parsed exam format JSONs enumerate many subjects (CSEE/FTNA lists at :4-16); either prune to 3 or keep as historical formats with 3-subject framing. School selection of subjects in exams is separate from library scope.
- Update `knowledge_base/FILE_DIRECTORY.txt`, `README.md:35-36` (BIOLOGY_CSEE_MARKING_SCHEME, "Biology pilots"), `PLAN.md:82-94` (033 Biology).

> **Volume caution:** KB purge touches **thousands of files** (exams: ~1,900 files; lessons; schemes). Do NOT delete wholesale blindly — check for cross-references (marking schemes referencing biology, exam-formats referencing subject list, etc.). Recommend a script + PR for review.

---

## 6. Tests + CI + docs

### 6a. Backend tests (apps/platform/tests) — must be updated to kept subjects

| Test | Occurrences |
|---|---|
| `test_ref_seed.py:44-110` | asserts geography/biology/english/kiswahili/history/business_studies docs exist → **rewrite to kept set** + `inserted_schemes` count changes |
| `test_ref_seed_grounding.py:32-158` | geography grounding → switch to chemistry/physics |
| `test_ref_service.py:36-56` | history/kiswahili/english → math/chem/phys |
| `test_ref_mapper.py:10-25` | civics/history_civics/bible_knowledge/commerce/agriculture/etc. `map_subject_slug` cases → trim |
| `test_tie_syllabus.py:59-64` | civics→historia alias, kiswahili → trim |
| `test_ref_api.py`, `test_plan_generation*`, `test_plan_offline*`, `test_plan_crud.py:103-111` | plan tests referencing biology/kiswahili/geography subjects → switch to math/chem/phys |
| `test_plan_offline_geography.py`, `test_scheme_work_verified.py` | geography-specific → replace or delete |
| `test_plan_utils.py:258-268` | "Both an English (physics) and a Kiswahili subject" → rewrite |
| `test_api.py:17-30` | fine (Physics) |
| `test_classrooms.py:93` | generic "subjects" — fine |
| `test_plan_crud.py:28-29`, `test_ref_api.py`, `test_plan_generation*.py` math/chem cases | keep |

### 6b. AI tests (packages/ai/tests)

- `tests/unit/kb/knowledge-base.test.ts:12-71` — Biology ('033') cases → switch to a kept subject or adjust.
- `tests/unit/learning-paths/path-generator.test.ts:16-79` — Science/History → math/chem/phys.
- Others (question-generator, tutoring, personalization, integration) mostly use MATH/GENERAL → unaffected.

### 6c. Docs

- `REFACTOR-PLAN.md:18-22` — mentions Biology/English/Kiswahili extraction.
- `packages/ai/docs/system-prompt-v2.md:87-146` — per-subject prompt sections **also echo in `server_utils`**; regenerate/sync.
- `knowledge_base/README.md`, `PLAN.md` — subject lists.
- `AGENTS.md`/README — if enrollment/course lists documented.

---

## 7. What does NOT need changing (verified)

- **`libs/core` Python compiler** — subject is passthrough string (`manifest.py:16`, `metadata.py:19`); no enumeration.
- **Exam-paper local generation** — `exam_paper/local_gen/mcq.py` and `structured.py` use generic "subject" placeholder, no subject names.
- **Search service tokenizer** — `services/search_service.py:7` "english" is a SQLite FTS language token name, **not** the subject.
- **API layer** — no subject whitelist exists; DB-driven.
- **Payments/AI infra** — no subject enumeration in Docker/deploy config.

---

## 8. Recommended execution order

1. **Freeze scope** — confirm delete vs soft-hide for existing DB data (highest risk).
2. **Trim backend seeds** (`data/`, `data/reference/`, `seed_dev_data`, `tie_syllabus`) → tests for both seeds + reference set.
3. **Trim frontend arrays + copy** (source .js + landing/demo i18n + HTML scrub) → rebuild bundles via `minify:js`.
4. **Trim AI KB** (scripted purge: exams/syllabi/schemes/lessons) + AI subject constants/frameworks → rerun AI unit/integration tests.
5. **Update backend + AI tests** to kept-subject set; full `pnpm validate` + `pytest`.
6. **Deployment:** push → Railway auto-deploy; run DB migration to remove/hide non-kept `subjects` rows (+ dependents) **after** new image is live; verify Vercel frontends reflect 3 subjects.
7. **Smoke test** all three Railway services + three Vercel apps.

---

## 9. Open questions for the reviewer

1. **Hard delete or soft-hide** production `subjects` rows and dependent data (progress, assignments, exam papers, teacher subject pins)?
2. **Basic Mathematics naming** — keep slug `mathematics` only, or also alias `basic_mathematics` → `mathematics` (reference schemes use `mathematics`; NECTA syllabus uses `basic mathematics`)?
3. **AI `TutoringSubject` enum & KB classifier categories** — leave generic categories (SCIENCE/GENERAL) or hard-limit to 3?
4. **Exam formats parsed JSONs (CSEE_2022 etc.)** — these enumerate all national subjects; they describe national exams, not Casuya's library. Trim to 3 or keep as-is?
5. **`additional_mathematics`** — kept (ties to Basic Mathematics) or dropped too?
6. **Frontend `contact.html` subject select + landing marketing** — full scrub, or keep as aspirational "coming soon"?
7. **Old users with removed subjects** — migrate their data to nearest kept subject, or archive?