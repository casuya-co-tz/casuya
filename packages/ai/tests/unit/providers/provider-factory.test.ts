import { ProviderFactory } from '../../../src/providers/provider-factory';
import { ProviderType } from '../../../src/types/providers';

describe('ProviderFactory', () => {
  afterAll(async () => {
    await ProviderFactory.shutdownAll();
  });

  it('should create local provider from config', () => {
    const provider = ProviderFactory.createProvider({
      type: ProviderType.LOCAL,
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
    });
    expect(provider).toBeDefined();
    expect(provider.type).toBe('local');
  });

  it('should throw for unsupported provider type', () => {
    expect(() => ProviderFactory.createProvider({} as any)).toThrow();
  });

  it('should register and retrieve custom provider', () => {
    const provider = ProviderFactory.createProvider({
      type: ProviderType.LOCAL,
      endpoint: 'http://localhost:11434',
    });
    ProviderFactory.registerProvider('test-custom', provider);
    const retrieved = ProviderFactory.getProvider('test-custom');
    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe('local');
  });

  it('should list registered provider names', () => {
    const provider = ProviderFactory.createProvider({ type: ProviderType.LOCAL });
    ProviderFactory.registerProvider('list-test', provider);
    const providers = ProviderFactory.listProviders();
    expect(providers).toContain('list-test');
  });
});
