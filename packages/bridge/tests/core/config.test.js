import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.js';
import { ConfigError } from '../../src/core/errors.js';

test('resolveConfig applies defaults', () => {
  const config = resolveConfig();
  assert.equal(config.maxRetries, 5);
  assert.equal(config.compressionEnabled, true);
});

test('resolveConfig allows overrides', () => {
  const config = resolveConfig({ maxRetries: 2, apiBaseUrl: 'https://casuya.co.tz' });
  assert.equal(config.maxRetries, 2);
  assert.equal(config.apiBaseUrl, 'https://casuya.co.tz');
});

test('resolveConfig rejects negative maxRetries', () => {
  assert.throws(() => resolveConfig({ maxRetries: -1 }), ConfigError);
});

test('resolveConfig rejects invalid encryptionKey type', () => {
  assert.throws(() => resolveConfig({ encryptionKey: 123 }), ConfigError);
});

test('resolved config is frozen', () => {
  const config = resolveConfig();
  assert.throws(() => {
    'use strict';
    config.maxRetries = 99;
  });
});
