import { describe, it, expect } from 'vitest';
import { MarkdownImporter } from '../src/importers/markdown-importer.js';
import { HtmlImporter } from '../src/importers/html-importer.js';

describe('MarkdownImporter', () => {
  it('should import a simple markdown lesson', () => {
    const md = '# My Lesson\n\n## Slide One\n\nHello world content here.';
    const result = MarkdownImporter.import(md);
    expect(result.success).toBe(true);
    expect(result.lesson).toBeDefined();
    expect(result.lesson!.title).toBe('My Lesson');
    expect(result.lesson!.slides.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty input', () => {
    const result = MarkdownImporter.import('');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle sections separated by ---', () => {
    const md = '## Slide 1\n\nContent 1\n\n---\n\n## Slide 2\n\nContent 2';
    const result = MarkdownImporter.import(md);
    expect(result.success).toBe(true);
    expect(result.lesson!.slides.length).toBe(2);
  });

  it('should extract images from markdown', () => {
    const md = '# Lesson\n\n## Slide\n\n![Alt text](image.png)';
    const result = MarkdownImporter.import(md);
    expect(result.success).toBe(true);
    const images = result.lesson!.slides[0]!.components.filter((c) => c.type === 'image');
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it('should create a fallback slide for unparseable content', () => {
    const md = 'Just some random text without headings or separators that goes on and on without any structure';
    const result = MarkdownImporter.import(md);
    expect(result.success).toBe(true);
    expect(result.lesson!.slides.length).toBe(1);
  });

  it('should provide warnings for empty sections', () => {
    const md = '';
    const result = MarkdownImporter.import(md);
    expect(result.success).toBe(false);
  });
});

describe('HtmlImporter', () => {
  it('should import HTML with sections', () => {
    const html = '<html><body><h1>HTML Lesson</h1><section><h2>Slide 1</h2><p>Content</p></section></body></html>';
    const result = HtmlImporter.import(html);
    expect(result.success).toBe(true);
    expect(result.lesson).toBeDefined();
    expect(result.lesson!.title).toBe('HTML Lesson');
  });

  it('should handle empty input', () => {
    const result = HtmlImporter.import('');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should extract title from HTML', () => {
    const html = '<html><head><title>My Title</title></head><body></body></html>';
    const result = HtmlImporter.import(html);
    expect(result.lesson!.title).toBe('My Title');
  });

  it('should extract images from HTML', () => {
    const html = '<section><img src="photo.jpg" alt="Photo"><h2>Slide</h2></section>';
    const result = HtmlImporter.import(html);
    expect(result.success).toBe(true);
    const slide = result.lesson!.slides[0];
    const images = slide!.components.filter((c) => c.type === 'image');
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract description from meta tag', () => {
    const html = '<html><head><meta name="description" content="My description"></head><body></body></html>';
    const result = HtmlImporter.import(html);
    expect(result.lesson!.description).toBe('My description');
  });

  it('should create fallback for plain content', () => {
    const html = '<p>Just a paragraph</p>';
    const result = HtmlImporter.import(html);
    expect(result.success).toBe(true);
    expect(result.lesson!.slides.length).toBe(1);
  });
});
