import type { Lesson, AutoSaveConfig } from '../types.js';

const DEFAULT_CONFIG: AutoSaveConfig = {
  enabled: true,
  intervalMs: 30000,
  maxRetries: 3,
  storageKey: 'casuya-editor-autosave',
};

export class AutoSave {
  private config: AutoSaveConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private lastSavedAt: number | null = null;
  private onSave: ((lesson: Lesson) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  constructor(config?: Partial<AutoSaveConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  get lastSaved(): number | null {
    return this.lastSavedAt;
  }

  configure(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AutoSaveConfig {
    return { ...this.config };
  }

  start(getLesson: () => Lesson): void {
    this.stop();
    if (!this.config.enabled) return;

    this.timer = setInterval(() => {
      this.save(getLesson);
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  save(getLesson: () => Lesson): boolean {
    try {
      const lesson = getLesson();
      const json = JSON.stringify(lesson);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.config.storageKey, json);
      }

      this.lastSavedAt = Date.now();
      this.retryCount = 0;

      if (this.onSave) {
        this.onSave(lesson);
      }

      return true;
    } catch (err) {
      this.retryCount++;
      if (this.onError) {
        this.onError(err instanceof Error ? err : new Error(String(err)));
      }
      if (this.retryCount >= this.config.maxRetries) {
        this.stop();
      }
      return false;
    }
  }

  restore(): Lesson | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const json = localStorage.getItem(this.config.storageKey);
      if (!json) return null;
      return JSON.parse(json) as Lesson;
    } catch {
      return null;
    }
  }

  clear(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.config.storageKey);
    }
    this.lastSavedAt = null;
    this.retryCount = 0;
  }

  hasSavedData(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(this.config.storageKey) !== null;
  }

  getSavedTimestamp(): number | null {
    const lesson = this.restore();
    if (!lesson) return null;
    return new Date(lesson.updatedAt).getTime();
  }

  onSaveHandler(callback: (lesson: Lesson) => void): void {
    this.onSave = callback;
  }

  onErrorHandler(callback: (error: Error) => void): void {
    this.onError = callback;
  }
}
