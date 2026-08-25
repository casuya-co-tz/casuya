/** Represents and persists a single student's lesson session. */

import { SessionTimer } from './timers.js';
import { uuid } from '../utils/uuid.js';

export class LessonSession {
  constructor({ lessonSlug, studentId, nowFn = Date.now }) {
    this.id = uuid();
    this.lessonSlug = lessonSlug;
    this.studentId = studentId;
    this.timer = new SessionTimer(nowFn);
    this.visitedSectionIds = new Set();
    this.answers = [];
    this.startedAt = nowFn();
    this.endedAt = null;
  }

  visitSection(sectionId) {
    this.visitedSectionIds.add(sectionId);
  }

  recordAnswer(answer) {
    this.answers.push(answer);
  }

  end(nowFn = Date.now) {
    this.timer.pause();
    this.endedAt = nowFn();
  }

  toJSON() {
    return {
      id: this.id,
      lessonSlug: this.lessonSlug,
      studentId: this.studentId,
      elapsedMs: this.timer.elapsedMs,
      visitedSectionIds: [...this.visitedSectionIds],
      answers: this.answers,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    };
  }
}
