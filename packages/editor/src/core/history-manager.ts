import type { HistoryEntry, Lesson } from '../types.js';

const DEFAULT_MAX_HISTORY = 100;

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxHistory: number;

  constructor(maxHistory = DEFAULT_MAX_HISTORY) {
    this.maxHistory = maxHistory;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  push(lesson: Lesson, description: string): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      description,
      lessonSnapshot: JSON.parse(JSON.stringify(lesson)),
    };
    this.undoStack.push(entry);
    this.redoStack = [];

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  undo(): HistoryEntry | null {
    if (!this.canUndo) return null;
    const entry = this.undoStack.pop()!;
    this.redoStack.push(entry);
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1]
      : null;
  }

  redo(): HistoryEntry | null {
    if (!this.canRedo) return null;
    const entry = this.redoStack.pop()!;
    this.undoStack.push(entry);
    return entry;
  }

  peekUndo(): HistoryEntry | null {
    if (!this.canUndo) return null;
    return this.undoStack[this.undoStack.length - 1];
  }

  peekRedo(): HistoryEntry | null {
    if (!this.canRedo) return null;
    return this.redoStack[this.redoStack.length - 1];
  }

  getHistory(): HistoryEntry[] {
    return [...this.undoStack];
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  setMaxHistory(max: number): void {
    this.maxHistory = Math.max(1, max);
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  getEntryAt(index: number): HistoryEntry | null {
    if (index < 0 || index >= this.undoStack.length) return null;
    return this.undoStack[index];
  }

  getDescription(): string[] {
    return this.undoStack.map((e) => e.description);
  }
}
