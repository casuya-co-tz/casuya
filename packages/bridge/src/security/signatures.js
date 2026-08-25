/** Verifies HMAC-SHA256 signatures produced by casuya-core's packager,
 * using the Web Crypto API (SubtleCrypto). */

import { SecurityError } from '../core/errors.js';
import { getSubtle } from './crypto.js';

async function importKey(secret) {
  const subtle = await getSubtle();
  const enc = new TextEncoder();
  return subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signPayload(payload, secret) {
  const subtle = await getSubtle();
  const key = await importKey(secret);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(signature);
}

export async function verifySignature(payload, signatureHex, secret) {
  const expected = await signPayload(payload, secret);
  return timingSafeEqualHex(expected, signatureHex);
}

export async function verifyOrThrow(payload, signatureHex, secret) {
  const valid = await verifySignature(payload, signatureHex, secret);
  if (!valid) {
    throw new SecurityError('Package signature verification failed');
  }
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}