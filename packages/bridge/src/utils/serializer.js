/** JSON (de)serialization helpers with safe error handling. */

export function serialize(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    throw new Error(`Failed to serialize value: ${err.message}`);
  }
}

export function deserialize(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return deserialize(serialize(value));
}
