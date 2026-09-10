import { jest } from '@jest/globals';
import { QuizAPI } from '../../../src/api/quiz-api.js';

describe('QuizAPI', () => {
  let quiz;

  beforeEach(() => {
    quiz = new QuizAPI();
  });

  test('should submit and retrieve answers', () => {
    quiz.submitAnswer('q1', 'A');
    expect(quiz.getAnswer('q1').answer).toBe('A');
  });

  test('should require questionId', () => {
    expect(() => quiz.submitAnswer()).toThrow();
  });

  test('should score quizzes', () => {
    const result = quiz.scoreQuiz('quiz1', 8, 10);
    expect(result.score).toBe(8);
    expect(result.percentage).toBe(80);
  });

  test('should return all answers', () => {
    quiz.submitAnswer('q1', 'A');
    quiz.submitAnswer('q2', 'B');
    const all = quiz.getAllAnswers();
    expect(Object.keys(all)).toHaveLength(2);
  });

  test('should return null for unscored quizzes', () => {
    expect(quiz.getScore('nonexistent')).toBeNull();
  });

  test('should reset answers', () => {
    quiz.submitAnswer('q1', 'A');
    quiz.submitAnswer('q2', 'B');
    quiz.reset('q1');
    expect(quiz.getAnswer('q1')).toBeNull();
    expect(quiz.getAnswer('q2')).not.toBeNull();
  });

  test('should emit events', () => {
    const listener = jest.fn();
    quiz.on('quiz:answer', listener);
    quiz.submitAnswer('q1', 'C');
    expect(listener).toHaveBeenCalled();
  });
});