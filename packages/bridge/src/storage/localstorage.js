/** Safe wrapper around window.localStorage with an in-memory fallback
 * (private browsing, quota errors, or non-browser environments). */

function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => void map.clear(),
  };
}

function getBackend() {
  try {
    if (typeof localStorage !== 'undefined') {
      const testKey = '__casuya_bridge_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return localStorage;
    }
  } catch {
    // fall through to memory backend
  }
  return createMemoryBackend();
}

const backend = getBackend();

export function getItem(key, fallback = null) {
  const raw = backend.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setItem(key, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  backend.setItem(key, raw);
}

export function removeItem(key) {
  backend.removeItem(key);
}

export function clearAll() {
  backend.clear();
}
