import type { Lesson } from '../types.js';
import { SlideLayout, SlideTransition } from '../types.js';
import { generateId } from '../utils/id-generator.js';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  lesson: Lesson;
  thumbnail: string;
  tags: string[];
  createdAt: string;
}

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

const BUILTIN_TEMPLATES: Template[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
];

export class TemplateManager {
  private templates: Map<string, Template> = new Map();

  constructor() {
    for (const template of BUILTIN_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  getAll(): Template[] {
    return Array.from(this.templates.values());
  }

  getById(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getByCategory(category: string): Template[] {
    return this.getAll().filter((t) => t.category === category);
  }

  search(query: string): Template[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lower))
    );
  }

  register(template: Omit<Template, 'id' | 'createdAt'>): Template {
    const id = generateId();
    const full: Template = {
      ...template,
      id,
      createdAt: new Date().toISOString(),
    };
    this.templates.set(id, full);
    return full;
  }

  unregister(id: string): boolean {
    if (BUILTIN_TEMPLATES.some((t) => t.id === id)) return false;
    return this.templates.delete(id);
  }

  duplicate(id: string, newName?: string): Template | null {
    const original = this.templates.get(id);
    if (!original) return null;
    const duplicate: Template = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
      name: newName ?? `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
    };
    this.templates.set(duplicate.id, duplicate);
    return duplicate;
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const template of this.templates.values()) {
      categories.add(template.category);
    }
    return Array.from(categories);
  }

  createLessonFromTemplate(templateId: string): Lesson | null {
    const template = this.templates.get(templateId);
    if (!template) return null;
    return JSON.parse(JSON.stringify(template.lesson));
  }
}
