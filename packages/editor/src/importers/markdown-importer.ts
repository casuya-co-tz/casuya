import type { ImportResult, Lesson, Slide, ComponentData } from '../types.js';
import { SlideLayout, ComponentType, SlideTransition } from '../types.js';
import { generateId } from '../utils/id-generator.js';

const DEFAULT_THEME = {
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

export class MarkdownImporter {
  static import(markdown: string): ImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!markdown || markdown.trim().length === 0) {
      return { success: false, errors: ['Empty markdown input'], warnings };
    }

    try {
      const slides = MarkdownImporter.parseSlides(markdown);

      if (slides.length === 0) {
        warnings.push('No slides could be parsed from the markdown');
        slides.push(MarkdownImporter.createFallbackSlide(markdown));
      }

      const lesson: Lesson = {
        id: generateId(),
        title: MarkdownImporter.extractTitle(markdown),
        description: MarkdownImporter.extractDescription(markdown),
        version: '1.0.0',
        metadata: {
          author: '',
          description: MarkdownImporter.extractDescription(markdown),
          tags: [],
          language: 'en',
          difficulty: 'beginner',
          estimatedMinutes: slides.length * 5,
          category: '',
        },
        theme: DEFAULT_THEME,
        slides,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return { success: true, lesson, errors, warnings };
    } catch (err) {
      errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, errors, warnings };
    }
  }

  private static parseSlides(markdown: string): Slide[] {
    const slides: Slide[] = [];
    const sections = markdown.split(/^---$/m).filter((s) => s.trim().length > 0);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      let title = 'Untitled Slide';
      let content = '';
      let isTitle = false;

      for (const line of lines) {
        const h1Match = line.match(/^#\s+(.+)/);
        const h2Match = line.match(/^##\s+(.+)/);

        if (h1Match) {
          title = h1Match[1].trim();
          isTitle = true;
        } else if (h2Match && isTitle) {
          content += line + '\n';
        } else if (h2Match) {
          title = h2Match[1].trim();
          isTitle = true;
        } else {
          content += line + '\n';
        }
      }

      const components: ComponentData[] = [];
      const trimmedContent = content.trim();

      if (trimmedContent.length > 0) {
        components.push({
          id: generateId(),
          type: ComponentType.Text,
          position: { x: 40, y: 120 },
          size: { width: 720, height: 400 },
          style: {},
          locked: false,
          visible: true,
          name: 'Text',
          content: trimmedContent,
          markdown: true,
        });
      }

      const imageMatches = trimmedContent.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of imageMatches) {
        const alt = match[1] ?? '';
        const src = match[2] ?? '';
        components.push({
          id: generateId(),
          type: ComponentType.Image,
          position: { x: 40, y: 120 },
          size: { width: 400, height: 300 },
          style: {},
          locked: false,
          visible: true,
          name: 'Image',
          src,
          alt,
          caption: alt,
          objectFit: 'cover',
        });
      }

      const layout = isTitle ? SlideLayout.Title : SlideLayout.Content;

      slides.push({
        id: generateId(),
        title,
        layout,
        transition: SlideTransition.None,
        duration: 0,
        components,
        backgroundColor: '#ffffff',
        backgroundImage: '',
        notes: '',
        locked: false,
        visible: true,
      });
    }

    return slides;
  }

  private static extractTitle(markdown: string): string {
    const match = markdown.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : 'Imported Lesson';
  }

  private static extractDescription(markdown: string): string {
    const lines = markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        return trimmed.substring(0, 200);
      }
    }
    return '';
  }

  private static createFallbackSlide(markdown: string): Slide {
    return {
      id: generateId(),
      title: 'Imported Content',
      layout: SlideLayout.Content,
      transition: SlideTransition.None,
      duration: 0,
      components: [
        {
          id: generateId(),
          type: ComponentType.Text,
          position: { x: 40, y: 120 },
          size: { width: 720, height: 400 },
          style: {},
          locked: false,
          visible: true,
          name: 'Text',
          content: markdown,
          markdown: true,
        },
      ],
      backgroundColor: '#ffffff',
      backgroundImage: '',
      notes: '',
      locked: false,
      visible: true,
    };
  }
}
