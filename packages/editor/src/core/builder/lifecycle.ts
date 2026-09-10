import type { AccessibilityCheck, AutoSaveConfig } from '../../types.js';
import { Constructor, LessonBuilderBase } from './base.js';

export const LifecycleTrait = <T extends Constructor<LessonBuilderBase>>(Base: T) =>
  class LifecycleActions extends Base {
    checkAccessibility(): AccessibilityCheck[] {
      return this.accessibilityManager.checkLesson(this.lesson);
    }

    configureAutoSave(config: Partial<AutoSaveConfig>): void {
      this.autoSave.configure(config);
    }

    startAutoSave(): void {
      this.autoSave.start(() => this.serializeLesson());
    }

    stopAutoSave(): void {
      this.autoSave.stop();
    }
  };