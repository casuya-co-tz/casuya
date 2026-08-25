import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { ProviderFactory } from '../providers/provider-factory';
import { ResponseCache } from '../caching/response-cache';
import { Logger } from '../utilities/logger';
import { CasuyaAIError, ErrorCode } from '../utilities';

export class ProviderAdapter {
  private logger: Logger;
  private cache: ResponseCache;
  private defaultProvider?: string;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger({ prefix: '[ProviderAdapter]' });
    this.cache = new ResponseCache({}, this.logger);
  }

  async chat(
    providerName: string,
    request: ChatCompletionRequest,
    useCache: boolean = true,
  ): Promise<ChatCompletionResponse> {
    const provider = this.getProvider(providerName);

    if (useCache) {
      const cacheKey = { messages: request.messages, model: request.model, temperature: request.temperature };
      const cached = this.cache.get('chat', cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const response = await provider.chatCompletion(request);

    if (useCache && request.messages.length <= 2) {
      this.cache.set(
        'chat',
        { messages: request.messages, model: request.model, temperature: request.temperature },
        JSON.stringify(response),
      );
    }

    return response;
  }

  async streamChat(
    providerName: string,
    request: ChatCompletionRequest,
  ): Promise<AsyncIterable<import('../types').StreamChunk>> {
    const provider = this.getProvider(providerName);
    return provider.chatCompletionStream(request);
  }

  async embed(
    providerName: string,
    request: EmbeddingRequest,
  ): Promise<EmbeddingResponse> {
    const provider = this.getProvider(providerName);

    const cacheKey = { input: request.input, model: request.model };
    const cached = this.cache.get('embed', cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await provider.generateEmbeddings(request);
    this.cache.set('embed', cacheKey, JSON.stringify(response));

    return response;
  }

  setDefaultProvider(providerName: string): void {
    this.defaultProvider = providerName;
    this.logger.info(`Default provider set: ${providerName}`);
  }

  private getProvider(name?: string): BaseProvider {
    const providerName = name ?? this.defaultProvider;
    if (!providerName) {
      throw new CasuyaAIError(
        'No provider specified and no default provider set',
        ErrorCode.PROVIDER_NOT_FOUND,
      );
    }
    const provider = ProviderFactory.getProvider(providerName);
    if (!provider) {
      throw new CasuyaAIError(
        `Provider not found: ${providerName}`,
        ErrorCode.PROVIDER_NOT_FOUND,
      );
    }
    return provider;
  }
}
