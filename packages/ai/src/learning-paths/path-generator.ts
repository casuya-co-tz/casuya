import {
  LearningPathRequest,
  LearningPath,
  PathNode,
  PathNodeType,
  PathProgress,
  Difficulty,
} from '../types';
import { CacheManager } from '../caching/cache-manager';
import { Logger } from '../utilities/logger';
import { CasuyaAIError, ErrorCode } from '../utilities';

export class LearningPathGenerator {
  private cache: CacheManager;
  private paths: Map<string, LearningPath>;

  constructor(_logger?: Logger) {
    this.cache = new CacheManager({ defaultTTL: 60 * 60 * 1000 });
    this.paths = new Map();
  }

  async generatePath(request: LearningPathRequest): Promise<LearningPath> {
    this.validateRequest(request);

    const cacheKey = `path:${request.studentId}:${request.goal.targetConcept}`;
    const cached = this.cache.get<LearningPath>(cacheKey);
    if (cached) return cached;

    const path = this.buildPath(request);
    this.paths.set(path.id, path);
    this.cache.set(cacheKey, path, 24 * 60 * 60 * 1000);

    return path;
  }

  getPath(pathId: string): LearningPath | undefined {
    return this.paths.get(pathId);
  }

  async getProgress(pathId: string, studentId: string): Promise<PathProgress | null> {
    const cacheKey = `progress:${pathId}:${studentId}`;
    return this.cache.get<PathProgress>(cacheKey) ?? null;
  }

  async updateProgress(pathId: string, studentId: string, nodeId: string, completed: boolean, _score?: number): Promise<PathProgress> {
    const path = this.paths.get(pathId);
    if (!path) {
      throw new CasuyaAIError(`Path not found: ${pathId}`, ErrorCode.VALIDATION_ERROR);
    }

    const progress = await this.getProgress(pathId, studentId) ?? {
      pathId,
      studentId,
      completedNodes: [],
      currentNode: path.nodes[0]?.id ?? '',
      overallProgress: 0,
      startedAt: new Date(),
    };

    if (completed && !progress.completedNodes.includes(nodeId)) {
      progress.completedNodes.push(nodeId);
      const nodeIndex = path.nodes.findIndex((n) => n.id === nodeId);
      const nextNode = path.nodes[nodeIndex + 1];
      progress.currentNode = nextNode?.id ?? nodeId;
    }

    progress.overallProgress = (progress.completedNodes.length / path.nodes.length) * 100;

    this.cache.set(`progress:${pathId}:${studentId}`, progress);
    return progress;
  }

  async checkPrerequisites(pathId: string, studentId: string): Promise<{ met: boolean; missing: string[] }> {
    const path = this.paths.get(pathId);
    if (!path) {
      throw new CasuyaAIError(`Path not found: ${pathId}`, ErrorCode.VALIDATION_ERROR);
    }

    const progress = await this.getProgress(pathId, studentId);
    const completed = new Set(progress?.completedNodes ?? []);

    const currentNode = path.nodes.find((n) => n.id === progress?.currentNode);
    if (!currentNode) return { met: true, missing: [] };

    const missing = currentNode.prerequisites.filter((p) => !completed.has(p));
    return {
      met: missing.length === 0,
      missing,
    };
  }

  private validateRequest(request: LearningPathRequest): void {
    if (!request.studentId) {
      throw new CasuyaAIError('Student ID is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!request.goal?.targetConcept) {
      throw new CasuyaAIError('Target concept is required', ErrorCode.VALIDATION_ERROR);
    }
  }

  private buildPath(request: LearningPathRequest): LearningPath {
    const nodes = this.buildLearningNodes(request);
    const totalDuration = nodes.reduce((sum, n) => sum + n.estimatedDuration, 0);

    return {
      id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      studentId: request.studentId,
      goal: request.goal,
      nodes,
      totalEstimatedDuration: totalDuration,
      difficulty: request.goal.targetDifficulty,
      generatedAt: new Date(),
      version: '1.0.0',
    };
  }

  private buildLearningNodes(request: LearningPathRequest): PathNode[] {
    const nodes: PathNode[] = [];
    const baseDifficulty = request.goal.targetDifficulty;
    const difficultyLevels = this.getDifficultyProgression(baseDifficulty);

    const topics = this.generateTopicProgression(request.goal.targetConcept);
    let order = 0;

    for (const topic of topics) {
      const diffIndex = Math.min(order, difficultyLevels.length - 1);
      const type = this.getNodeType(order, topics.length);

      nodes.push({
        id: `node-${order}`,
        type,
        title: topic.title,
        description: topic.description,
        estimatedDuration: 15 + Math.floor(Math.random() * 15),
        prerequisites: order > 0 ? [`node-${order - 1}`] : [],
        concepts: [topic.concept],
        difficulty: difficultyLevels[diffIndex],
        order,
      });

      order++;
    }

    return nodes;
  }

  private getDifficultyProgression(target: Difficulty): Difficulty[] {
    const levels: Difficulty[] = [
      Difficulty.BEGINNER,
      Difficulty.ELEMENTARY,
      Difficulty.INTERMEDIATE,
      Difficulty.ADVANCED,
      Difficulty.EXPERT,
    ];

    const targetIndex = levels.indexOf(target);
    if (targetIndex <= 0) return [Difficulty.BEGINNER];

    const progression: Difficulty[] = [];
    for (let i = 0; i <= targetIndex; i++) {
      progression.push(levels[i]);
    }
    return progression;
  }

  private generateTopicProgression(targetConcept: string): Array<{ title: string; description: string; concept: string }> {
    return [
      {
        title: `Introduction to ${targetConcept}`,
        description: `Learn the fundamentals of ${targetConcept}`,
        concept: `${targetConcept}_intro`,
      },
      {
        title: `Core Concepts of ${targetConcept}`,
        description: `Deepen your understanding of ${targetConcept}`,
        concept: `${targetConcept}_core`,
      },
      {
        title: `Practical ${targetConcept}`,
        description: `Apply ${targetConcept} in real scenarios`,
        concept: `${targetConcept}_practical`,
      },
      {
        title: `Advanced ${targetConcept}`,
        description: `Master advanced topics in ${targetConcept}`,
        concept: `${targetConcept}_advanced`,
      },
      {
        title: `${targetConcept} Mastery`,
        description: `Comprehensive review and final assessment`,
        concept: `${targetConcept}_mastery`,
      },
    ];
  }

  private getNodeType(index: number, total: number): PathNodeType {
    if (index === 0) return PathNodeType.LESSON;
    if (index === total - 1) return PathNodeType.ASSESSMENT;
    if (index % 3 === 0) return PathNodeType.PRACTICE;
    if (index % 2 === 0) return PathNodeType.QUIZ;
    return PathNodeType.LESSON;
  }
}
