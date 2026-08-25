/** Generic helper functions used across modules. */

export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

export function throttle(fn, intervalMs) {
  let lastCall = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk(array, size) {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
