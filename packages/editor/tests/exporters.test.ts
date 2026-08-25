import { describe, it, expect } from 'vitest';
import { JsonExporter } from '../src/exporters/json-exporter.js';
import { HtmlExporter } from '../src/exporters/html-exporter.js';
import { MarkdownExporter } from '../src/exporters/markdown-exporter.js';
import type { Lesson } from '../src/types.js';
import { SlideLayout, SlideTransition, ComponentType } from '../src/types.js';

function makeTestLesson(): Lesson {
  return {
    id: 'test-lesson',
    title: 'Test Lesson',
    description: 'A test lesson for exports',
    version: '1.0.0',
    metadata: {
      author: 'Test Author',
      description: 'A test lesson for exports',
      tags: ['test', 'demo'],
      language: 'en',
      difficulty: 'beginner',
      estimatedMinutes: 10,
      category: 'test',
    },
    theme: {
      id: 'theme-1',
      name: 'Default',
      primaryColor: '#3b82f6',
      secondaryColor: '#60a5fa',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      borderRadius: 8,
    },
    slides: [
      {
        id: 'slide-1',
        title: 'Introduction',
        layout: SlideLayout.Title,
        transition: SlideTransition.Fade,
        duration: 30,
        components: [
          {
            id: 'comp-1',
            type: ComponentType.Text,
            position: { x: 40, y: 120 },
            size: { width: 720, height: 100 },
            style: { fontSize: 32, fontWeight: 'bold' },
            locked: false,
            visible: true,
            name: 'Title Text',
            content: 'Welcome to the lesson',
            markdown: false,
          },
          {
            id: 'comp-2',
            type: ComponentType.Image,
            position: { x: 200, y: 250 },
            size: { width: 400, height: 300 },
            style: {},
            locked: false,
            visible: true,
            name: 'Hero Image',
            src: 'hero.png',
            alt: 'Hero image',
            caption: 'Welcome image',
            objectFit: 'cover',
          },
        ],
        backgroundColor: '#f0f4f8',
        backgroundImage: '',
        notes: 'Welcome the audience',
        locked: false,
        visible: true,
      },
      {
        id: 'slide-2',
        title: 'Content',
        layout: SlideLayout.Content,
        transition: SlideTransition.SlideLeft,
        duration: 0,
        components: [
          {
            id: 'comp-3',
            type: ComponentType.Text,
            position: { x: 40, y: 80 },
            size: { width: 720, height: 200 },
            style: {},
            locked: false,
            visible: true,
            name: 'Content Text',
            content: 'This is the main content of the lesson.',
            markdown: false,
          },
        ],
        backgroundColor: '#ffffff',
        backgroundImage: '',
        notes: '',
        locked: false,
        visible: true,
      },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('JsonExporter', () => {
  it('should export a lesson to JSON', () => {
    const lesson = makeTestLesson();
    const json = JsonExporter.export(lesson);
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe('Test Lesson');
    expect(parsed.slides).toHaveLength(2);
  });

  it('should export with metadata', () => {
    const lesson = makeTestLesson();
    const json = JsonExporter.export(lesson, { includeMetadata: true });
    const parsed = JSON.parse(json);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.theme).toBeDefined();
  });

  it('should export without metadata', () => {
    const lesson = makeTestLesson();
    const json = JsonExporter.export(lesson, { includeMetadata: false });
    const parsed = JSON.parse(json);
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.theme).toBeUndefined();
  });

  it('should export minified', () => {
    const lesson = makeTestLesson();
    const json = JsonExporter.export(lesson, { pretty: false });
    expect(json).not.toContain('\n');
  });

  it('should parse valid JSON', () => {
    const lesson = makeTestLesson();
    const json = JsonExporter.export(lesson);
    const parsed = JsonExporter.parse(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('Test Lesson');
  });

  it('should return null for invalid JSON', () => {
    expect(JsonExporter.parse('not json')).toBeNull();
  });

  it('should return null for JSON missing required fields', () => {
    expect(JsonExporter.parse('{}')).toBeNull();
  });

  it('should validate valid JSON', () => {
    const lesson = makeTestLesson();
    const json = JsonExporter.export(lesson);
    const result = JsonExporter.validate(json);
    expect(result.valid).toBe(true);
  });

  it('should detect invalid JSON', () => {
    const result = JsonExporter.validate('not json');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid JSON');
  });

  it('should detect missing fields', () => {
    const result = JsonExporter.validate('{"id": "1"}');
    expect(result.valid).toBe(false);
  });
});

describe('HtmlExporter', () => {
  it('should export a lesson to HTML', () => {
    const lesson = makeTestLesson();
    const html = HtmlExporter.export(lesson);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Lesson');
    expect(html).toContain('Introduction');
    expect(html).toContain('Content');
  });

  it('should include metadata in HTML', () => {
    const lesson = makeTestLesson();
    const html = HtmlExporter.export(lesson, { includeMetadata: true });
    expect(html).toContain('meta name="description"');
    expect(html).toContain('meta name="author"');
    expect(html).toContain('meta name="subject"');
    expect(html).toContain('meta name="topic"');
    expect(html).toContain('meta name="difficulty"');
    expect(html).toContain('meta name="language"');
    expect(html).toContain('meta name="duration"');
    expect(html).toContain('meta name="grade_level"');
    expect(html).toContain('meta name="keywords"');
    expect(html).toContain('meta name="prerequisites"');
    expect(html).toContain('meta name="learning_objectives"');
  });

  it('should render text components', () => {
    const lesson = makeTestLesson();
    const html = HtmlExporter.export(lesson);
    expect(html).toContain('Welcome to the lesson');
  });

  it('should render image components', () => {
    const lesson = makeTestLesson();
    const html = HtmlExporter.export(lesson);
    expect(html).toContain('hero.png');
    expect(html).toContain('alt="Hero image"');
  });

  it('should include CSS styles', () => {
    const lesson = makeTestLesson();
    const html = HtmlExporter.export(lesson);
    expect(html).toContain('<style>');
    expect(html).toContain('.slide');
  });
});

describe('MarkdownExporter', () => {
  it('should export a lesson to markdown', () => {
    const lesson = makeTestLesson();
    const md = MarkdownExporter.export(lesson);
    expect(md).toContain('# Test Lesson');
    expect(md).toContain('## Introduction');
    expect(md).toContain('## Content');
  });

  it('should include metadata in markdown', () => {
    const lesson = makeTestLesson();
    const md = MarkdownExporter.export(lesson, { includeMetadata: true });
    expect(md).toContain('Test Author');
    expect(md).toContain('beginner');
    expect(md).toContain('10 minutes');
    expect(md).toContain('test, demo');
  });

  it('should render text components', () => {
    const lesson = makeTestLesson();
    const md = MarkdownExporter.export(lesson);
    expect(md).toContain('Welcome to the lesson');
  });

  it('should render image components', () => {
    const lesson = makeTestLesson();
    const md = MarkdownExporter.export(lesson);
    expect(md).toContain('![Hero image](hero.png)');
    expect(md).toContain('*Welcome image*');
  });

  it('should include slide notes', () => {
    const lesson = makeTestLesson();
    const md = MarkdownExporter.export(lesson);
    expect(md).toContain('Welcome the audience');
  });

  it('should use separators between slides', () => {
    const lesson = makeTestLesson();
    const md = MarkdownExporter.export(lesson);
    expect(md).toContain('---');
  });
});
