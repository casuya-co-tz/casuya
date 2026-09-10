import { GameAPI } from '../../../src/api/game-api.js';

describe('GameAPI', () => {
  let game;

  beforeEach(() => {
    game = new GameAPI();
  });

  test('should manage game state', () => {
    game.setState('level', 3);
    expect(game.getState('level')).toBe(3);
  });

  test('should increment score', () => {
    game.incrementScore(10);
    game.incrementScore(5);
    expect(game.getScore()).toBe(15);
  });

  test('should set score directly', () => {
    game.setScore(100);
    expect(game.getScore()).toBe(100);
  });

  test('should manage lives', () => {
    game.setLives(5);
    expect(game.getLives()).toBe(5);
    game.setLives(0);
    expect(game.getLives()).toBe(0);
  });

  test('should manage health within bounds', () => {
    game.setHealth(150);
    expect(game.getHealth()).toBe(100);
    game.setHealth(-10);
    expect(game.getHealth()).toBe(0);
  });

  test('should add and spend coins', () => {
    game.addCoins(100);
    expect(game.getCoins()).toBe(100);
    expect(game.spendCoins(30)).toBe(true);
    expect(game.getCoins()).toBe(70);
    expect(game.spendCoins(100)).toBe(false);
  });

  test('should track completed levels', () => {
    game.completeLevel(1);
    game.completeLevel(2);
    expect(game.isCompleted(1)).toBe(true);
    expect(game.isCompleted(3)).toBe(false);
    expect(game.getCompletedLevels()).toHaveLength(2);
  });

  test('should submit to leaderboard', () => {
    game.submitScore('leader1', 100);
    game.submitScore('leader1', 200);
    expect(game.getLeaderboard('leader1')).toHaveLength(2);
  });

  test('should reset game state', () => {
    game.setState('level', 5);
    game.incrementScore(100);
    game.reset();
    expect(game.getState('level')).toBeUndefined();
    expect(game.getScore()).toBe(0);
  });
});