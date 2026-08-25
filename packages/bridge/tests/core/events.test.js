import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../src/core/events.js';

test('on/emit calls the handler with payload', () => {
  const bus = new EventBus();
  let received = null;
  bus.on('x', (payload) => (received = payload));
  bus.emit('x', { a: 1 });
  assert.deepEqual(received, { a: 1 });
});

test('off removes a handler', () => {
  const bus = new EventBus();
  let calls = 0;
  const handler = () => calls++;
  bus.on('x', handler);
  bus.off('x', handler);
  bus.emit('x');
  assert.equal(calls, 0);
});

test('once only fires a single time', () => {
  const bus = new EventBus();
  let calls = 0;
  bus.once('x', () => calls++);
  bus.emit('x');
  bus.emit('x');
  assert.equal(calls, 1);
});

test('a throwing listener does not break other listeners', () => {
  const bus = new EventBus();
  let secondCalled = false;
  bus.on('x', () => {
    throw new Error('boom');
  });
  bus.on('x', () => (secondCalled = true));
  bus.emit('x');
  assert.equal(secondCalled, true);
});
