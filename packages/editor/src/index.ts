export const VERSION = '0.1.0';

export type {
  ComponentId,
  SlideId,
  LessonId,
  ThemeId,
  VersionId,
  Position,
  Size,
  BoundingBox,
  ComponentStyle,
  BaseComponentData,
  TextComponentData,
  ImageComponentData,
  VideoComponentData,
  AudioComponentData,
  QuizOption,
  QuizQuestion,
  QuizComponentData,
  FormField,
  FormComponentData,
  ContainerComponentData,
  ComponentData,
  Slide,
  LessonMetadata,
  LessonTheme,
  Lesson,
  VersionSnapshot,
  ImportResult,
  ExportOptions,
  ValidationResult,
  ValidationError,
  AccessibilityCheck,
  AccessibilityIssue,
  AutoSaveConfig,
  HistoryEntry,
  EventCallback,
  EditorEvents,
} from './types.js';

export {
  ComponentType,
  SlideLayout,
  SlideTransition,
} from './types.js';

export { generateId, generateUUID, generateShortId, generateVersionId, generateSequentialId, resetCounter } from './utils/id-generator.js';
export {
  validateLesson,
  validateSlide,
  validateComponent,
  isValidColor,
  isValidJsonString,
  sanitizeString,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
} from './utils/validation.js';

export { BaseComponent } from './components/base-component.js';
export { TextComponent } from './components/text-component.js';
export { ImageComponent } from './components/image-component.js';
export { VideoComponent } from './components/video-component.js';
export { AudioComponent } from './components/audio-component.js';
export { QuizComponent } from './components/quiz-component.js';
export { FormComponent } from './components/form-component.js';
export { ContainerComponent } from './components/container-component.js';

export { HistoryManager } from './core/history-manager.js';
export { SlideManager } from './core/slide-manager.js';
export { ComponentManager } from './core/component-manager.js';
export { LessonBuilder } from './core/lesson-builder.js';

export { MarkdownImporter } from './importers/markdown-importer.js';
export { HtmlImporter } from './importers/html-importer.js';

export { JsonExporter } from './exporters/json-exporter.js';
export { HtmlExporter } from './exporters/html-exporter.js';
export { MarkdownExporter } from './exporters/markdown-exporter.js';

export type { Template } from './templates/template-manager.js';
export { TemplateManager } from './templates/template-manager.js';

export type { ThemeDefinition } from './themes/theme-manager.js';
export { ThemeManager } from './themes/theme-manager.js';

export { AutoSave } from './autosave/auto-save.js';

export { VersionManager } from './versioning/version-manager.js';

export { AccessibilityManager } from './accessibility/accessibility-manager.js';
