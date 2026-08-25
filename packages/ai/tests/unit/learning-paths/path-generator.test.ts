import { LearningPathGenerator } from '../../../src/learning-paths/path-generator';
import { Difficulty, ContentType } from '../../../src/types/common';

describe('LearningPathGenerator', () => {
  let generator: LearningPathGenerator;

  beforeEach(() => {
    generator = new LearningPathGenerator();
  });

  describe('path generation', () => {
    it('should generate a learning path from a goal', async () => {
      const path = await generator.generatePath({
        studentId: 'student-1',
        goal: {
          subject: 'Mathematics',
          targetConcept: 'Algebra',
          targetDifficulty: Difficulty.INTERMEDIATE,
        },
      });
      expect(path.id).toBeDefined();
      expect(path.nodes).toBeDefined();
      expect(path.nodes.length).toBeGreaterThan(0);
    });

    it('should respect constraints', async () => {
      const path = await generator.generatePath({
        studentId: 'student-2',
        goal: {
          subject: 'Science',
          targetConcept: 'Biology',
          targetDifficulty: Difficulty.BEGINNER,
          estimatedHours: 10,
        },
        constraints: {
          maxDuration: 30,
          availableTimePerDay: 1,
          preferredContentTypes: [ContentType.LESSON, ContentType.QUIZ],
          language: 'en',
          deviceType: 'mobile',
        },
      });
      expect(path.nodes).toBeDefined();
      expect(path.totalEstimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('path retrieval', () => {
    it('should retrieve existing path', async () => {
      const path = await generator.generatePath({
        studentId: 'student-3',
        goal: { subject: 'History', targetConcept: 'World War II', targetDifficulty: Difficulty.INTERMEDIATE },
      });
      const retrieved = generator.getPath(path.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(path.id);
    });

    it('should return undefined for missing path', () => {
      const retrieved = generator.getPath('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('progress tracking', () => {
    it('should track progress through path', async () => {
      const path = await generator.generatePath({
        studentId: 'student-4',
        goal: { subject: 'Physics', targetConcept: 'Mechanics', targetDifficulty: Difficulty.INTERMEDIATE },
      });
      const progress = await generator.updateProgress(path.id, 'student-4', path.nodes[0].id, true, 0.9);
      expect(progress.completedNodes).toContain(path.nodes[0].id);
      expect(progress.overallProgress).toBeGreaterThan(0);
    });

    it('should check prerequisites', async () => {
      const path = await generator.generatePath({
        studentId: 'student-5',
        goal: { subject: 'Chemistry', targetConcept: 'Organic Chemistry', targetDifficulty: Difficulty.ADVANCED },
      });
      const prereqCheck = await generator.checkPrerequisites(path.id, 'student-5');
      expect(prereqCheck.met).toBeDefined();
      expect(Array.isArray(prereqCheck.missing)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw for invalid path progress', async () => {
      await expect(
        generator.updateProgress('nonexistent', 'student-6', 'node-1', true)
      ).rejects.toThrow();
    });
  });
});
