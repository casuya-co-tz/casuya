import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPayload, verifySignature, verifyOrThrow } from '../../src/security/signatures.js';
import { sha256Hex, verifyContentHash, verifyContentHashOrThrow } from '../../src/security/integrity.js';
import { validatePackageShape, validatePackageShapeOrThrow } from '../../src/security/validation.js';
import { stripScripts, toPlainTextSnippet } from '../../src/security/sanitization.js';
import { SecurityError, ValidationError } from '../../src/core/errors.js';

test('sign/verify roundtrip succeeds with correct key', async () => {
  const sig = await signPayload('hello', 'secret');
  assert.equal(await verifySignature('hello', sig, 'secret'), true);
});

test('verify fails with wrong key', async () => {
  const sig = await signPayload('hello', 'secret');
  assert.equal(await verifySignature('hello', sig, 'wrong'), false);
});

test('verifyOrThrow throws SecurityError on mismatch', async () => {
  const sig = await signPayload('hello', 'secret');
  await assert.rejects(() => verifyOrThrow('hello', sig, 'wrong'), SecurityError);
});

test('sha256Hex is deterministic', async () => {
  const a = await sha256Hex('mole concept');
  const b = await sha256Hex('mole concept');
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('verifyContentHash detects tampering', async () => {
  const hash = await sha256Hex('original body');
  assert.equal(await verifyContentHash('original body', hash), true);
  assert.equal(await verifyContentHash('tampered body', hash), false);
  await assert.rejects(() => verifyContentHashOrThrow('tampered body', hash));
});

test('validatePackageShape requires body.html and manifest.json', () => {
  const result = validatePackageShape({ 'body.html': '<p>x</p>' });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('manifest.json')));
});

test('validatePackageShapeOrThrow throws on bad manifest JSON', () => {
  assert.throws(
    () => validatePackageShapeOrThrow({ 'body.html': '<p>x</p>', 'manifest.json': '{not json' }),
    ValidationError
  );
});

test('stripScripts removes script tags and inline event handlers', () => {
  const html = '<div onclick="evil()">hi</div><script>evil()</script>';
  const out = stripScripts(html);
  assert.ok(!out.includes('<script>'));
  assert.ok(!out.includes('onclick'));
});

test('toPlainTextSnippet strips tags and truncates', () => {
  const html = `<p>${'x'.repeat(300)}</p>`;
  const snippet = toPlainTextSnippet(html, 50);
  assert.equal(snippet.length, 50);
  assert.ok(snippet.endsWith('…'));
});
