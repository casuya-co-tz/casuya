import { generateId } from '../../utils/id-generator.js';
import type { Lesson, LessonId, LessonMetadata, LessonTheme } from '../../types.js';

export const DEFAULT_THEME: LessonTheme = {
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

export const DEFAULT_METADATA: LessonMetadata = {
  author: '',
  description: '',
  tags: [],
  language: 'en',
  difficulty: 'beginner',
  estimatedMinutes: 0,
  category: '',
};

export function createDefaultLesson(lessonId?: LessonId): Lesson {
  return {
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
}