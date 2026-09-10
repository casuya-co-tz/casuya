import type {
  Lesson,
  LessonId,
  SlideId,
  EditorEvents,
  EventCallback,
  AccessibilityCheck,
} from '../../types.js';
import { SlideManager } from '../slide-manager.js';
import { ComponentManager } from '../component-manager.js';
import { HistoryManager } from '../history-manager.js';
import { TemplateManager } from '../../templates/template-manager.js';
import { ThemeManager } from '../../themes/theme-manager.js';
import { VersionManager } from '../../versioning/version-manager.js';
import { AccessibilityManager } from '../../accessibility/accessibility-manager.js';
import { AutoSave } from '../../autosave/auto-save.js';
import { createDefaultLesson } from './defaults.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixin generics require any[] constructor params
export type Constructor<T extends object = object> = new (...args: any[]) => T;

export class LessonBuilderBase {
  lesson: Lesson;
  slideManager: SlideManager;
  componentManager: ComponentManager;
  historyManager: HistoryManager;
  templateManager: TemplateManager;
  themeManager: ThemeManager;
  versionManager: VersionManager;
  accessibilityManager: AccessibilityManager;
  autoSave: AutoSave;
  listeners: Map<string, Set<EventCallback>> = new Map();
  activeSlideId: SlideId | null = null;

  constructor(lessonId?: LessonId) {
    this.slideManager = new SlideManager();
    this.componentManager = new ComponentManager();
    this.historyManager = new HistoryManager();
    this.templateManager = new TemplateManager();
    this.themeManager = new ThemeManager();
    this.versionManager = new VersionManager();
    this.accessibilityManager = new AccessibilityManager();
    this.autoSave = new AutoSave();
    this.lesson = createDefaultLesson(lessonId);
    this.pushHistory('Lesson created');
  }

  getSlideManager(): SlideManager {
    return this.slideManager;
  }

  getComponentManager(): ComponentManager {
    return this.componentManager;
  }

  getHistoryManager(): HistoryManager {
    return this.historyManager;
  }

  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  getThemeManager(): ThemeManager {
    return this.themeManager;
  }

  getVersionManager(): VersionManager {
    return this.versionManager;
  }

  getAccessibilityManager(): AccessibilityManager {
    return this.accessibilityManager;
  }

  checkAccessibility(): AccessibilityCheck[] {
    return this.accessibilityManager.checkLesson(this.lesson);
  }

  getAutoSave(): AutoSave {
    return this.autoSave;
  }

  setActiveSlide(slideId: SlideId | null): void {
    this.activeSlideId = slideId;
  }

  getActiveSlideId(): SlideId | null {
    return this.activeSlideId;
  }

  on<K extends keyof EditorEvents>(event: K, callback: EventCallback<EditorEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  off<K extends keyof EditorEvents>(event: K, callback: EventCallback<EditorEvents[K]>): void {
    this.listeners.get(event)?.delete(callback as EventCallback);
  }

  emit<K extends keyof EditorEvents>(event: K, data: EditorEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(data);
      }
    }
  }

  pushHistory(description: string): void {
    this.historyManager.push(this.serializeLesson(), description);
  }

  touch(): void {
    this.lesson.updatedAt = new Date().toISOString();
  }

  serializeLesson(): Lesson {
    return {
      ...this.lesson,
      metadata: { ...this.lesson.metadata },
      theme: { ...this.lesson.theme },
      slides: this.slideManager.getAll(),
    };
  }

  restoreSnapshot(snapshot: Lesson): void {
    this.lesson = JSON.parse(JSON.stringify(snapshot));
    this.slideManager.setSlides(this.lesson.slides);
  }

  load(lesson: Lesson): void {
    this.lesson = JSON.parse(JSON.stringify(lesson));
    this.slideManager.setSlides(this.lesson.slides);
    this.historyManager.clear();
    this.pushHistory('Lesson loaded');
    this.emit('lesson:loaded', this.serializeLesson());
  }
}