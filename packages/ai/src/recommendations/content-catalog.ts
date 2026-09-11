import { ContentType, Difficulty } from '../types';

export interface ContentCatalogEntry {
  contentId: string;
  contentType: ContentType;
  title: string;
  description: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  estimatedDuration: number;
}

export const CONTENT_CATALOG: ContentCatalogEntry[] = [
  { contentId: 'cat-math-alg-1', contentType: ContentType.LESSON, title: 'Algebra Fundamentals', description: 'Core algebraic concepts and operations', subject: 'mathematics', topic: 'algebra', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-math-alg-2', contentType: ContentType.QUIZ, title: 'Algebra Practice Quiz', description: 'Test your algebra knowledge', subject: 'mathematics', topic: 'algebra', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 15 },
  { contentId: 'cat-math-alg-3', contentType: ContentType.ASSIGNMENT, title: 'Algebra Problem Set', description: 'Solve challenging algebra problems', subject: 'mathematics', topic: 'algebra', difficulty: Difficulty.ADVANCED, estimatedDuration: 25 },
  { contentId: 'cat-math-geo-1', contentType: ContentType.LESSON, title: 'Geometry Essentials', description: 'Shapes, angles, and spatial reasoning', subject: 'mathematics', topic: 'geometry', difficulty: Difficulty.BEGINNER, estimatedDuration: 18 },
  { contentId: 'cat-math-geo-2', contentType: ContentType.QUIZ, title: 'Geometry Quick Check', description: 'Verify your geometry understanding', subject: 'mathematics', topic: 'geometry', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 12 },
  { contentId: 'cat-math-calc-1', contentType: ContentType.LESSON, title: 'Introduction to Calculus', description: 'Limits and derivatives explained', subject: 'mathematics', topic: 'calculus', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 30 },
  { contentId: 'cat-math-calc-2', contentType: ContentType.ASSIGNMENT, title: 'Calculus Exercises', description: 'Practice differentiation and integration', subject: 'mathematics', topic: 'calculus', difficulty: Difficulty.ADVANCED, estimatedDuration: 35 },
  { contentId: 'cat-math-stat-1', contentType: ContentType.LESSON, title: 'Statistics Basics', description: 'Mean, median, mode and standard deviation', subject: 'mathematics', topic: 'statistics', difficulty: Difficulty.BEGINNER, estimatedDuration: 22 },
  { contentId: 'cat-math-stat-2', contentType: ContentType.QUIZ, title: 'Statistics Assessment', description: 'Check your statistics skills', subject: 'mathematics', topic: 'statistics', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 15 },
  { contentId: 'cat-sci-phy-1', contentType: ContentType.LESSON, title: 'Physics Foundations', description: 'Newtonian mechanics and motion', subject: 'science', topic: 'physics', difficulty: Difficulty.BEGINNER, estimatedDuration: 25 },
  { contentId: 'cat-sci-phy-2', contentType: ContentType.QUIZ, title: 'Physics Challenge', description: 'Apply physics concepts', subject: 'science', topic: 'physics', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 18 },
  { contentId: 'cat-sci-chem-1', contentType: ContentType.LESSON, title: 'Chemistry Intro', description: 'Elements, compounds and reactions', subject: 'science', topic: 'chemistry', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-sci-chem-2', contentType: ContentType.ASSIGNMENT, title: 'Chemistry Lab Problems', description: 'Solve chemical equations', subject: 'science', topic: 'chemistry', difficulty: Difficulty.ADVANCED, estimatedDuration: 28 },
];