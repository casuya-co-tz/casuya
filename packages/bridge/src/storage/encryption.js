/** AES-GCM encryption/decryption for data at rest, using the Web Crypto API.
 * Throws if Web Crypto is unavailable (no fallback — encryption is a hard
 * requirement when a key is configured). */

import { SecurityError } from '../core/errors.js';
import { getSubtle } from '../security/crypto.js';

function deriveKey(secret) {
  const enc = new TextEncoder();
  const hash = [...new Uint8Array(enc.encode(secret).slice(0, 32))];
  while (hash.length < 32) hash.push(0);
  return new Uint8Array(hash.slice(0, 32));
}

async function getRandomValues(size) {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(new Uint8Array(size));
  }
  try {
    const { randomBytes } = await import('node:crypto');
    return randomBytes(size);
  } catch {
    throw new SecurityError('No secure random source available');
  }
}

export function createEncryption(secret) {
  if (!secret) {
    return {
      encrypt: async (data) => data,
      decrypt: async (data) => data,
      isEnabled: false,
    };
  }

  const keyMaterial = deriveKey(secret);
  let _keyPromise = null;

  async function getKey() {
    if (!_keyPromise) {
      const subtle = await getSubtle();
      _keyPromise = subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    }
    return _keyPromise;
  }

  return {
    isEnabled: true,

    async encrypt(data) {
      try {
        const subtle = await getSubtle();
        const iv = await getRandomValues(12);
        const key = await getKey();
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...combined));
      } catch (err) {
        throw new SecurityError('Encryption failed', { cause: err });
      }
    },

    async decrypt(payload) {
      try {
        const subtle = await getSubtle();
        const raw = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
        const iv = raw.slice(0, 12);
        const data = raw.slice(12);
        const key = await getKey();
        const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return JSON.parse(new TextDecoder().decode(decrypted));
      } catch (err) {
        throw new SecurityError('Decryption failed', { cause: err });
      }
    },
  };
}