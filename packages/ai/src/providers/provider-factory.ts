import { ProviderConfig, ProviderType } from '../types';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';
import { BaseProvider } from './base-provider';
import { OpenAIProvider } from './openai/openai-provider';
import { GeminiProvider } from './gemini/gemini-provider';
import { AnthropicProvider } from './anthropic/anthropic-provider';
import { LocalProvider } from './local-models/local-provider';

export class ProviderFactory {
  private static providers: Map<string, BaseProvider> = new Map();
  private static logger = new Logger({ prefix: '[ProviderFactory]' });

  static createProvider(config: ProviderConfig): BaseProvider {
    switch (config.type) {
      case ProviderType.OPENAI:
        return new OpenAIProvider(config);
      case ProviderType.GEMINI:
        return new GeminiProvider(config);
      case ProviderType.ANTHROPIC:
        return new AnthropicProvider(config);
      case ProviderType.LOCAL:
        return new LocalProvider(config);
      default:
        throw new CasuyaAIError(
          `Unsupported provider type: ${config.type}`,
          ErrorCode.PROVIDER_NOT_FOUND,
        );
    }
  }

  static getProvider(name: string): BaseProvider | undefined {
    return ProviderFactory.providers.get(name);
  }

  static registerProvider(name: string, provider: BaseProvider): void {
    ProviderFactory.providers.set(name, provider);
    ProviderFactory.logger.info(`Provider registered: ${name}`);
  }

  static async initializeProviders(configs: Map<string, ProviderConfig>): Promise<void> {
    for (const [name, config] of configs) {
      try {
        const provider = ProviderFactory.createProvider(config);
        await provider.initialize();
        ProviderFactory.registerProvider(name, provider);
      } catch (error) {
        ProviderFactory.logger.error(`Failed to initialize provider ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  static async shutdownAll(): Promise<void> {
    for (const [name, provider] of ProviderFactory.providers) {
      try {
        await provider.shutdown();
        ProviderFactory.logger.info(`Provider shutdown: ${name}`);
      } catch (error) {
        ProviderFactory.logger.error(`Error shutting down provider ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    ProviderFactory.providers.clear();
  }

  static listProviders(): string[] {
    return Array.from(ProviderFactory.providers.keys());
  }
}
