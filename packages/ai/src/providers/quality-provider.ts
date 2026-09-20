import { ProviderConfig, ProviderType } from '../types';
import { FreeProviderSpec } from './free-chain';

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Optional high-quality tutor provider for teacher `deep` mode.
 * Enabled when ANTHROPIC_API_KEY is set or CASUYA_AI_QUALITY_PROVIDER=anthropic.
 */
export function buildQualityProviderSpec(): FreeProviderSpec | null {
  const forced = (env('CASUYA_AI_QUALITY_PROVIDER') || '').toLowerCase();
  const anthropicKey = env('ANTHROPIC_API_KEY');
  if (forced && forced !== 'anthropic') return null;
  if (!anthropicKey && forced !== 'anthropic') return null;

  return {
    name: 'quality',
    config: {
      type: ProviderType.ANTHROPIC,
      apiKey: anthropicKey,
      model: env('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022',
      maxRetries: 1,
      timeout: 45000,
    } as ProviderConfig,
  };
}
