import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HookRegistry } from '../../src/core/hooks.js';

test('runs registered hooks in order, threading context', async () => {
  const hooks = new HookRegistry();
  hooks.register('beforeRender', (ctx) => ({ ...ctx, step1: true }));
  hooks.register('beforeRender', async (ctx) => ({ ...ctx, step2: true }));

  const result = await hooks.run('beforeRender', { step1: false });
  assert.deepEqual(result, { step1: true, step2: true });
});

test('returns original context when no hooks registered', async () => {
  const hooks = new HookRegistry();
  const result = await hooks.run('nothing', { a: 1 });
  assert.deepEqual(result, { a: 1 });
});
