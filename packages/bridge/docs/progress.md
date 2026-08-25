# Progress tracking

## Sessions

`progress/sessions.js`'s `LessonSession` tracks a single student's pass
through a lesson: visited section IDs, quiz answers, and elapsed time (via
`progress/timers.js`'s pausable `SessionTimer`).

## Completion & scoring

- `progress/completion.js` — percentage of a lesson's sections visited
- `progress/scores.js` — quiz correctness percentage + a simple letter grade

## Tracker

`progress/tracker.js`'s `ProgressTracker` ties session lifecycle to
storage and the sync queue:

```js
const session = tracker.startSession({ lessonSlug, studentId, totalSections });
tracker.visitSection(session.id, sectionIndex);
tracker.recordAnswer(session.id, { questionId, isCorrect });
const record = await tracker.endSession(session.id); // persists + enqueues for sync
```

Ending a session that reaches 100% completion emits `lesson:completed`.

## Analytics

`progress/analytics.js`'s `summarizeSessions` aggregates a list of session
records into average elapsed time, completion, and score — intended for a
lightweight per-lesson dashboard without a server round-trip.
