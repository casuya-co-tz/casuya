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

export class HtmlImporter {
  static import(html: string): ImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!html || html.trim().length === 0) {
      return { success: false, errors: ['Empty HTML input'], warnings };
    }

    try {
      const slides = HtmlImporter.parseSlides(html);

      if (slides.length === 0) {
        warnings.push('No slides could be parsed from the HTML');
        slides.push(HtmlImporter.createFallbackSlide(html));
      }

      const title = HtmlImporter.extractTitle(html);
      const description = HtmlImporter.extractDescription(html);

      const lesson: Lesson = {
        id: generateId(),
        title,
        description,
        version: '1.0.0',
        metadata: {
          author: '',
          description,
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

  private static parseSlides(html: string): Slide[] {
    const slides: Slide[] = [];
    const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/gi;
    const divRegex = /<div[^>]*class="[^"]*slide[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

    let match;
    const sections: string[] = [];

    while ((match = sectionRegex.exec(html)) !== null) {
      sections.push(match[1] ?? '');
    }

    if (sections.length === 0) {
      while ((match = divRegex.exec(html)) !== null) {
        sections.push(match[1] ?? '');
      }
    }

    if (sections.length === 0 && html.trim().length > 0) {
      sections.push(html);
    }

    for (const section of sections) {
      const components: ComponentData[] = [];
      let title = 'Untitled Slide';

      const h1Match = section.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const h2Match = section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);

      if (h1Match) {
        title = HtmlImporter.stripTags(h1Match[1] ?? '');
      } else if (h2Match) {
        title = HtmlImporter.stripTags(h2Match[1] ?? '');
      }

      const imgMatches = section.matchAll(/<img[^>]+src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi);
      for (const imgMatch of imgMatches) {
        components.push({
          id: generateId(),
          type: ComponentType.Image,
          position: { x: 40, y: 120 },
          size: { width: 400, height: 300 },
          style: {},
          locked: false,
          visible: true,
          name: 'Image',
          src: imgMatch[1] ?? '',
          alt: imgMatch[2] ?? '',
          caption: imgMatch[2] ?? '',
          objectFit: 'cover',
        });
      }

      const textContent = HtmlImporter.stripTags(section).trim();
      if (textContent.length > 0) {
        components.push({
          id: generateId(),
          type: ComponentType.Text,
          position: { x: 40, y: 120 },
          size: { width: 720, height: 400 },
          style: {},
          locked: false,
          visible: true,
          name: 'Text',
          content: textContent,
          markdown: false,
        });
      }

      slides.push({
        id: generateId(),
        title,
        layout: h1Match ? SlideLayout.Title : SlideLayout.Content,
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

  private static extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) return HtmlImporter.stripTags(titleMatch[1] ?? '').trim();

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) return HtmlImporter.stripTags(h1Match[1] ?? '').trim();

    return 'Imported Lesson';
  }

  private static extractDescription(html: string): string {
    const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    if (metaMatch) return metaMatch[1] ?? '';

    const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) return HtmlImporter.stripTags(pMatch[1] ?? '').substring(0, 200);

    return '';
  }

  private static stripTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static createFallbackSlide(html: string): Slide {
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
          content: HtmlImporter.stripTags(html),
          markdown: false,
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
