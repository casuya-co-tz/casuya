import type { Lesson, VersionSnapshot } from '../../types.js';
import { Constructor, LessonBuilderBase } from './base.js';

export const HistoryTrait = <T extends Constructor<LessonBuilderBase>>(Base: T) =>
  class HistoryActions extends Base {
    undo(): boolean {
      const entry = this.historyManager.undo();
      if (!entry) return false;
      this.restoreSnapshot(entry.lessonSnapshot);
      this.emit('history:undo', entry);
      return true;
    }

    redo(): boolean {
      const entry = this.historyManager.redo();
      if (!entry) return false;
      this.restoreSnapshot(entry.lessonSnapshot);
      this.emit('history:redo', entry);
      return true;
    }

    load(lesson: Lesson): void {
      this.lesson = JSON.parse(JSON.stringify(lesson));
      this.slideManager.setSlides(this.lesson.slides);
      this.historyManager.clear();
      this.pushHistory('Lesson loaded');
      this.emit('lesson:loaded', this.serializeLesson());
    }

    save(): Lesson {
      const lesson = this.serializeLesson();
      this.versionManager.createSnapshot(lesson);
      this.emit('lesson:updated', lesson);
      return lesson;
    }

    createVersion(label: string): VersionSnapshot {
      const snapshot = this.versionManager.createSnapshot(this.serializeLesson(), label);
      this.emit('version:created', snapshot);
      return snapshot;
    }

    restoreVersion(versionId: string): boolean {
      const snapshot = this.versionManager.getVersion(versionId);
      if (!snapshot) return false;
      this.load(snapshot.lesson);
      return true;
    }
  };