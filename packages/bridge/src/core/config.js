/** Configuration resolution and validation. */

import { DEFAULT_CONFIG } from './constants.js';
import { ConfigError } from './errors.js';

export function resolveConfig(overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };

  if (typeof config.syncIntervalMs !== 'number' || config.syncIntervalMs < 0) {
    throw new ConfigError('syncIntervalMs must be a non-negative number');
  }
  if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
    throw new ConfigError('maxRetries must be a non-negative number');
  }
  if (config.encryptionKey !== null && typeof config.encryptionKey !== 'string') {
    throw new ConfigError('encryptionKey must be a string or null');
  }

  return Object.freeze(config);
}
