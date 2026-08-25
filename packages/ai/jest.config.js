module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 55,
      lines: 55,
      statements: 55,
    },
  },
};
