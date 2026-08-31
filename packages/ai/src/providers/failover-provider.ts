import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ModelCapability,
  ProviderConfig,
  ProviderType,
  StreamChunk,
} from '../types';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';
import { BaseProvider } from './base-provider';

const EMPTY = new CasuyaAIError('Provider returned empty content', ErrorCode.PROVIDER_INVALID_RESPONSE);

export class FailoverProvider extends BaseProvider {
  constructor(
    private readonly providers: BaseProvider[],
    private readonly names: string[],
    logger?: Logger,
  ) {
    super(
      {
        type: ProviderType.LOCAL,
        model: 'failover',
      } as ProviderConfig,
      logger ?? new Logger({ prefix: '[Failover]' }),
    );
    if (!providers.length) {
      throw new CasuyaAIError('Failover chain is empty', ErrorCode.CONFIGURATION_ERROR);
    }
  }

  get type(): string {
    return 'failover';
  }

  get chain(): string[] {
    return [...this.names];
  }

  get supportedCapabilities(): ModelCapability[] {
    return [ModelCapability.CHAT, ModelCapability.QUESTION_GENERATION, ModelCapability.SUMMARIZATION, ModelCapability.TRANSLATION];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.validateRequest(request);
    const errors: string[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const name = this.names[i] ?? this.providers[i].type;
      try {
        const result = await this.providers[i].chatCompletion(request);
        const content = (result.content ?? '').trim();
        if (content) {
          if (i > 0) {
            this.logger.info(`Answer served by fallback provider: ${name}`);
          }
          return { ...result, content };
        }
        errors.push(`${name}: empty content`);
        this.logger.warn(`Provider ${name} returned empty content, trying next`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${name}: ${message}`);
        this.logger.warn(`Provider ${name} failed, trying next`, { error: message });
      }
    }

    throw new CasuyaAIError(
      `All providers failed (${errors.join(' | ')})`,
      ErrorCode.PROVIDER_UNAVAILABLE,
      undefined,
      { errors },
    );
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    this.validateRequest(request);
    const errors: string[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const name = this.names[i] ?? this.providers[i].type;
      const chunks: StreamChunk[] = [];
      try {
        for await (const chunk of this.providers[i].chatCompletionStream(request)) {
          chunks.push(chunk);
        }
        const text = chunks.map((c) => c.content).join('').trim();
        if (text) {
          for (const chunk of chunks) {
            yield chunk;
          }
          if (!chunks.some((c) => c.done)) {
            yield { content: '', done: true };
          }
          return;
        }
        errors.push(`${name}: empty stream`);
        this.logger.warn(`Provider ${name} streamed empty content, trying next`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${name}: ${message}`);
        this.logger.warn(`Provider ${name} stream failed, trying next`, { error: message });
      }
    }

    throw new CasuyaAIError(
      `All providers failed to stream (${errors.join(' | ')})`,
      ErrorCode.PROVIDER_UNAVAILABLE,
      undefined,
      { errors },
    );
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const errors: string[] = [];
    for (let i = 0; i < this.providers.length; i++) {
      const name = this.names[i] ?? this.providers[i].type;
      try {
        return await this.providers[i].generateEmbeddings(request);
      } catch (error) {
        errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new CasuyaAIError(
      `All providers failed embeddings (${errors.join(' | ')})`,
      ErrorCode.UNSUPPORTED_OPERATION,
    );
  }
}

export { EMPTY as EMPTY_PROVIDER_CONTENT };
