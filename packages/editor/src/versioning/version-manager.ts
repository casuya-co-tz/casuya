import type { Lesson, VersionSnapshot, VersionId, LessonId } from '../types.js';
import { generateVersionId } from '../utils/id-generator.js';

const MAX_VERSIONS = 50;

export class VersionManager {
  private versions: Map<VersionId, VersionSnapshot> = new Map();
  private maxVersions: number;

  constructor(maxVersions = MAX_VERSIONS) {
    this.maxVersions = maxVersions;
  }

  get count(): number {
    return this.versions.size;
  }

  createSnapshot(lesson: Lesson, label?: string): VersionSnapshot {
    const id = generateVersionId();
    const existingVersions = this.getByLessonId(lesson.id);
    const versionNumber = existingVersions.length + 1;

    const snapshot: VersionSnapshot = {
      id,
      lessonId: lesson.id,
      version: `${lesson.version}-v${versionNumber}`,
      lesson: JSON.parse(JSON.stringify(lesson)),
      label: label ?? `Version ${versionNumber}`,
      createdAt: new Date().toISOString(),
    };

    this.versions.set(id, snapshot);

    if (this.versions.size > this.maxVersions) {
      this.evictOldest(lesson.id);
    }

    return snapshot;
  }

  getVersion(id: VersionId): VersionSnapshot | undefined {
    return this.versions.get(id);
  }

  getAll(): VersionSnapshot[] {
    return Array.from(this.versions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getByLessonId(lessonId: LessonId): VersionSnapshot[] {
    return this.getAll().filter((v) => v.lessonId === lessonId);
  }

  getLatest(lessonId: LessonId): VersionSnapshot | null {
    const versions = this.getByLessonId(lessonId);
    return versions.length > 0 ? versions[0] : null;
  }

  getPrevious(currentId: VersionId): VersionSnapshot | null {
    const current = this.versions.get(currentId);
    if (!current) return null;
    const versions = this.getByLessonId(current.lessonId);
    const index = versions.findIndex((v) => v.id === currentId);
    if (index === -1 || index >= versions.length - 1) return null;
    return versions[index + 1];
  }

  getNext(currentId: VersionId): VersionSnapshot | null {
    const current = this.versions.get(currentId);
    if (!current) return null;
    const versions = this.getByLessonId(current.lessonId);
    const index = versions.findIndex((v) => v.id === currentId);
    if (index <= 0) return null;
    return versions[index - 1];
  }

  delete(id: VersionId): boolean {
    return this.versions.delete(id);
  }

  deleteByLessonId(lessonId: LessonId): number {
    let count = 0;
    for (const [id, snapshot] of this.versions) {
      if (snapshot.lessonId === lessonId) {
        this.versions.delete(id);
        count++;
      }
    }
    return count;
  }

  restore(versionId: VersionId): Lesson | null {
    const snapshot = this.versions.get(versionId);
    return snapshot ? JSON.parse(JSON.stringify(snapshot.lesson)) : null;
  }

  compare(versionId1: VersionId, versionId2: VersionId): {
    addedSlides: number;
    removedSlides: number;
    modifiedSlides: number;
    addedComponents: number;
    removedComponents: number;
  } {
    const v1 = this.versions.get(versionId1);
    const v2 = this.versions.get(versionId2);
    if (!v1 || !v2) {
      return { addedSlides: 0, removedSlides: 0, modifiedSlides: 0, addedComponents: 0, removedComponents: 0 };
    }

    const s1 = new Set(v1.lesson.slides.map((s) => s.id));
    const s2 = new Set(v2.lesson.slides.map((s) => s.id));

    const addedSlides = v2.lesson.slides.filter((s) => !s1.has(s.id)).length;
    const removedSlides = v1.lesson.slides.filter((s) => !s2.has(s.id)).length;

    let modifiedSlides = 0;
    let addedComponents = 0;
    let removedComponents = 0;

    for (const slide2 of v2.lesson.slides) {
      const slide1 = v1.lesson.slides.find((s) => s.id === slide2.id);
      if (slide1) {
        if (JSON.stringify(slide1) !== JSON.stringify(slide2)) {
          modifiedSlides++;
        }
        const c1 = new Set(slide1.components.map((c) => c.id));
        const c2 = new Set(slide2.components.map((c) => c.id));
        addedComponents += slide2.components.filter((c) => !c1.has(c.id)).length;
        removedComponents += slide1.components.filter((c) => !c2.has(c.id)).length;
      }
    }

    return { addedSlides, removedSlides, modifiedSlides, addedComponents, removedComponents };
  }

  setMaxVersions(max: number): void {
    this.maxVersions = Math.max(1, max);
  }

  private evictOldest(lessonId: LessonId): void {
    const versions = this.getByLessonId(lessonId);
    if (versions.length > 1) {
      const oldest = versions[versions.length - 1];
      if (oldest) {
        this.versions.delete(oldest.id);
      }
    }
  }
}
