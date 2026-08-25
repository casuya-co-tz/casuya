import { withRetry } from '../../../src/utilities/retry';

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
