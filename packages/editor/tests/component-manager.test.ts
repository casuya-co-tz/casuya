import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentManager } from '../src/core/component-manager.js';
import { SlideManager } from '../src/core/slide-manager.js';
import { ComponentType } from '../src/types.js';

describe('ComponentManager', () => {
  let manager: ComponentManager;
  let slideManager: SlideManager;

  beforeEach(() => {
    manager = new ComponentManager();
    slideManager = new SlideManager();
  });

  it('should create a text component', () => {
    const component = manager.create(ComponentType.Text);
    expect(component.type).toBe(ComponentType.Text);
    expect(component.id).toBeTruthy();
  });

  it('should create a component with a custom id', () => {
    const component = manager.create(ComponentType.Image, 'custom-id');
    expect(component.id).toBe('custom-id');
  });

  it('should create different component types', () => {
    expect(manager.create(ComponentType.Text).type).toBe(ComponentType.Text);
    expect(manager.create(ComponentType.Image).type).toBe(ComponentType.Image);
    expect(manager.create(ComponentType.Video).type).toBe(ComponentType.Video);
    expect(manager.create(ComponentType.Audio).type).toBe(ComponentType.Audio);
    expect(manager.create(ComponentType.Quiz).type).toBe(ComponentType.Quiz);
    expect(manager.create(ComponentType.Form).type).toBe(ComponentType.Form);
    expect(manager.create(ComponentType.Container).type).toBe(ComponentType.Container);
  });

  it('should throw for unknown component type', () => {
    expect(() => manager.create('unknown' as any)).toThrow('Unknown component type');
  });

  it('should find a component by id across slides', () => {
    const slide = slideManager.add('Slide 1');
    const component = manager.create(ComponentType.Text, 'find-me');
    slideManager.addComponent(slide.id, component);

    const found = manager.findById(slideManager.getAll(), 'find-me');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('find-me');
  });

  it('should return null when component not found', () => {
    const found = manager.findById([], 'non-existent');
    expect(found).toBeNull();
  });

  it('should find component on a specific slide', () => {
    const added = slideManager.add('Slide 1');
    const component = manager.create(ComponentType.Text, 'on-slide');
    slideManager.addComponent(added.id, component);
    const slide = slideManager.getById(added.id)!;

    const found = manager.findOnSlide(slide, 'on-slide');
    expect(found).not.toBeNull();
  });

  it('should update a component', () => {
    const slide = slideManager.add('Slide 1');
    const component = manager.create(ComponentType.Text, 'update-me');
    slideManager.addComponent(slide.id, component);

    const updated = manager.update(slideManager.getAll(), 'update-me', { name: 'Updated' });
    expect(updated?.name).toBe('Updated');
  });

  it('should remove a component', () => {
    const added = slideManager.add('Slide 1');
    const component = manager.create(ComponentType.Text, 'remove-me');
    slideManager.addComponent(added.id, component);

    const allSlides = slideManager.getAll();
    const removed = manager.remove(allSlides, 'remove-me');
    expect(removed).toBe(true);
    expect(manager.findById(allSlides, 'remove-me')).toBeNull();
  });

  it('should duplicate a component', () => {
    const slide = slideManager.add('Slide 1');
    const component = manager.create(ComponentType.Text, 'dup-me');
    slideManager.addComponent(slide.id, component);

    const dup = manager.duplicate(slideManager.getAll(), 'dup-me');
    expect(dup).not.toBeNull();
    expect(dup?.id).not.toBe('dup-me');
  });

  it('should get all components by type', () => {
    const slide1 = slideManager.add('Slide 1');
    const slide2 = slideManager.add('Slide 2');
    slideManager.addComponent(slide1.id, manager.create(ComponentType.Text, 't1'));
    slideManager.addComponent(slide1.id, manager.create(ComponentType.Image, 'i1'));
    slideManager.addComponent(slide2.id, manager.create(ComponentType.Text, 't2'));

    const texts = manager.getAllByType(slideManager.getAll(), ComponentType.Text);
    expect(texts).toHaveLength(2);
  });

  it('should get statistics', () => {
    const slide = slideManager.add('Slide 1');
    slideManager.addComponent(slide.id, manager.create(ComponentType.Text, 't1'));
    slideManager.addComponent(slide.id, manager.create(ComponentType.Text, 't2'));
    slideManager.addComponent(slide.id, manager.create(ComponentType.Image, 'i1'));

    const stats = manager.getStatistics(slideManager.getAll());
    expect(stats[ComponentType.Text]).toBe(2);
    expect(stats[ComponentType.Image]).toBe(1);
    expect(stats[ComponentType.Video]).toBe(0);
  });

  it('should reorder components on a slide', () => {
    const added = slideManager.add('Slide 1');
    slideManager.addComponent(added.id, manager.create(ComponentType.Text, 'first'));
    slideManager.addComponent(added.id, manager.create(ComponentType.Image, 'second'));
    const slide = slideManager.getById(added.id)!;

    const reordered = manager.reorderOnSlide(slide, 0, 1);
    expect(reordered).toBe(true);
    expect(slide.components[0]?.id).toBe('second');
    expect(slide.components[1]?.id).toBe('first');
  });

  it('should move component to another slide', () => {
    const added1 = slideManager.add('Slide 1');
    const added2 = slideManager.add('Slide 2');
    slideManager.addComponent(added1.id, manager.create(ComponentType.Text, 'movable'));

    const allSlides = slideManager.getAll();
    const moved = manager.moveToSlide(allSlides, 'movable', added2.id);
    expect(moved).toBe(true);

    const slide1 = allSlides.find((s) => s.id === added1.id)!;
    const slide2 = allSlides.find((s) => s.id === added2.id)!;
    expect(manager.findOnSlide(slide1, 'movable')).toBeNull();
    expect(manager.findOnSlide(slide2, 'movable')).not.toBeNull();
  });

  it('should register a custom factory', () => {
    manager.registerFactory(ComponentType.Text, (id) => ({
      id,
      type: ComponentType.Text,
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      style: {},
      locked: false,
      visible: true,
      name: 'Custom Text',
      content: 'custom',
      markdown: false,
    }));

    const component = manager.create(ComponentType.Text);
    expect(component.name).toBe('Custom Text');
  });
});
