const HEX_CHARS = '0123456789abcdef';
const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateId(length = 16): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return result;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateShortId(length = 8): string {
  return generateId(length);
}

export function generateVersionId(): string {
  const now = Date.now();
  const time = now.toString(36).padStart(10, '0').toUpperCase();
  const random = generateId(16).toUpperCase();
  return time + random;
}

export function generateHexHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash = hash & hash;
  }
  let hex = '';
  for (let i = 0; i < 8; i++) {
    const nibble = (hash >> (i * 4)) & 0xf;
    hex = HEX_CHARS.charAt(Math.abs(nibble) % 16) + hex;
  }
  return hex;
}

let counter = 0;

export function generateSequentialId(prefix = 'id'): string {
  counter++;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}

export function resetCounter(): void {
  counter = 0;
}
