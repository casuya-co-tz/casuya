import type { Lesson } from '../types.js';
import { generateId } from '../utils/id-generator.js';
import { BUILTIN_TEMPLATE_FACTORIES } from './builtin-templates.js';

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

export class TemplateManager {
  private templates: Map<string, Template> = new Map();

  constructor() {
    for (const factory of BUILTIN_TEMPLATE_FACTORIES) {
      const template = factory();
      if (template) {
        this.templates.set(template.id, template);
      }
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
    if (BUILTIN_TEMPLATE_FACTORIES.some((f) => f().id === id)) return false;
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