import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCompletion } from '../../src/progress/completion.js';
import { computeScore, letterGrade } from '../../src/progress/scores.js';
import { SessionTimer } from '../../src/progress/timers.js';
import { summarizeSessions } from '../../src/progress/analytics.js';
import { ProgressTracker } from '../../src/progress/tracker.js';
import { MemoryStore } from '../../src/storage/indexeddb.js';
import { SyncQueue } from '../../src/sync/queue.js';
import { EventBus } from '../../src/core/events.js';
import { EVENTS } from '../../src/core/constants.js';

test('computeCompletion', () => {
  const result = computeCompletion(4, [0, 1, 2]);
  assert.equal(result.percentage, 75);
  assert.equal(result.isComplete, false);
});

test('computeScore and letterGrade', () => {
  const score = computeScore([{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }, { isCorrect: true }]);
  assert.equal(score.percentage, 75);
  assert.equal(letterGrade(score.percentage), 'B');
});

test('SessionTimer accumulates elapsed time across pause/start', () => {
  let now = 0;
  const timer = new SessionTimer(() => now);
  timer.start();
  now = 1000;
  timer.pause();
  now = 5000;
  timer.start();
  now = 6000;
  timer.pause();
  assert.equal(timer.elapsedMs, 2000);
});

test('summarizeSessions averages across sessions', () => {
  const summary = summarizeSessions([
    { elapsedMs: 1000, completionPercentage: 100, scorePercentage: 80 },
    { elapsedMs: 3000, completionPercentage: 50, scorePercentage: 60 },
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.avgElapsedMs, 2000);
  assert.equal(summary.avgCompletionPercentage, 75);
  assert.equal(summary.avgScorePercentage, 70);
});

test('ProgressTracker full session lifecycle enqueues a sync event and persists progress', async () => {
  const db = new MemoryStore();
  const bus = new EventBus();
  const queue = new SyncQueue(db);
  const tracker = new ProgressTracker({ db, bus, queue });

  let completed = false;
  bus.on(EVENTS.LESSON_COMPLETED, () => (completed = true));

  const session = tracker.startSession({ lessonSlug: 'mole-concept', studentId: 's1', totalSections: 2 });
  tracker.visitSection(session.id, 0);
  tracker.visitSection(session.id, 1);
  tracker.recordAnswer(session.id, { isCorrect: true });

  const record = await tracker.endSession(session.id);

  assert.equal(record.completionPercentage, 100);
  assert.equal(completed, true);
  assert.equal(await queue.size(), 1);

  const history = await tracker.history('mole-concept');
  assert.equal(history.length, 1);
});
