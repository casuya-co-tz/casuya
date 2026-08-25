module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['tokens', 'react', 'icons', 'theme', 'a11y', 'docs', 'playground', 'repo'],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
