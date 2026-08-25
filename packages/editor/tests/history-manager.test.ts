import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../src/core/history-manager.js';
import type { Lesson } from '../src/types.js';

function makeLesson(title: string): Lesson {
  return {
    id: 'lesson-1',
    title,
    description: '',
    version: '1.0.0',
    metadata: {
      author: '',
      description: '',
      tags: [],
      language: 'en',
      difficulty: 'beginner',
      estimatedMinutes: 0,
      category: '',
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
    slides: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('HistoryManager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager();
  });

  it('should start with empty stacks', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });

  it('should push history entries', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    expect(history.undoCount).toBe(1);
    expect(history.canUndo).toBe(true);
  });

  it('should undo', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    history.push(makeLesson('Lesson 2'), 'Updated');
    const entry = history.undo();
    expect(entry).not.toBeNull();
    expect(entry!.lessonSnapshot.title).toBe('Lesson 1');
    expect(history.canRedo).toBe(true);
  });

  it('should return null when undoing empty history', () => {
    expect(history.undo()).toBeNull();
  });

  it('should redo', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    history.push(makeLesson('Lesson 2'), 'Updated');
    history.undo();
    const entry = history.redo();
    expect(entry).not.toBeNull();
    expect(entry!.lessonSnapshot.title).toBe('Lesson 2');
    expect(history.canRedo).toBe(false);
  });

  it('should return null when redoing empty redo stack', () => {
    expect(history.redo()).toBeNull();
  });

  it('should clear redo stack on new push', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    history.push(makeLesson('Lesson 2'), 'Updated');
    history.undo();
    expect(history.canRedo).toBe(true);
    history.push(makeLesson('Lesson 3'), 'New change');
    expect(history.canRedo).toBe(false);
    expect(history.redoCount).toBe(0);
  });

  it('should peek undo without removing', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    const peeked = history.peekUndo();
    expect(peeked).not.toBeNull();
    expect(history.undoCount).toBe(1);
  });

  it('should peek redo without removing', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    history.undo();
    const peeked = history.peekRedo();
    expect(peeked).not.toBeNull();
    expect(history.redoCount).toBe(1);
  });

  it('should respect max history limit', () => {
    const limitedHistory = new HistoryManager(3);
    limitedHistory.push(makeLesson('L1'), '1');
    limitedHistory.push(makeLesson('L2'), '2');
    limitedHistory.push(makeLesson('L3'), '3');
    limitedHistory.push(makeLesson('L4'), '4');
    expect(limitedHistory.undoCount).toBe(3);
    const descriptions = limitedHistory.getDescription();
    expect(descriptions).not.toContain('1');
  });

  it('should clear all history', () => {
    history.push(makeLesson('Lesson 1'), 'Initial');
    history.push(makeLesson('Lesson 2'), 'Updated');
    history.undo();
    history.clear();
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });

  it('should get history entries', () => {
    history.push(makeLesson('Lesson 1'), 'First');
    history.push(makeLesson('Lesson 2'), 'Second');
    const entries = history.getHistory();
    expect(entries).toHaveLength(2);
  });

  it('should get entry at index', () => {
    history.push(makeLesson('Lesson 1'), 'First');
    history.push(makeLesson('Lesson 2'), 'Second');
    const entry = history.getEntryAt(0);
    expect(entry?.description).toBe('First');
    expect(history.getEntryAt(5)).toBeNull();
    expect(history.getEntryAt(-1)).toBeNull();
  });

  it('should set max history', () => {
    history.setMaxHistory(2);
    history.push(makeLesson('L1'), '1');
    history.push(makeLesson('L2'), '2');
    history.push(makeLesson('L3'), '3');
    expect(history.undoCount).toBe(2);
  });

  it('should provide undo descriptions', () => {
    history.push(makeLesson('L1'), 'First');
    history.push(makeLesson('L2'), 'Second');
    expect(history.getDescription()).toEqual(['First', 'Second']);
  });
});
