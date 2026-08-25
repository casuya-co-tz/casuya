import { Difficulty, ContentType } from './common';

export interface LearningPathRequest {
  studentId: string;
  goal: LearningGoal;
  constraints?: PathConstraints;
}

export interface LearningGoal {
  subject: string;
  targetConcept: string;
  targetDifficulty: Difficulty;
  estimatedHours?: number;
  description?: string;
}

export interface PathConstraints {
  maxDuration: number;
  availableTimePerDay: number;
  preferredContentTypes: ContentType[];
  language: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export interface LearningPath {
  id: string;
  studentId: string;
  goal: LearningGoal;
  nodes: PathNode[];
  totalEstimatedDuration: number;
  difficulty: Difficulty;
  generatedAt: Date;
  version: string;
}

export interface PathNode {
  id: string;
  type: PathNodeType;
  contentId?: string;
  title: string;
  description: string;
  estimatedDuration: number;
  prerequisites: string[];
  concepts: string[];
  difficulty: Difficulty;
  order: number;
  completed?: boolean;
  score?: number;
}

export enum PathNodeType {
  LESSON = 'lesson',
  QUIZ = 'quiz',
  REVIEW = 'review',
  ASSESSMENT = 'assessment',
  PRACTICE = 'practice',
  VIDEO = 'video',
  READING = 'reading',
  PROJECT = 'project',
}

export interface PrerequisiteGraph {
  nodes: PrerequisiteNode[];
  edges: PrerequisiteEdge[];
}

export interface PrerequisiteNode {
  conceptId: string;
  name: string;
  difficulty: Difficulty;
}

export interface PrerequisiteEdge {
  from: string;
  to: string;
  required: boolean;
}

export interface PathProgress {
  pathId: string;
  studentId: string;
  completedNodes: string[];
  currentNode: string;
  overallProgress: number;
  startedAt: Date;
  estimatedCompletion?: Date;
}

export interface CurriculumnMap {
  subject: string;
  topics: CurriculumnTopic[];
  totalDuration: number;
  version: string;
}

export interface CurriculumnTopic {
  id: string;
  name: string;
  concepts: string[];
  prerequisites: string[];
  difficulty: Difficulty;
  estimatedHours: number;
}
