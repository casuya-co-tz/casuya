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
  { contentId: 'cat-sci-bio-1', contentType: ContentType.LESSON, title: 'Biology Overview', description: 'Cells, genetics and ecosystems', subject: 'science', topic: 'biology', difficulty: Difficulty.BEGINNER, estimatedDuration: 22 },
  { contentId: 'cat-sci-bio-2', contentType: ContentType.QUIZ, title: 'Biology Quiz', description: 'Test biology concepts', subject: 'science', topic: 'biology', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 14 },
  { contentId: 'cat-eng-gram-1', contentType: ContentType.LESSON, title: 'Grammar Workshop', description: 'Parts of speech and sentence structure', subject: 'english', topic: 'grammar', difficulty: Difficulty.BEGINNER, estimatedDuration: 16 },
  { contentId: 'cat-eng-gram-2', contentType: ContentType.QUIZ, title: 'Grammar Test', description: 'Assess your grammar knowledge', subject: 'english', topic: 'grammar', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 12 },
  { contentId: 'cat-eng-writ-1', contentType: ContentType.LESSON, title: 'Essay Writing Skills', description: 'Structure and write compelling essays', subject: 'english', topic: 'writing', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 25 },
  { contentId: 'cat-eng-writ-2', contentType: ContentType.ASSIGNMENT, title: 'Writing Practice', description: 'Write and refine paragraphs', subject: 'english', topic: 'writing', difficulty: Difficulty.ADVANCED, estimatedDuration: 30 },
  { contentId: 'cat-eng-lit-1', contentType: ContentType.LESSON, title: 'Literary Analysis', description: 'Analyze themes and literary devices', subject: 'english', topic: 'literature', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 24 },
  { contentId: 'cat-hist-anc-1', contentType: ContentType.LESSON, title: 'Ancient Civilizations', description: 'Explore early human societies', subject: 'history', topic: 'ancient-civilizations', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-hist-anc-2', contentType: ContentType.QUIZ, title: 'History Timeline Quiz', description: 'Match events to time periods', subject: 'history', topic: 'ancient-civilizations', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 15 },
  { contentId: 'cat-hist-mod-1', contentType: ContentType.LESSON, title: 'Modern History', description: 'Major events of the last century', subject: 'history', topic: 'modern-history', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 22 },
  { contentId: 'cat-hist-mod-2', contentType: ContentType.ASSIGNMENT, title: 'Historical Essay', description: 'Write about historical events', subject: 'history', topic: 'modern-history', difficulty: Difficulty.ADVANCED, estimatedDuration: 28 },
  { contentId: 'cat-cs-prog-1', contentType: ContentType.LESSON, title: 'Programming Basics', description: 'Variables, loops and functions', subject: 'computer-science', topic: 'programming', difficulty: Difficulty.BEGINNER, estimatedDuration: 20 },
  { contentId: 'cat-cs-prog-2', contentType: ContentType.QUIZ, title: 'Code Challenge', description: 'Solve programming puzzles', subject: 'computer-science', topic: 'programming', difficulty: Difficulty.INTERMEDIATE, estimatedDuration: 18 },
  { contentId: 'cat-cs-algo-1', contentType: ContentType.LESSON, title: 'Algorithm Design', description: 'Sorting, searching and optimization', subject: 'computer-science', topic: 'algorithms', difficulty: Difficulty.ADVANCED, estimatedDuration: 30 },
  { contentId: 'cat-cs-algo-2', contentType: ContentType.ASSIGNMENT, title: 'Algorithm Practice', description: 'Implement classic algorithms', subject: 'computer-science', topic: 'algorithms', difficulty: Difficulty.ADVANCED, estimatedDuration: 35 },
];