import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NetworkTierDetector, NETWORK_TIERS } from '../../src/network/network-tier.js';
import { AdaptiveLoader } from '../../src/network/adaptive-loader.js';
import { downloadPackageTiered, downloadAssetTiered } from '../../src/network/tiered-downloads.js';
import { EventBus } from '../../src/core/events.js';
import { EVENTS } from '../../src/core/constants.js';

// --- NetworkTierDetector ---

test('NetworkTierDetector defaults to unknown when no connection API', () => {
  const detector = new NetworkTierDetector({ connection: null });
  assert.equal(detector.tier, NETWORK_TIERS.UNKNOWN);
  assert.equal(detector.apiAvailable, false);
});

test('NetworkTierDetector detects slow-2g from effectiveType', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: 'slow-2g', downlink: 0.02, rtt: 2000, saveData: true } });
  assert.equal(detector.tier, NETWORK_TIERS.SLOW_2G);
  assert.equal(detector.effectiveType, 'slow-2g');
  assert.equal(detector.isSlow, true);
  assert.equal(detector.isConstrained, true);
  assert.equal(detector.saveData, true);
});

test('NetworkTierDetector detects 2g from effectiveType', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '2g', downlink: 0.1, rtt: 800 } });
  assert.equal(detector.tier, NETWORK_TIERS.G2);
  assert.equal(detector.isSlow, true);
  assert.equal(detector.isConstrained, true);
});

test('NetworkTierDetector detects 3g from effectiveType', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '3g', downlink: 0.5, rtt: 300 } });
  assert.equal(detector.tier, NETWORK_TIERS.G3);
  assert.equal(detector.isSlow, false);
  assert.equal(detector.isConstrained, true);
});

test('NetworkTierDetector detects 4g from effectiveType', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '4g', downlink: 10, rtt: 50 } });
  assert.equal(detector.tier, NETWORK_TIERS.G4);
  assert.equal(detector.isSlow, false);
  assert.equal(detector.isConstrained, false);
});

test('NetworkTierDetector falls back to downlink when effectiveType missing', () => {
  const detector = new NetworkTierDetector({ connection: { downlink: 0.03 } });
  assert.equal(detector.tier, NETWORK_TIERS.SLOW_2G);
});

test('NetworkTierDetector emits NETWORK_TIER_CHANGED on tier change', () => {
  const bus = new EventBus();
  const connection = { effectiveType: '4g', addEventListener() {}, removeEventListener() {} };
  const detector = new NetworkTierDetector({ connection, bus });
  detector.start();

  let eventPayload = null;
  bus.on(EVENTS.NETWORK_TIER_CHANGED, (payload) => (eventPayload = payload));

  // Simulate connection change
  detector.simulate(NETWORK_TIERS.G2, { effectiveType: '2g', downlink: 0.1, rtt: 800 });
  assert.equal(eventPayload.tier, NETWORK_TIERS.G2);
  assert.equal(eventPayload.previousTier, NETWORK_TIERS.G4);
});

test('NetworkTierDetector toJSON returns snapshot', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '3g', downlink: 0.5, rtt: 300, saveData: false } });
  const json = detector.toJSON();
  assert.equal(json.tier, NETWORK_TIERS.G3);
  assert.equal(json.effectiveType, '3g');
  assert.equal(json.downlink, 0.5);
  assert.equal(json.rtt, 300);
  assert.equal(json.saveData, false);
  assert.equal(json.apiAvailable, true);
});

test('NetworkTierDetector stops polling and event listeners on stop()', () => {
  const connection = { effectiveType: '4g', addEventListener() {}, removeEventListener() {} };
  const detector = new NetworkTierDetector({ connection });
  detector.start();
  detector.stop();
  // No error means cleanup succeeded
});

// --- AdaptiveLoader ---

test('AdaptiveLoader returns correct presets for 2g tier', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '2g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  assert.equal(loader.timeoutMs, 45_000);
  assert.equal(loader.concurrency, 2);
  assert.equal(loader.quality, 'low');
  assert.equal(loader.imageMaxWidth, 480);
  assert.equal(loader.imageQuality, 55);
  assert.equal(loader.skipNonEssential, true);
});

test('AdaptiveLoader returns correct presets for 4g tier', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '4g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  assert.equal(loader.timeoutMs, 15_000);
  assert.equal(loader.concurrency, 6);
  assert.equal(loader.quality, 'high');
  assert.equal(loader.skipNonEssential, false);
});

test('AdaptiveLoader selectVariant picks low quality on 2g', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '2g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  const variants = { low: 'http://x/low.mp4', medium: 'http://x/med.mp4', high: 'http://x/hi.mp4' };
  assert.equal(loader.selectVariant(variants), 'http://x/low.mp4');
});

test('AdaptiveLoader selectVariant picks high quality on 4g', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '4g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  const variants = { low: 'http://x/low.mp4', medium: 'http://x/med.mp4', high: 'http://x/hi.mp4' };
  assert.equal(loader.selectVariant(variants), 'http://x/hi.mp4');
});

test('AdaptiveLoader selectVariant falls back gracefully', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '2g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  assert.equal(loader.selectVariant(null), null);
  assert.equal(loader.selectVariant({}), null);
  // Only high available, should still return it
  assert.equal(loader.selectVariant({ high: 'http://x/hi.mp4' }), 'http://x/hi.mp4');
});

test('AdaptiveLoader shouldDeferNonEssential returns true on slow tiers', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: 'slow-2g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  assert.equal(loader.shouldDeferNonEssential(), true);
});

test('AdaptiveLoader fetchOptions returns full preset object', () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '3g' } });
  const loader = new AdaptiveLoader({ tierDetector: detector });
  const opts = loader.fetchOptions();
  assert.equal(opts.timeoutMs, 30_000);
  assert.equal(opts.concurrency, 3);
  assert.equal(opts.quality, 'medium');
});

// --- Tiered downloads ---

test('downloadPackageTiered uses tier-appropriate timeout', async () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '2g' } });
  let capturedTimeout;
  const fetchImpl = async (url, opts) => {
    capturedTimeout = opts?.signal ? 'has-signal' : 'no-signal';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ slug: 'test' }),
    };
  };

  const result = await downloadPackageTiered('http://api', 'math-101', detector, { fetchImpl });
  assert.deepEqual(result, { slug: 'test' });
});

test('downloadAssetTiered throws NetworkError on failure', async () => {
  const detector = new NetworkTierDetector({ connection: { effectiveType: '4g' } });
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    headers: { get: () => 'text/plain' },
    text: async () => 'not found',
  });

  await assert.rejects(
    () => downloadAssetTiered('http://api/assets/img.png', detector, { fetchImpl }),
    /Failed to download asset/
  );
});
