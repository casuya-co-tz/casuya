import { HttpError, isAuthorized, readApiKey } from '../../../server-security';

describe('server-security', () => {
  const originalAiKey = process.env.CASUYA_AI_API_KEY;
  const originalApiKey = process.env.API_KEY;

  afterEach(() => {
    if (originalAiKey === undefined) delete process.env.CASUYA_AI_API_KEY;
    else process.env.CASUYA_AI_API_KEY = originalAiKey;
    if (originalApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalApiKey;
  });

  it('allows all requests when API key is unset', () => {
    delete process.env.CASUYA_AI_API_KEY;
    delete process.env.API_KEY;
    expect(readApiKey()).toBeUndefined();
    expect(isAuthorized(undefined, undefined)).toBe(true);
  });

  it('rejects missing or wrong API key when configured', () => {
    expect(isAuthorized('secret-key', undefined)).toBe(false);
    expect(isAuthorized('secret-key', 'wrong-key')).toBe(false);
    expect(isAuthorized('secret-key', 'secret-key')).toBe(true);
  });

  it('HttpError carries status code', () => {
    const err = new HttpError(503, 'unavailable');
    expect(err.statusCode).toBe(503);
    expect(err.message).toBe('unavailable');
  });
});
