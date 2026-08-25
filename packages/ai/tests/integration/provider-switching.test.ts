import { ProviderFactory } from '../../src/providers/provider-factory';
import { ProviderType } from '../../src/types';

describe('Provider Switching Integration', () => {
  afterAll(async () => {
    await ProviderFactory.shutdownAll();
  });

  it('should create local provider by default', () => {
    const provider = ProviderFactory.createProvider({
      type: ProviderType.LOCAL,
      model: 'llama3.2',
    });

    expect(provider).toBeDefined();
    expect(provider.type).toBe('local');
  });

  it('should register and retrieve providers', () => {
    const provider = ProviderFactory.createProvider({
      type: ProviderType.LOCAL,
      model: 'llama3.2',
    });

    ProviderFactory.registerProvider('test-local', provider);
    expect(ProviderFactory.getProvider('test-local')).toBe(provider);
  });

  it('should list registered providers', () => {
    const providers = ProviderFactory.listProviders();
    expect(Array.isArray(providers)).toBe(true);
  });

  it('should throw for unsupported provider type', () => {
    expect(() =>
      ProviderFactory.createProvider({
        type: 'unknown' as ProviderType,
      }),
    ).toThrow();
  });
});
