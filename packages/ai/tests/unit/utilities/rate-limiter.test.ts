import { RateLimiter } from '../../../src/utilities/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
  });

  it('should allow requests within limit', async () => {
    expect(await limiter.acquire('test')).toBe(true);
    expect(await limiter.acquire('test')).toBe(true);
    expect(await limiter.acquire('test')).toBe(true);
  });

  it('should block requests exceeding limit', async () => {
    await limiter.acquire('test');
    await limiter.acquire('test');
    await limiter.acquire('test');
    expect(await limiter.acquire('test')).toBe(false);
  });

  it('should report correct remaining count', () => {
    expect(limiter.getRemaining('test')).toBe(3);
    limiter.acquire('test');
    expect(limiter.getRemaining('test')).toBe(2);
  });

  it('should reset window', () => {
    limiter.acquire('test');
    limiter.acquire('test');
    limiter.acquire('test');
    limiter.reset('test');
    expect(limiter.getRemaining('test')).toBe(3);
  });
});
