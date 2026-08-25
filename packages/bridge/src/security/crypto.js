/** Resolves the Web Crypto API across browser and Node.js environments. */

let _subtle = null;

export async function getSubtle() {
  if (_subtle) return _subtle;

  if (typeof globalThis.crypto?.subtle === 'object') {
    _subtle = globalThis.crypto.subtle;
    return _subtle;
  }

  try {
    const { webcrypto } = await import('node:crypto');
    _subtle = webcrypto.subtle;
    return _subtle;
  } catch {
    throw new Error('Web Crypto API is not available in this environment');
  }
}