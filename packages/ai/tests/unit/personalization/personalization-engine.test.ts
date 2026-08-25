import { PersonalizationEngine } from '../../../src/personalization/personalization-engine';
import { PersonalizationEventType } from '../../../src/types/personalization';
import { Language, Difficulty, ContentType } from '../../../src/types/common';

describe('PersonalizationEngine', () => {
  let engine: PersonalizationEngine;

  beforeEach(() => {
    engine = new PersonalizationEngine();
  });

  it('should return null for unknown student', async () => {
    const profile = await engine.getStudentProfile('nonexistent');
    expect(profile).toBeNull();
  });

  it('should create and retrieve a profile', async () => {
    const profile = await engine.updateStudentProfile('student-1', {
      name: 'Alice', grade: 10,
      language: Language.ENGLISH,
      learningStyle: { visual: 0.5, auditory: 0.3, reading: 0.8, kinesthetic: 0.2 },
      preferences: {
        language: Language.ENGLISH, difficulty: Difficulty.INTERMEDIATE,
        contentTypes: [ContentType.LESSON], sessionDuration: 30,
        includeGamification: false, includeRealWorldExamples: true,
      },
      accessibility: { fontSize: 'medium', highContrast: false, screenReader: false, subtitlePreference: false, reducedMotion: false },
      knowledgeState: { overallMastery: 0, subjectsCompleted: 0, totalConcepts: 0, masteredConcepts: 0, averageTimePerLesson: 0 },
    });
    expect(profile.id).toBe('student-1');
    expect(profile.name).toBe('Alice');
  });

  it('should update existing profile', async () => {
    await engine.updateStudentProfile('student-1', { name: 'Alice' } as any);
    const updated = await engine.updateStudentProfile('student-1', { name: 'Alice Updated' } as any);
    expect(updated.name).toBe('Alice Updated');
  });

  it('should record learning events', async () => {
    await engine.recordEvent({
      studentId: 'student-1',
      type: PersonalizationEventType.LESSON_STARTED,
      timestamp: new Date(),
      data: { lessonId: 'lesson-1' },
    });
    const params = await engine.getAdaptiveParameters('student-1');
    expect(params).toBeDefined();
  });

  it('should handle multiple event types', async () => {
    const now = new Date();
    await engine.recordEvent({ studentId: 'student-1', type: PersonalizationEventType.LESSON_STARTED, timestamp: now, data: { lessonId: 'l1' } });
    await engine.recordEvent({ studentId: 'student-1', type: PersonalizationEventType.LESSON_COMPLETED, timestamp: now, data: { lessonId: 'l1', score: 0.8 } });
    const params = await engine.getAdaptiveParameters('student-1');
    expect(params).toBeDefined();
  });

  it('should calculate difficulty', async () => {
    await engine.recordEvent({
      studentId: 'student-1',
      type: PersonalizationEventType.QUIZ_ATTEMPTED,
      timestamp: new Date(),
      data: { score: 0.95 },
    });
    const difficulty = await engine.calculateDifficulty('student-1');
    expect(difficulty).toBeDefined();
  });

  it('should return adaptive parameters', async () => {
    const params = await engine.getAdaptiveParameters('student-1');
    expect(params).toBeDefined();
    expect(typeof params).toBe('object');
  });
});
