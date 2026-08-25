# API reference

## `CasuyaBridge`

| Method | Description |
|---|---|
| `new CasuyaBridge(options)` | Create an instance; see README for `options` |
| `.start()` | Begin connectivity monitoring + sync timer |
| `.stop()` | Tear down listeners/timers |
| `.on(event, handler)` | Subscribe to a bridge event; returns an unsubscribe function |
| `.renderLesson(slug, mountEl)` | Render a cached package into `mountEl` |
| `.startSession({ lessonSlug, studentId, totalSections })` | Begin tracking a session |
| `.visitSection(sessionId, sectionId)` | Mark a section visited |
| `.recordAnswer(sessionId, answer)` | Record a quiz answer (`{ isCorrect, ... }`) |
| `.endSession(sessionId)` | Finalize, persist, and enqueue the session for sync |
| `.syncNow()` | Trigger an immediate sync cycle |
| `.isOnline` | Current connectivity state |
| `.runtime` | Escape hatch: direct access to all subsystems |

## Events (`EVENTS` from `core/constants.js`)

`lesson:loaded`, `lesson:ready`, `lesson:error`, `progress:updated`,
`lesson:completed`, `sync:started`, `sync:success`, `sync:failure`,
`connectivity:online`, `connectivity:offline`.

## Named exports

See `src/index.js` for the full list — every subsystem class/function
(`SyncEngine`, `ProgressTracker`, `LessonRenderer`, `verifyOrThrow`,
`applyTheme`, etc.) is individually exported for advanced/custom usage
beyond the `CasuyaBridge` facade.
