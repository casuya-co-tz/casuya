import type { LessonTheme, ThemeId } from '../types.js';
import { generateId } from '../utils/id-generator.js';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  theme: LessonTheme;
  isBuiltIn: boolean;
}

const BUILTIN_THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    name: 'Default',
    isBuiltIn: true,
    theme: {
      id: 'default',
      name: 'Default',
      primaryColor: '#3b82f6',
      secondaryColor: '#60a5fa',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      borderRadius: 8,
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    isBuiltIn: true,
    theme: {
      id: 'dark',
      name: 'Dark',
      primaryColor: '#818cf8',
      secondaryColor: '#a5b4fc',
      backgroundColor: '#111827',
      textColor: '#f9fafb',
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      borderRadius: 8,
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    isBuiltIn: true,
    theme: {
      id: 'ocean',
      name: 'Ocean',
      primaryColor: '#0891b2',
      secondaryColor: '#22d3ee',
      backgroundColor: '#ecfeff',
      textColor: '#164e63',
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      borderRadius: 12,
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    isBuiltIn: true,
    theme: {
      id: 'forest',
      name: 'Forest',
      primaryColor: '#16a34a',
      secondaryColor: '#4ade80',
      backgroundColor: '#f0fdf4',
      textColor: '#14532d',
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      borderRadius: 8,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    isBuiltIn: true,
    theme: {
      id: 'sunset',
      name: 'Sunset',
      primaryColor: '#ea580c',
      secondaryColor: '#fb923c',
      backgroundColor: '#fff7ed',
      textColor: '#7c2d12',
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      borderRadius: 16,
    },
  },
];

export class ThemeManager {
  private themes: Map<ThemeId, ThemeDefinition> = new Map();

  constructor() {
    for (const theme of BUILTIN_THEMES) {
      this.themes.set(theme.id, theme);
    }
  }

  getAll(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  getById(id: ThemeId): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  getTheme(id: ThemeId): LessonTheme | undefined {
    return this.themes.get(id)?.theme;
  }

  register(name: string, theme: Omit<LessonTheme, 'id' | 'name'>): ThemeDefinition {
    const id = generateId() as ThemeId;
    const definition: ThemeDefinition = {
      id,
      name,
      isBuiltIn: false,
      theme: { ...theme, id, name },
    };
    this.themes.set(id, definition);
    return definition;
  }

  unregister(id: ThemeId): boolean {
    const theme = this.themes.get(id);
    if (theme?.isBuiltIn) return false;
    return this.themes.delete(id);
  }

  update(id: ThemeId, updates: Partial<LessonTheme>): boolean {
    const definition = this.themes.get(id);
    if (!definition) return false;
    definition.theme = { ...definition.theme, ...updates };
    return true;
  }

  applyTheme(lessonTheme: LessonTheme, customizations: Partial<LessonTheme>): LessonTheme {
    return { ...lessonTheme, ...customizations };
  }

  generateCssVariables(theme: LessonTheme): string {
    return [
      `--primary-color: ${theme.primaryColor}`,
      `--secondary-color: ${theme.secondaryColor}`,
      `--background-color: ${theme.backgroundColor}`,
      `--text-color: ${theme.textColor}`,
      `--heading-font: ${theme.headingFont}`,
      `--body-font: ${theme.bodyFont}`,
      `--border-radius: ${theme.borderRadius}px`,
    ].join('; ');
  }

  getBuiltInThemes(): ThemeDefinition[] {
    return this.getAll().filter((t) => t.isBuiltIn);
  }

  getCustomThemes(): ThemeDefinition[] {
    return this.getAll().filter((t) => !t.isBuiltIn);
  }
}
