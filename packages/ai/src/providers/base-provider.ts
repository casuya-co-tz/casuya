import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderConfig,
  ProviderHealth,
  ModelCapability,
  StreamChunk,
} from '../types';
import { CasuyaAIError, ErrorCode } from '../utilities';
import { Logger } from '../utilities/logger';

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected logger: Logger;
  protected initialized: boolean = false;

  constructor(config: ProviderConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger ?? new Logger({ prefix: `[${config.type}]` });
  }

  abstract get type(): string;
  abstract get supportedCapabilities(): ModelCapability[];

  abstract chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  abstract chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;
  abstract generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  async initialize(): Promise<void> {
    this.initialized = true;
    this.logger.info(`Provider initialized: ${this.config.type}`);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.chatCompletion({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
      });
      return {
        healthy: true,
        latency: Date.now() - start,
        model: this.config.model ?? 'unknown',
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        model: this.config.model ?? 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.logger.info('Provider shutdown complete');
  }

  protected validateRequest(request: ChatCompletionRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new CasuyaAIError(
        'Chat completion request must have at least one message',
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  protected validateEmbeddingRequest(request: EmbeddingRequest): void {
    if (!request.input || (Array.isArray(request.input) && request.input.length === 0)) {
      throw new CasuyaAIError(
        'Embedding request must have input text',
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  protected async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> {
    const start = Date.now();
    const result = await fn();
    return { result, latency: Date.now() - start };
  }
}
