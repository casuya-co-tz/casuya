/** Ties session lifecycle + storage + event emission together. */

import { STORES, EVENTS } from '../core/constants.js';
import { LessonSession } from './sessions.js';
import { computeCompletion } from './completion.js';
import { computeScore } from './scores.js';

export class ProgressTracker {
  constructor({ db, bus, queue }) {
    this._db = db;
    this._bus = bus;
    this._queue = queue;
    this._activeSessions = new Map();
  }

  startSession({ lessonSlug, studentId, totalSections = 0 }) {
    const session = new LessonSession({ lessonSlug, studentId });
    session.totalSections = totalSections;
    session.timer.start();
    this._activeSessions.set(session.id, session);
    return session;
  }

  visitSection(sessionId, sectionId) {
    const session = this._require(sessionId);
    session.visitSection(sectionId);
    this._bus?.emit(EVENTS.PROGRESS_UPDATED, {
      sessionId,
      completion: computeCompletion(session.totalSections, session.visitedSectionIds),
    });
  }

  recordAnswer(sessionId, answer) {
    const session = this._require(sessionId);
    session.recordAnswer(answer);
  }

  async endSession(sessionId) {
    const session = this._require(sessionId);
    session.end();

    const completion = computeCompletion(session.totalSections, session.visitedSectionIds);
    const score = session.answers.length > 0 ? computeScore(session.answers) : null;

    const record = {
      ...session.toJSON(),
      completionPercentage: completion.percentage,
      scorePercentage: score?.percentage ?? null,
    };

    await this._db.put(STORES.PROGRESS, session.id, record);
    await this._queue.enqueue({ type: 'progress', payload: record });

    if (completion.isComplete) {
      this._bus?.emit(EVENTS.LESSON_COMPLETED, { sessionId, lessonSlug: session.lessonSlug });
    }

    this._activeSessions.delete(sessionId);
    return record;
  }

  async history(lessonSlug) {
    const all = await this._db.values(STORES.PROGRESS);
    return lessonSlug ? all.filter((r) => r.lessonSlug === lessonSlug) : all;
  }

  _require(sessionId) {
    const session = this._activeSessions.get(sessionId);
    if (!session) throw new Error(`No active session with id '${sessionId}'`);
    return session;
  }
}
