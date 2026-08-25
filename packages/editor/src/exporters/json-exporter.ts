import type { Lesson, ExportOptions } from '../types.js';

const DEFAULT_OPTIONS: ExportOptions = {
  pretty: true,
  includeMetadata: true,
  version: '1.0.0',
};

export class JsonExporter {
  static export(lesson: Lesson, options?: Partial<ExportOptions>): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const data: Record<string, unknown> = {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      version: opts.version,
      slides: lesson.slides,
    };

    if (opts.includeMetadata) {
      data.metadata = lesson.metadata;
      data.theme = lesson.theme;
      data.createdAt = lesson.createdAt;
      data.updatedAt = lesson.updatedAt;
    }

    return opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  static parse(jsonString: string): Lesson | null {
    try {
      const data = JSON.parse(jsonString) as Record<string, unknown>;

      if (!data.id || !data.title || !data.slides) {
        return null;
      }

      return {
        id: data.id as string,
        title: data.title as string,
        description: (data.description as string) ?? '',
        version: (data.version as string) ?? '1.0.0',
        metadata: (data.metadata as Lesson['metadata']) ?? {
          author: '',
          description: '',
          tags: [],
          language: 'en',
          difficulty: 'beginner',
          estimatedMinutes: 0,
          category: '',
        },
        theme: (data.theme as Lesson['theme']) ?? {
          id: '',
          name: 'Default',
          primaryColor: '#3b82f6',
          secondaryColor: '#60a5fa',
          backgroundColor: '#ffffff',
          textColor: '#1f2937',
          headingFont: 'Inter, sans-serif',
          bodyFont: 'Inter, sans-serif',
          borderRadius: 8,
        },
        slides: data.slides as Lesson['slides'],
        createdAt: (data.createdAt as string) ?? new Date().toISOString(),
        updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  static validate(jsonString: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const data = JSON.parse(jsonString) as Record<string, unknown>;
      if (!data.id) errors.push('Missing lesson ID');
      if (!data.title) errors.push('Missing lesson title');
      if (!Array.isArray(data.slides)) errors.push('Missing slides array');
    } catch {
      errors.push('Invalid JSON');
      return { valid: false, errors };
    }

    return { valid: errors.length === 0, errors };
  }
}
