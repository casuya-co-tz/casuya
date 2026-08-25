/** Small leveled logger with a silent-by-default production mode. */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger(namespace, { level = 'info' } = {}) {
  let currentLevel = LEVELS[level] ?? LEVELS.info;

  const log = (lvl, ...args) => {
    if (LEVELS[lvl] < currentLevel) return;
    const method = lvl === 'debug' ? 'log' : lvl;
    // eslint-disable-next-line no-console
    console[method](`[casuya-bridge:${namespace}]`, ...args);
  };

  return {
    setLevel: (lvl) => {
      if (lvl in LEVELS) currentLevel = LEVELS[lvl];
    },
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  };
}
