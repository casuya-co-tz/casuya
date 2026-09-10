import type { Template } from './template-manager.js';
import { SlideLayout, SlideTransition } from '../types.js';
import { generateId } from '../utils/id-generator.js';

function createDefaultTheme() {
  return {
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
}

export function blankTemplate(): Template {
  return {
    id: 'blank',
    name: 'Blank Lesson',
    description: 'Start from scratch with a blank lesson',
    category: 'basic',
    thumbnail: '',
    tags: ['blank', 'starter'],
    createdAt: new Date().toISOString(),
    lesson: {
      id: generateId(),
      title: 'New Lesson',
      description: '',
      version: '1.0.0',
      metadata: {
        author: '',
        description: '',
        tags: [],
        language: 'en',
        difficulty: 'beginner',
        estimatedMinutes: 0,
        category: '',
      },
      theme: createDefaultTheme(),
      slides: [
        {
          id: generateId(),
          title: 'Title Slide',
          layout: SlideLayout.Title,
          transition: SlideTransition.None,
          duration: 0,
          components: [],
          backgroundColor: '#ffffff',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function presentationTemplate(): Template {
  return {
    id: 'presentation',
    name: 'Presentation',
    description: 'A classic slide presentation format',
    category: 'presentations',
    thumbnail: '',
    tags: ['presentation', 'slides'],
    createdAt: new Date().toISOString(),
    lesson: {
      id: generateId(),
      title: 'Presentation',
      description: 'A presentation template',
      version: '1.0.0',
      metadata: {
        author: '',
        description: 'Presentation template',
        tags: ['presentation'],
        language: 'en',
        difficulty: 'beginner',
        estimatedMinutes: 15,
        category: 'presentations',
      },
      theme: createDefaultTheme(),
      slides: [
        {
          id: generateId(),
          title: 'Title',
          layout: SlideLayout.Title,
          transition: SlideTransition.Fade,
          duration: 0,
          components: [],
          backgroundColor: '#3b82f6',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
        {
          id: generateId(),
          title: 'Content',
          layout: SlideLayout.Content,
          transition: SlideTransition.SlideLeft,
          duration: 0,
          components: [],
          backgroundColor: '#ffffff',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
        {
          id: generateId(),
          title: 'Conclusion',
          layout: SlideLayout.Content,
          transition: SlideTransition.Fade,
          duration: 0,
          components: [],
          backgroundColor: '#ffffff',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function quizTemplate(): Template {
  return {
    id: 'quiz',
    name: 'Quiz',
    description: 'An interactive quiz template',
    category: 'quizzes',
    thumbnail: '',
    tags: ['quiz', 'assessment'],
    createdAt: new Date().toISOString(),
    lesson: {
      id: generateId(),
      title: 'Quiz',
      description: 'A quiz template',
      version: '1.0.0',
      metadata: {
        author: '',
        description: 'Quiz template',
        tags: ['quiz'],
        language: 'en',
        difficulty: 'beginner',
        estimatedMinutes: 10,
        category: 'quizzes',
      },
      theme: createDefaultTheme(),
      slides: [
        {
          id: generateId(),
          title: 'Quiz Introduction',
          layout: SlideLayout.Title,
          transition: SlideTransition.None,
          duration: 0,
          components: [],
          backgroundColor: '#ffffff',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
        {
          id: generateId(),
          title: 'Questions',
          layout: SlideLayout.Content,
          transition: SlideTransition.None,
          duration: 0,
          components: [],
          backgroundColor: '#ffffff',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function notesTemplate(): Template {
  return {
    id: 'notes',
    name: 'Lecture Notes',
    description: 'A template for lecture notes and study materials',
    category: 'notes',
    thumbnail: '',
    tags: ['notes', 'lecture'],
    createdAt: new Date().toISOString(),
    lesson: {
      id: generateId(),
      title: 'Lecture Notes',
      description: 'Lecture notes template',
      version: '1.0.0',
      metadata: {
        author: '',
        description: 'Lecture notes template',
        tags: ['notes'],
        language: 'en',
        difficulty: 'beginner',
        estimatedMinutes: 30,
        category: 'notes',
      },
      theme: createDefaultTheme(),
      slides: [
        {
          id: generateId(),
          title: 'Topic Overview',
          layout: SlideLayout.Content,
          transition: SlideTransition.None,
          duration: 0,
          components: [],
          backgroundColor: '#ffffff',
          backgroundImage: '',
          notes: '',
          locked: false,
          visible: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export const BUILTIN_TEMPLATE_FACTORIES: Array<() => Template> = [
  blankTemplate,
  presentationTemplate,
  quizTemplate,
  notesTemplate,
];