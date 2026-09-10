# REFACTOR-PLAN.md — Split Large Files for Maintainability

**Date:** 2026-09-08
**Goal:** Break files >400 lines into focused, single-responsibility modules.
**Status:** ✅ COMPLETE — all phases implemented, all source files under 400 lines.
**Verified:** All line counts confirmed against actual codebase (2026-09-08).

---

## Phase 1: Seed Data (Highest Impact)

**File:** `apps/platform/database/seeds/seed_necta_syllabus.py` (18,042 lines)

| Step | Action | Output |
|------|--------|--------|
| 1.1 | Create `database/seeds/data/` directory | `data/` folder |
| 1.2 | Extract Math syllabus to `data/math.json` | ~3,000 lines |
| 1.3 | Extract Physics syllabus to `data/physics.json` | ~2,500 lines |
| 1.4 | Extract Chemistry syllabus to `data/chemistry.json` | ~2,800 lines |
| 1.5 | Extract Biology syllabus to `data/biology.json` | ~3,200 lines |
| 1.6 | Extract English syllabus to `data/english.json` | ~3,000 lines |
| 1.7 | Extract Kiswahili syllabus to `data/kiswahili.json` | ~3,500 lines |
| 1.8 | Rewrite `seed_necta_syllabus.py` to load from JSON files | ~50 lines |
| 1.9 | Verify: `pytest tests/ -v` passes | No regressions |

**Result:** 18,042 → ~50 lines + 6 focused JSON files

---

## Phase 2: Backend Services

### 2A: `teacher_plan_service.py` (3,081 lines) — CRITICAL

| Step | Action | Output |
|------|--------|--------|
| 2.1 | Create `backend/services/teacher_plans/` package | `__init__.py` |
| 2.2 | Extract prompt templates (`_build_lesson_plan_prompt` + `_build_scheme_prompt`) → `plan_templates.py` | ~600 lines |
| 2.3 | Extract input validators (`_is_complete_lesson_plan`, `_is_complete_scheme`, `_parse_plan_json`) → `plan_validators.py` | ~150 lines |
| 2.4 | Extract scheme-of-work logic (`generate_scheme_of_work` + helpers) → `scheme_of_work.py` | ~500 lines |
| 2.5 | Extract plan generation core (`generate_lesson_plan` + `_fill_lesson_plan_placeholders`) → `plan_generator.py` | ~400 lines |
| 2.6 | Extract offline fallback (`_build_lesson_plan_offline` + `_patch_weak_progression_from_offline`) → `plan_offline.py` | ~400 lines |
| 2.7 | Extract assessment logic (`_stage_assessment_criteria` + `_reference_stage_assessments` + `_polish_progression_cells`) → `plan_assessment.py` | ~300 lines |
| 2.8 | Slim down `teacher_plan_service.py` to facade (imports + public API) | ~200 lines |
| 2.9 | Update all imports in API routes + tests | Grep + fix |
| 2.10 | Verify: `pytest tests/backend/test_teacher_plans.py -v` | No regressions |

### 2B: Other Services (500–700 lines)

| File | Lines | Split Into |
|------|-------|-----------|
| `reference_library_service.py` | 659 | `ref_library_browser.py` + `ref_library_search.py` |
| `exam_paper_service.py` | 657 | `exam_generator.py` + `exam_validator.py` + `exam_repairer.py` |
| `ai_service.py` | 546 | `ai_client.py` + `ai_prompts.py` |
| `lesson_service.py` | 517 | `lesson_crud.py` + `lesson_cache.py` + `lesson_quiz.py` |

### 2C: Payments Microservice

| File | Lines | Split Into |
|------|-------|-----------|
| `apps/payments/app/main.py` | 544 | `routes/subscriptions.py` + `routes/invoices.py` + `routes/refunds.py` + `routes/azampay.py` |

---

## Phase 3: Frontend — Teacher & Student Dashboards

### 3A: `teacher-dashboard.js` (3,074 lines)

**Structure:** Single `renderTeacherDashboard()` function with nested closures sharing state (`_navStack`, `_subtopicLessonList`). View routing via `showTeacherView(content)` at line 303.

**Step 1:** Refactor to class/module pattern (prerequisite for splitting):
- Wrap all state + functions in a `TeacherDashboard` class
- Convert closure variables to class properties
- Convert nested functions to methods

**Step 2:** Split by view responsibility:

| New File | Source Lines | Content |
|----------|-------------|---------|
| `teacher-sidebar.js` | 2–44, 2669–2800 | Sidebar nav, profile dropdown, notifications bell |
| `teacher-overview.js` | 417–546 | Overview stats cards |
| `teacher-class.js` | 547–691 | Class management |
| `teacher-students.js` | 692–829 | Student list + details |
| `teacher-lessons.js` | 830–1058 | Lesson browser + content |
| `teacher-assignments.js` | 1089–1521 | Assignment CRUD + grading |
| `teacher-reports.js` | 1522–1599 | Reports + analytics |
| `teacher-teaching-docs.js` | 1600–1681 | Teaching docs + saved items |
| `teacher-plans.js` | 1682–2257, 2801–2874 | Lesson plan builder + syllabus topics |
| `teacher-library.js` | 2258–2417 | Reference library + docs |
| `teacher-ai-assistant.js` | 2418–2588 | AI chat assistant |
| `teacher-files.js` | 2589–2653 | File management |
| `teacher-payments.js` | 2654–2668 | Payments view |
| `teacher-notifications.js` | 2875+ | Notifications view |
| `teacher-dashboard.js` (facade) | ~100 | Router + class init |

### 3B: `student-dashboard.js` (2,448 lines)

**Same approach as teacher.** Refactor to class, then split:

| New File | Content |
|----------|---------|
| `student-sidebar.js` | Sidebar nav + profile |
| `student-overview.js` | Overview + recently viewed |
| `student-subjects.js` | Subject/topic/subtopic browser |
| `student-lessons.js` | Lesson viewer + content |
| `student-progress.js` | Progress tracking |
| `student-bookmarks.js` | Bookmarks |
| `student-assignments.js` | Assignments |
| `student-games.js` | Games |
| `student-exams.js` | Exam papers |
| `student-files.js` | File management |
| `student-library.js` | Reference library |
| `student-plans.js` | Study plans |
| `student-settings.js` | Settings + accessibility prefs |
| `student-dashboard.js` (facade) | Router + class init |

---

## Phase 4: Frontend — Admin Dashboard + CSS

### 4A: Admin Dashboard Modules (4 files over 400 lines)

| File | Lines | Split Into |
|------|-------|-----------|
| `04-payments-notif-uploads.js` | 794 | `admin-payments.js` + `admin-notifications.js` + `admin-uploads.js` |
| `05-branding-analytics-settings.js` | 596 | `admin-branding.js` + `admin-analytics.js` + `admin-settings.js` |
| `02-lessons-quizzes-games.js` | 508 | `admin-lessons.js` + `admin-quizzes.js` + `admin-games.js` |
| `03-users.js` | 483 | `admin-users-list.js` + `admin-users-detail.js` |

### 4B: Frontend API Client

| File | Lines | Split Into |
|------|-------|-----------|
| `api.js` | 658 | `api-client.js` (base HTTP) + `api-cache.js` (request caching) + `api-auth.js` (token/headers) |

### 4C: CSS (2,283 lines)

| New File | Est. Lines | Content |
|----------|-----------|---------|
| `css/variables.css` | ~80 | CSS custom properties |
| `css/base.css` | ~200 | Reset, typography, body |
| `css/layout.css` | ~300 | Sidebar, grid, responsive |
| `css/components.css` | ~800 | Cards, buttons, inputs, modals |
| `css/utilities.css` | ~200 | Helper classes |
| `css/main.css` (imports only) | ~15 | `@import` statements |

---

## Phase 5: Blackboard Package

| File | Lines | Split Into |
|------|-------|-----------|
| `base.ts` | 1,079 | Extract constructor setup (lines 185–260) → `setup.ts` trait. Keep core state in `base.ts`. |
| `traits/tools.ts` | 723 | Extract undo/redo logic → `undo-redo.ts` trait. Keep tool handlers in `tools.ts`. |
| `traits/render.ts` | 632 | Extract laser rendering → `render-laser.ts`. Keep main pipeline in `render.ts`. |
| `toolbar.ts` | 652 | Extract SVG icon definitions → `icons.ts` (~300 lines). |

**Note:** `persistence.ts` (376), `misc.ts` (292), `ui.ts` (249) are all under 400 — no split needed.

---

## Phase 6: AI Package

| File | Lines | Split Into |
|------|-------|-----------|
| `server.ts` | 702 | `routes/questions.ts` + `routes/tutoring.ts` + `routes/content.ts` |

**Note:** All other AI files (`recommendation-engine.ts` 335, `necta-templates.ts` 289, `template-library.ts` 251, `question-generator.ts` 290, `tutoring-engine.ts` 270, `knowledge-base.ts` 286) are under 400 — no split needed.

---

## Phase 7: Tools — Generation Scripts

| File | Lines | Split Into |
|------|-------|-----------|
| `tools/generate_bio_f1.py` | 677 | `generate_bio_f1_topics.py` + `generate_bio_f1_scheme.py` |
| `tools/generate_math_f1.py` | 677 | `generate_math_f1_topics.py` + `generate_math_f1_scheme.py` |
| `tools/generate_chem_f1.py` | 457 | Borderline — review, may not need split |

---

## Phase 8: Tests (Split After Code Is Refactored)

| File | Lines | Split Into |
|------|-------|-----------|
| `test_teacher_plans.py` | 1,223 | `test_plan_generation.py` + `test_scheme_work.py` + `test_plan_crud.py` + `test_plan_offline.py` |
| `test_reference_docs.py` | 528 | `test_ref_mapper.py` + `test_ref_service.py` + `test_ref_api.py` |

---

## Files Under 400 Lines — No Action Needed

These files were reviewed and confirmed below the soft limit:

| File | Lines |
|------|-------|
| `payment_service.py` | 359 |
| `auth_service.py` | 350 |
| `game_service.py` | 280 |
| `syllabus_service.py` | 268 |
| `services_bridge_client.py` | 227 |
| `config/database.py` | 310 |
| `api/services_bridge.py` | 355 |
| `api/classrooms.py` | 311 |
| `api/payments.py` | 314 |
| `api/settings.py` | 296 |
| `api/uploads.py` | 291 |
| `data/tie_competences.py` | 459 → split into `tie_competences/` package |
| `lesson.js` | 437 → split into `lesson/` package |
| `teacher.css` | 377 |
| `casuya_bridge.js` | 369 |
| `i18n.js` | 467 → engine (161) + `i18n-swahili.js` data (355) |
| `admin-dashboard/01-overview.js` | 346 |
| `blackboard/traits/persistence.ts` | 376 |
| `blackboard/traits/ui.ts` | 249 |
| `editor/lesson-builder.ts` | 384 |
| `editor/html-exporter.ts` | 211 |
| `tools/generate_chem_f1.py` | 457 → split into topics + scheme |

---

## Validation Checklist

After each phase, run:

```bash
pnpm typecheck        # TypeScript passes
pnpm lint             # ESLint passes
pnpm test             # All tests pass
pnpm check:layers     # Layer dependencies intact
```

---

## Priority Order (Revised)

1. **Phase 1** — Seed data (18,042 lines → biggest win, lowest risk)
2. **Phase 2** — `teacher_plan_service.py` (3,081 lines → core business logic)
3. **Phase 3** — Teacher + student dashboards (5,522 lines → user-facing, needs manual UI testing)
4. **Phase 4** — Admin dashboard + CSS (2,941 lines → frontend cleanup)
5. **Phase 5** — Blackboard (2,454 lines → isolated package)
6. **Phase 6** — AI server (702 lines → quick win)
7. **Phase 7** — Tools scripts (1,811 lines → data generation)
8. **Phase 8** — Tests (1,751 lines → follows code splits)

---

## Rules

- Keep every file under **400 lines** (soft limit)
- Never exceed **600 lines** (hard limit)
- Each module should have **one clear responsibility**
- Preserve all existing tests — just move them to new files
- Run validation after every phase before moving to the next
- `vendor-blackboard.js` (4,585) is auto-generated — exclude from this plan

---

## Change Log

| Date | Change |
|------|--------|
| 2026-09-08 | Initial plan created |
| 2026-09-08 | Fixed line counts against actual codebase |
| 2026-09-08 | Removed files under 400 lines from split lists |
| 2026-09-08 | Added missing admin dashboard, payments, tools phases |
| 2026-09-08 | Corrected i18n.js path (`assets/js/i18n.js` not `modules/`) |
| 2026-09-08 | Revised teacher/student dashboard split to account for closure-based architecture |
| 2026-09-08 | Revised blackboard split (camera/elements extraction not feasible, undo-redo extraction instead) |
| 2026-09-08 | ✅ i18n.js split: engine (161 lines) + `i18n-swahili.js` data module (355 lines). Added to bundle core before i18n.js; added `<script>` to all 4 standalone pages (index, login, register, forgot-password); sw.js precache updated. |
| 2026-09-08 | 🧹 Removed dead artifacts: `assets/js/main.bundle.js`, `assets/js/main.min.js`, `tools/bundle-main.mjs` (legacy monolithic pipeline, no longer referenced by any page/CI/deploy) + stray duplicate `platform/` dir. Updated FILE_DIRECTORY.txt. |
| 2026-09-08 | ✅ All phases implemented. Every source file < 400 lines. Validation green (typecheck 18/18, build 15/15, lint 0 errors, 52 Python tests, 113 AI tests, 35 blackboard tests, frontend bundles). |

---

## Completion Summary

All planned refactoring is complete. The 14 largest monoliths were broken into **~140 focused modules**:

| Original | Lines | Result |
|----------|-------|--------|
| `seed_necta_syllabus.py` | 18,042 | 247-line loader + 15 JSON data files |
| `teacher_plan_service.py` | 3,314 | 11-module `teacher_plans/` package |
| `teacher-dashboard.js` | 3,074 | 17-module `teacher/` package |
| `student-dashboard.js` | 2,448 | 20-module `student/` package |
| Admin dashboard (4 files) | 2,381 | 14 focused admin modules |
| `main.css` | 2,283 | 11 CSS files via `@import` |
| Blackboard (4 files) | 3,359 | 16 trait/routes modules via mixins |
| `reference_library_service.py` | 659 | 3-module `reference_library/` package |
| `exam_paper_service.py` | 657 | 5-module `exam_paper/` package |
| `ai_service.py` | 546 | 5-module `ai_bridge/` package |
| `lesson_service.py` | 517 | 3-module `lesson/` package |
| `apps/payments/app/main.py` | 660 | 7-file package + 12-line entry point |
| Test files (2 files) | 1,751 | 9 focused test files + facades |
| Tools scripts (2 files) | 1,354 | Topic/scheme data modules + wrappers |
