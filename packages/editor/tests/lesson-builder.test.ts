import { describe, it, expect, beforeEach } from 'vitest';
import { LessonBuilder } from '../src/core/lesson-builder.js';
import { SlideLayout, ComponentType } from '../src/types.js';

describe('LessonBuilder', () => {
  let builder: LessonBuilder;

  beforeEach(() => {
    builder = new LessonBuilder();
  });

  it('should create a lesson with default values', () => {
    const lesson = builder.getLesson();
    expect(lesson.id).toBeTruthy();
    expect(lesson.title).toBe('Untitled Lesson');
    expect(lesson.version).toBe('1.0.0');
    expect(lesson.slides).toEqual([]);
  });

  it('should set and get title', () => {
    builder.setTitle('My Lesson');
    expect(builder.getTitle()).toBe('My Lesson');
    expect(builder.getLesson().title).toBe('My Lesson');
  });

  it('should set and get description', () => {
    builder.setDescription('A test lesson');
    expect(builder.getDescription()).toBe('A test lesson');
  });

  it('should update metadata', () => {
    builder.updateMetadata({ author: 'Test Author', difficulty: 'advanced' });
    const metadata = builder.getMetadata();
    expect(metadata.author).toBe('Test Author');
    expect(metadata.difficulty).toBe('advanced');
  });

  it('should update theme', () => {
    builder.setTheme({ primaryColor: '#ff0000' });
    expect(builder.getTheme().primaryColor).toBe('#ff0000');
  });

  it('should add a slide', () => {
    const slide = builder.addSlide('First Slide');
    expect(slide.title).toBe('First Slide');
    expect(builder.getLesson().slides).toHaveLength(1);
  });

  it('should add a slide at a specific position', () => {
    builder.addSlide('Slide 1');
    builder.addSlide('Slide 3');
    const slide = builder.addSlideAt(1, 'Slide 2');
    expect(slide).not.toBeNull();
    expect(builder.getLesson().slides[1]?.title).toBe('Slide 2');
    expect(builder.getLesson().slides).toHaveLength(3);
  });

  it('should remove a slide', () => {
    const slide = builder.addSlide('To Remove');
    const removed = builder.removeSlide(slide.id);
    expect(removed).not.toBeNull();
    expect(builder.getLesson().slides).toHaveLength(0);
  });

  it('should update a slide', () => {
    const slide = builder.addSlide('Original');
    const updated = builder.updateSlide(slide.id, { title: 'Updated' });
    expect(updated?.title).toBe('Updated');
  });

  it('should reorder slides', () => {
    builder.addSlide('Slide 1');
    builder.addSlide('Slide 2');
    const result = builder.reorderSlides(0, 1);
    expect(result).toBe(true);
    const slides = builder.getLesson().slides;
    expect(slides[0]?.title).toBe('Slide 2');
    expect(slides[1]?.title).toBe('Slide 1');
  });

  it('should duplicate a slide', () => {
    builder.addSlide('Original');
    const original = builder.getLesson().slides[0];
    const dup = builder.duplicateSlide(original!.id);
    expect(dup).not.toBeNull();
    expect(builder.getLesson().slides).toHaveLength(2);
    expect(dup!.title).toContain('copy');
  });

  it('should add a component to a slide', () => {
    const slide = builder.addSlide('Content');
    const component = builder.addComponent(slide.id, ComponentType.Text);
    expect(component).not.toBeNull();
    expect(component!.type).toBe(ComponentType.Text);
    expect(builder.getLesson().slides[0]?.components).toHaveLength(1);
  });

  it('should remove a component', () => {
    const slide = builder.addSlide('Content');
    const component = builder.addComponent(slide.id, ComponentType.Text);
    const removed = builder.removeComponent(component!.id);
    expect(removed).toBe(true);
    expect(builder.getLesson().slides[0]?.components).toHaveLength(0);
  });

  it('should update a component', () => {
    const slide = builder.addSlide('Content');
    const component = builder.addComponent(slide.id, ComponentType.Text);
    const updated = builder.updateComponent(component!.id, { name: 'My Text' });
    expect(updated?.name).toBe('My Text');
  });

  it('should undo and redo', () => {
    builder.setTitle('Before Undo');
    expect(builder.getTitle()).toBe('Before Undo');
    const undone = builder.undo();
    expect(undone).toBe(true);
    expect(builder.getTitle()).toBe('Untitled Lesson');
    const redone = builder.redo();
    expect(redone).toBe(true);
    expect(builder.getTitle()).toBe('Before Undo');
  });

  it('should validate the lesson', () => {
    builder.setTitle('Valid Lesson');
    builder.addSlide('Slide 1');
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });

  it('should export to JSON', () => {
    builder.setTitle('JSON Export Test');
    builder.addSlide('Slide 1');
    const json = builder.exportToJson();
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe('JSON Export Test');
    expect(parsed.slides).toHaveLength(1);
  });

  it('should export to HTML', () => {
    builder.setTitle('HTML Export Test');
    builder.addSlide('Slide 1');
    const html = builder.exportToHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('HTML Export Test');
    expect(html).toContain('Slide 1');
  });

  it('should export to Markdown', () => {
    builder.setTitle('Markdown Export Test');
    builder.addSlide('Slide 1');
    const md = builder.exportToMarkdown();
    expect(md).toContain('# Markdown Export Test');
    expect(md).toContain('## Slide 1');
  });

  it('should import from Markdown', () => {
    const md = '# Imported Lesson\n\n## Slide One\n\nHello world';
    const result = builder.importFromMarkdown(md);
    expect(result.success).toBe(true);
    expect(builder.getLesson().slides.length).toBeGreaterThan(0);
  });

  it('should import from HTML', () => {
    const html = '<html><body><h1>HTML Lesson</h1><section><h2>Slide</h2><p>Content</p></section></body></html>';
    const result = builder.importFromHtml(html);
    expect(result.success).toBe(true);
  });

  it('should create and restore versions', () => {
    builder.setTitle('Versioned Lesson');
    const v1 = builder.createVersion('First version');
    builder.setTitle('Updated Lesson');
    const v2 = builder.createVersion('Second version');
    expect(v1.id).not.toBe(v2.id);
    const restored = builder.restoreVersion(v1.id);
    expect(restored).toBe(true);
  });

  it('should emit events', () => {
    let called = false;
    builder.on('lesson:updated', () => { called = true; });
    builder.setTitle('Event Test');
    expect(called).toBe(true);
  });

  it('should export and reimport JSON roundtrip', () => {
    builder.setTitle('Roundtrip');
    builder.addSlide('Slide 1');
    const json = builder.exportToJson();
    const newBuilder = new LessonBuilder();
    const parsed = JSON.parse(json);
    newBuilder.load(parsed);
    expect(newBuilder.getTitle()).toBe('Roundtrip');
    expect(newBuilder.getLesson().slides).toHaveLength(1);
  });

  it('should handle slide layout types', () => {
    const slide = builder.addSlide('Title Slide', SlideLayout.Title);
    expect(slide.layout).toBe(SlideLayout.Title);
  });

  it('should check accessibility', () => {
    const slide = builder.addSlide('Content');
    builder.addComponent(slide.id, ComponentType.Image);
    const checks = builder.checkAccessibility();
    expect(checks.length).toBeGreaterThan(0);
  });
});
