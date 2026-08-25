/** Content-hash integrity checks for cached packages/assets. */

import { SecurityError } from '../core/errors.js';
import { getSubtle } from './crypto.js';

export async function sha256Hex(text) {
  const subtle = await getSubtle();
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyContentHash(body, expectedHash) {
  const actual = await sha256Hex(body);
  return actual === expectedHash;
}

export async function verifyContentHashOrThrow(body, expectedHash) {
  const ok = await verifyContentHash(body, expectedHash);
  if (!ok) {
    throw new SecurityError('Content hash mismatch: package may be corrupted');
  }
}