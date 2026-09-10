import type {
  Lesson,
  LessonMetadata,
  LessonTheme,
  ValidationResult,
} from '../../types.js';
import { validateLesson } from '../../utils/validation.js';
import { Constructor, LessonBuilderBase } from './base.js';

export const LessonInfoTrait = <T extends Constructor<LessonBuilderBase>>(Base: T) =>
  class LessonInfoActions extends Base {
    getLesson(): Lesson {
      return this.serializeLesson();
    }

    getLessonId(): string {
      return this.lesson.id;
    }

    getTitle(): string {
      return this.lesson.title;
    }

    setTitle(title: string): void {
      this.lesson.title = title;
      this.touch();
      this.pushHistory(`Title changed to "${title}"`);
      this.emit('lesson:updated', this.serializeLesson());
    }

    getDescription(): string {
      return this.lesson.description;
    }

    setDescription(description: string): void {
      this.lesson.description = description;
      this.touch();
      this.pushHistory('Description updated');
      this.emit('lesson:updated', this.serializeLesson());
    }

    getVersion(): string {
      return this.lesson.version;
    }

    setVersion(version: string): void {
      this.lesson.version = version;
      this.touch();
    }

    getMetadata(): LessonMetadata {
      return { ...this.lesson.metadata };
    }

    updateMetadata(updates: Partial<LessonMetadata>): void {
      this.lesson.metadata = { ...this.lesson.metadata, ...updates };
      this.touch();
      this.pushHistory('Metadata updated');
      this.emit('lesson:updated', this.serializeLesson());
    }

    getTheme(): LessonTheme {
      return { ...this.lesson.theme };
    }

    setTheme(theme: Partial<LessonTheme>): void {
      this.lesson.theme = { ...this.lesson.theme, ...theme };
      this.touch();
      this.pushHistory('Theme updated');
      this.emit('theme:applied', this.lesson.theme);
      this.emit('lesson:updated', this.serializeLesson());
    }

    validate(): ValidationResult {
      return validateLesson(this.serializeLesson());
    }
  };