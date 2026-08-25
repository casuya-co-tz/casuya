import type {
  Lesson,
  LessonId,
  LessonMetadata,
  LessonTheme,
  Slide,
  SlideId,
  ComponentData,
  ComponentType,
  EditorEvents,
  EventCallback,
  VersionSnapshot,
  ImportResult,
  ExportOptions,
  ValidationResult,
  AutoSaveConfig,
  AccessibilityCheck,
} from '../types.js';
import { SlideLayout } from '../types.js';
import { SlideManager } from './slide-manager.js';
import { ComponentManager } from './component-manager.js';
import { HistoryManager } from './history-manager.js';
import { generateId } from '../utils/id-generator.js';
import { validateLesson } from '../utils/validation.js';
import { MarkdownImporter } from '../importers/markdown-importer.js';
import { HtmlImporter } from '../importers/html-importer.js';
import { JsonExporter } from '../exporters/json-exporter.js';
import { HtmlExporter } from '../exporters/html-exporter.js';
import { MarkdownExporter } from '../exporters/markdown-exporter.js';
import { TemplateManager } from '../templates/template-manager.js';
import { ThemeManager } from '../themes/theme-manager.js';
import { VersionManager } from '../versioning/version-manager.js';
import { AccessibilityManager } from '../accessibility/accessibility-manager.js';
import { AutoSave } from '../autosave/auto-save.js';

const DEFAULT_THEME: LessonTheme = {
  id: generateId(),
  name: 'Default',
  primaryColor: '#3b82f6',
  secondaryColor: '#60a5fa',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  headingFont: 'Inter, sans-serif',
  bodyFont: 'Inter, sans-serif',
  borderRadius: 8,
};

const DEFAULT_METADATA: LessonMetadata = {
  author: '',
  description: '',
  tags: [],
  language: 'en',
  difficulty: 'beginner',
  estimatedMinutes: 0,
  category: '',
};

export class LessonBuilder {
  private lesson: Lesson;
  private slideManager: SlideManager;
  private componentManager: ComponentManager;
  private historyManager: HistoryManager;
  private templateManager: TemplateManager;
  private themeManager: ThemeManager;
  private versionManager: VersionManager;
  private accessibilityManager: AccessibilityManager;
  private autoSave: AutoSave;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private activeSlideId: SlideId | null = null;

  constructor(lessonId?: LessonId) {
    this.slideManager = new SlideManager();
    this.componentManager = new ComponentManager();
    this.historyManager = new HistoryManager();
    this.templateManager = new TemplateManager();
    this.themeManager = new ThemeManager();
    this.versionManager = new VersionManager();
    this.accessibilityManager = new AccessibilityManager();
    this.autoSave = new AutoSave();

    this.lesson = {
      id: lessonId ?? generateId(),
      title: 'Untitled Lesson',
      description: '',
      version: '1.0.0',
      metadata: { ...DEFAULT_METADATA },
      theme: { ...DEFAULT_THEME },
      slides: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.pushHistory('Lesson created');
  }

  getLesson(): Lesson {
    return this.serializeLesson();
  }

  getLessonId(): LessonId {
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

  getAutoSave(): AutoSave {
    return this.autoSave;
  }

  setActiveSlide(slideId: SlideId | null): void {
    this.activeSlideId = slideId;
  }

  getActiveSlideId(): SlideId | null {
    return this.activeSlideId;
  }

  addSlide(title?: string, layout?: SlideLayout): Slide {
    const slide = this.slideManager.add(title, layout);
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory(`Slide added: "${slide.title}"`);
    this.emit('slide:added', slide);
    return slide;
  }

  addSlideAt(index: number, title?: string, layout?: SlideLayout): Slide | null {
    const slide = this.slideManager.addAt(index, title, layout);
    if (!slide) return null;
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory(`Slide added at position ${index}`);
    this.emit('slide:added', slide);
    return slide;
  }

  removeSlide(slideId: SlideId): Slide | null {
    const slide = this.slideManager.remove(slideId);
    if (!slide) return null;
    this.lesson.slides = this.slideManager.getAll();
    if (this.activeSlideId === slideId) {
      this.activeSlideId = null;
    }
    this.touch();
    this.pushHistory(`Slide removed: "${slide.title}"`);
    this.emit('slide:removed', slideId);
    return slide;
  }

  updateSlide(slideId: SlideId, updates: Partial<Omit<Slide, 'id'>>): Slide | null {
    const slide = this.slideManager.update(slideId, updates);
    if (!slide) return null;
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory(`Slide updated: "${slide.title}"`);
    this.emit('slide:updated', slide);
    return slide;
  }

  reorderSlides(fromIndex: number, toIndex: number): boolean {
    const result = this.slideManager.reorder(fromIndex, toIndex);
    if (!result) return false;
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory('Slides reordered');
    this.emit('slide:reordered', this.lesson.slides);
    return true;
  }

  duplicateSlide(slideId: SlideId): Slide | null {
    const slide = this.slideManager.duplicate(slideId);
    if (!slide) return null;
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory(`Slide duplicated: "${slide.title}"`);
    this.emit('slide:added', slide);
    return slide;
  }

  addComponent(slideId: SlideId, type: ComponentType, componentOverrides?: Partial<ComponentData>): ComponentData | null {
    const component = this.componentManager.create(type);
    const merged = { ...component, ...componentOverrides } as ComponentData;
    const success = this.slideManager.addComponent(slideId, merged);
    if (!success) return null;
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory(`Component added: ${type}`);
    this.emit('component:added', merged);
    return merged;
  }

  removeComponent(componentId: string): boolean {
    if (this.activeSlideId) {
      const success = this.slideManager.removeComponent(this.activeSlideId, componentId);
      if (success) {
        this.lesson.slides = this.slideManager.getAll();
        this.touch();
        this.pushHistory('Component removed');
        this.emit('component:removed', componentId);
        return true;
      }
    }

    for (const slide of this.lesson.slides) {
      if (this.slideManager.removeComponent(slide.id, componentId)) {
        this.lesson.slides = this.slideManager.getAll();
        this.touch();
        this.pushHistory('Component removed');
        this.emit('component:removed', componentId);
        return true;
      }
    }
    return false;
  }

  updateComponent(componentId: string, updates: Partial<ComponentData>): ComponentData | null {
    const result = this.componentManager.update(this.lesson.slides, componentId, updates);
    if (!result) return null;
    this.lesson.slides = this.slideManager.getAll();
    this.touch();
    this.pushHistory('Component updated');
    this.emit('component:updated', result);
    return result;
  }

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

  validate(): ValidationResult {
    return validateLesson(this.serializeLesson());
  }

  save(): Lesson {
    const lesson = this.serializeLesson();
    this.versionManager.createSnapshot(lesson);
    this.emit('lesson:updated', lesson);
    return lesson;
  }

  load(lesson: Lesson): void {
    this.lesson = JSON.parse(JSON.stringify(lesson));
    this.slideManager.setSlides(this.lesson.slides);
    this.historyManager.clear();
    this.pushHistory('Lesson loaded');
    this.emit('lesson:loaded', this.serializeLesson());
  }

  importFromMarkdown(markdown: string): ImportResult {
    const result = MarkdownImporter.import(markdown);
    if (result.success && result.lesson) {
      this.load(result.lesson);
    }
    return result;
  }

  importFromHtml(html: string): ImportResult {
    const result = HtmlImporter.import(html);
    if (result.success && result.lesson) {
      this.load(result.lesson);
    }
    return result;
  }

  exportToJson(options?: Partial<ExportOptions>): string {
    return JsonExporter.export(this.serializeLesson(), options);
  }

  exportToHtml(options?: Partial<ExportOptions>): string {
    return HtmlExporter.export(this.serializeLesson(), options);
  }

  exportToMarkdown(options?: Partial<ExportOptions>): string {
    return MarkdownExporter.export(this.serializeLesson(), options);
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

  on<K extends keyof EditorEvents>(event: K, callback: EventCallback<EditorEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  off<K extends keyof EditorEvents>(event: K, callback: EventCallback<EditorEvents[K]>): void {
    this.listeners.get(event)?.delete(callback as EventCallback);
  }

  loadTemplate(templateId: string): void {
    const template = this.templateManager.getTemplate(templateId);
    if (template) {
      this.load(template.lesson);
    }
  }

  private emit<K extends keyof EditorEvents>(event: K, data: EditorEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(data);
      }
    }
  }

  private pushHistory(description: string): void {
    this.historyManager.push(this.serializeLesson(), description);
  }

  private touch(): void {
    this.lesson.updatedAt = new Date().toISOString();
  }

  private serializeLesson(): Lesson {
    return {
      ...this.lesson,
      metadata: { ...this.lesson.metadata },
      theme: { ...this.lesson.theme },
      slides: this.slideManager.getAll(),
    };
  }

  private restoreSnapshot(snapshot: Lesson): void {
    this.lesson = JSON.parse(JSON.stringify(snapshot));
    this.slideManager.setSlides(this.lesson.slides);
  }
}
