export type ComponentId = string;
export type SlideId = string;
export type LessonId = string;
export type ThemeId = string;
export type VersionId = string;

export enum ComponentType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Quiz = 'quiz',
  Form = 'form',
  Container = 'container',
}

export enum SlideLayout {
  Title = 'title',
  Content = 'content',
  TwoColumn = 'two-column',
  ImageLeft = 'image-left',
  ImageRight = 'image-right',
  Blank = 'blank',
}

export enum SlideTransition {
  None = 'none',
  Fade = 'fade',
  SlideLeft = 'slide-left',
  SlideRight = 'slide-right',
  SlideUp = 'slide-up',
  SlideDown = 'slide-down',
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentStyle {
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  borderRadius?: number;
  border?: string;
  padding?: number;
  opacity?: number;
  rotation?: number;
  zIndex?: number;
}

export interface BaseComponentData {
  id: ComponentId;
  type: ComponentType;
  position: Position;
  size: Size;
  style: ComponentStyle;
  locked: boolean;
  visible: boolean;
  name: string;
}

export interface TextComponentData extends BaseComponentData {
  type: ComponentType.Text;
  content: string;
  markdown: boolean;
}

export interface ImageComponentData extends BaseComponentData {
  type: ComponentType.Image;
  src: string;
  alt: string;
  caption: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
}

export interface VideoComponentData extends BaseComponentData {
  type: ComponentType.Video;
  src: string;
  poster: string;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
}

export interface AudioComponentData extends BaseComponentData {
  type: ComponentType.Audio;
  src: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options: QuizOption[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

export interface QuizComponentData extends BaseComponentData {
  type: ComponentType.Quiz;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
  showFeedback: boolean;
  randomizeOptions: boolean;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required: boolean;
  placeholder: string;
  options: string[];
  validation: string;
}

export interface FormComponentData extends BaseComponentData {
  type: ComponentType.Form;
  title: string;
  fields: FormField[];
  submitLabel: string;
  action: string;
}

export interface ContainerComponentData extends BaseComponentData {
  type: ComponentType.Container;
  children: ComponentId[];
  direction: 'row' | 'column';
  gap: number;
  overflow: 'visible' | 'hidden' | 'scroll';
}

export type ComponentData =
  | TextComponentData
  | ImageComponentData
  | VideoComponentData
  | AudioComponentData
  | QuizComponentData
  | FormComponentData
  | ContainerComponentData;

export interface Slide {
  id: SlideId;
  title: string;
  layout: SlideLayout;
  transition: SlideTransition;
  duration: number;
  components: ComponentData[];
  backgroundColor: string;
  backgroundImage: string;
  notes: string;
  locked: boolean;
  visible: boolean;
}

export interface LessonMetadata {
  author: string;
  description: string;
  tags: string[];
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  category: string;
}

export interface LessonTheme {
  id: ThemeId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: number;
}

export interface Lesson {
  id: LessonId;
  title: string;
  description: string;
  version: string;
  metadata: LessonMetadata;
  theme: LessonTheme;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

export interface VersionSnapshot {
  id: VersionId;
  lessonId: LessonId;
  version: string;
  lesson: Lesson;
  label: string;
  createdAt: string;
}

export interface ImportResult {
  success: boolean;
  lesson?: Lesson;
  errors: string[];
  warnings: string[];
}

export interface ExportOptions {
  pretty: boolean;
  includeMetadata: boolean;
  version: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface AccessibilityCheck {
  componentId: ComponentId;
  issues: AccessibilityIssue[];
}

export interface AccessibilityIssue {
  type: 'missing-alt' | 'missing-label' | 'low-contrast' | 'missing-heading' | 'missing-lang';
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMs: number;
  maxRetries: number;
  storageKey: string;
}

export interface HistoryEntry {
  timestamp: number;
  description: string;
  lessonSnapshot: Lesson;
}

export type EventCallback<T = unknown> = (data: T) => void;

export interface EditorEvents {
  'lesson:created': Lesson;
  'lesson:updated': Lesson;
  'lesson:loaded': Lesson;
  'slide:added': Slide;
  'slide:removed': SlideId;
  'slide:updated': Slide;
  'slide:reordered': Slide[];
  'component:added': ComponentData;
  'component:removed': ComponentId;
  'component:updated': ComponentData;
  'history:undo': HistoryEntry;
  'history:redo': HistoryEntry;
  'autosave:saved': { timestamp: number };
  'autosave:error': Error;
  'theme:applied': LessonTheme;
  'version:created': VersionSnapshot;
}
