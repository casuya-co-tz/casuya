import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../../src/storage/indexeddb.js';
import { TtsAudioCache } from '../../src/media/audio.js';
import { SttOutbox } from '../../src/media/stt-outbox.js';

test('TtsAudioCache put/get and eviction', async () => {
  const cache = new TtsAudioCache(new MemoryStore());
  const key = TtsAudioCache.cacheKey('sw', 1, 'Habari');
  const blob = { size: 1200, type: 'audio/wav' };

  await cache.put(key, blob);
  assert.equal(await cache.get(key), blob);

  await cache.evictOlderThan(-1);
  assert.equal(await cache.get(key), null);
});

test('SttOutbox enqueue/drain/remove', async () => {
  const outbox = new SttOutbox(new MemoryStore());
  const wav = { size: 800, type: 'audio/wav' };
  const id = await outbox.enqueue(wav, '#lesson-note');
  assert.equal(await outbox.size(), 1);

  const drained = await outbox.drain(async (blob) => {
    assert.equal(blob, wav);
    return 'habari';
  });
  assert.equal(drained.length, 1);
  assert.equal(drained[0].text, 'habari');
  assert.equal(await outbox.size(), 0);
});
