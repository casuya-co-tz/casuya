import { describe, it, expect, beforeEach } from 'vitest';
import { SlideManager } from '../src/core/slide-manager.js';

describe('SlideManager', () => {
  let manager: SlideManager;

  beforeEach(() => {
    manager = new SlideManager();
  });

  it('should start empty', () => {
    expect(manager.count).toBe(0);
    expect(manager.isEmpty).toBe(true);
  });

  it('should add a slide', () => {
    const slide = manager.add('First Slide');
    expect(slide.title).toBe('First Slide');
    expect(slide.id).toBeTruthy();
    expect(manager.count).toBe(1);
  });

  it('should add a slide at a specific index', () => {
    manager.add('Slide 1');
    manager.add('Slide 3');
    const added = manager.addAt(1, 'Slide 2');
    expect(added).not.toBeNull();
    const all = manager.getAll();
    expect(all[1]?.title).toBe('Slide 2');
    expect(manager.count).toBe(3);
  });

  it('should return null when adding at invalid index', () => {
    const result = manager.addAt(-1, 'Invalid');
    expect(result).toBeNull();
    const result2 = manager.addAt(10, 'Invalid');
    expect(result2).toBeNull();
  });

  it('should get slide by id', () => {
    const slide = manager.add('Find Me');
    const found = manager.getById(slide.id);
    expect(found).not.toBeUndefined();
    expect(found?.title).toBe('Find Me');
  });

  it('should return undefined for non-existent id', () => {
    expect(manager.getById('non-existent')).toBeUndefined();
  });

  it('should get index of a slide', () => {
    const slide = manager.add('Indexed');
    expect(manager.getIndex(slide.id)).toBe(0);
    expect(manager.getIndex('non-existent')).toBe(-1);
  });

  it('should remove a slide', () => {
    const slide = manager.add('To Remove');
    const removed = manager.remove(slide.id);
    expect(removed).not.toBeNull();
    expect(manager.count).toBe(0);
  });

  it('should return null when removing non-existent slide', () => {
    expect(manager.remove('non-existent')).toBeNull();
  });

  it('should update a slide', () => {
    const slide = manager.add('Original');
    const updated = manager.update(slide.id, { title: 'Updated' });
    expect(updated?.title).toBe('Updated');
  });

  it('should return null when updating non-existent slide', () => {
    expect(manager.update('non-existent', { title: 'Nope' })).toBeNull();
  });

  it('should reorder slides', () => {
    manager.add('First');
    manager.add('Second');
    const result = manager.reorder(0, 1);
    expect(result).toBe(true);
    const all = manager.getAll();
    expect(all[0]?.title).toBe('Second');
    expect(all[1]?.title).toBe('First');
  });

  it('should reject invalid reorder indices', () => {
    manager.add('Slide');
    expect(manager.reorder(-1, 0)).toBe(false);
    expect(manager.reorder(0, 5)).toBe(false);
  });

  it('should duplicate a slide', () => {
    const slide = manager.add('Original');
    const dup = manager.duplicate(slide.id);
    expect(dup).not.toBeNull();
    expect(manager.count).toBe(2);
    expect(dup?.title).toContain('copy');
  });

  it('should return null when duplicating non-existent slide', () => {
    expect(manager.duplicate('non-existent')).toBeNull();
  });

  it('should move slide up', () => {
    manager.add('First');
    const second = manager.add('Second');
    const moved = manager.moveUp(second.id);
    expect(moved).toBe(true);
    expect(manager.getAll()[0]?.title).toBe('Second');
  });

  it('should move slide down', () => {
    const first = manager.add('First');
    manager.add('Second');
    const moved = manager.moveDown(first.id);
    expect(moved).toBe(true);
    expect(manager.getAll()[0]?.title).toBe('Second');
  });

  it('should not move up the first slide', () => {
    const first = manager.add('First');
    expect(manager.moveUp(first.id)).toBe(false);
  });

  it('should not move down the last slide', () => {
    const last = manager.add('Last');
    expect(manager.moveDown(last.id)).toBe(false);
  });

  it('should add component to slide', () => {
    const slide = manager.add('With Component');
    const result = manager.addComponent(slide.id, { id: 'comp-1', type: 'text' } as any);
    expect(result).toBe(true);
    expect(manager.getComponents(slide.id)).toHaveLength(1);
  });

  it('should remove component from slide', () => {
    const slide = manager.add('With Component');
    manager.addComponent(slide.id, { id: 'comp-1', type: 'text' } as any);
    const result = manager.removeComponent(slide.id, 'comp-1');
    expect(result).toBe(true);
    expect(manager.getComponents(slide.id)).toHaveLength(0);
  });

  it('should toggle visibility', () => {
    const slide = manager.add('Visible');
    expect(slide.visible).toBe(true);
    manager.toggleVisibility(slide.id);
    const updated = manager.getById(slide.id);
    expect(updated?.visible).toBe(false);
  });

  it('should toggle lock', () => {
    const slide = manager.add('Unlocked');
    manager.toggleLock(slide.id);
    const updated = manager.getById(slide.id);
    expect(updated?.locked).toBe(true);
  });

  it('should get visible slides', () => {
    const s1 = manager.add('Visible');
    const s2 = manager.add('Hidden');
    manager.toggleVisibility(s2.id);
    expect(manager.getVisible()).toHaveLength(1);
    expect(manager.getVisible()[0]?.id).toBe(s1.id);
  });

  it('should clear all slides', () => {
    manager.add('Slide 1');
    manager.add('Slide 2');
    manager.clear();
    expect(manager.isEmpty).toBe(true);
  });

  it('should set slides from array', () => {
    const slides = [
      { id: 's1', title: 'S1', components: [] } as any,
      { id: 's2', title: 'S2', components: [] } as any,
    ];
    manager.setSlides(slides);
    expect(manager.count).toBe(2);
  });
});
