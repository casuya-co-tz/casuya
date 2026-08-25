export function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof ArrayBuffer) return obj.slice(0);
  if (obj instanceof Blob) return obj;
  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

export function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
