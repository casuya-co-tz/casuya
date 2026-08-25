import { BaseProvider } from '../base-provider';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderConfig,
  ModelCapability,
  StreamChunk,
} from '../../types';
import { CasuyaAIError, ErrorCode } from '../../utilities';
import { Logger } from '../../utilities/logger';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_LOCAL_MODEL = 'llama3.2';

interface LocalChatResult {
  message?: { content?: string };
  done?: boolean;
}

interface LocalEmbeddingResult {
  embedding?: number[];
}

export class LocalProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig, logger?: Logger) {
    super(config, logger);
    this.baseUrl = config.endpoint ?? DEFAULT_OLLAMA_URL;
  }

  get type(): string {
    return 'local';
  }

  get supportedCapabilities(): ModelCapability[] {
    return [
      ModelCapability.CHAT,
      ModelCapability.EMBEDDINGS,
      ModelCapability.SUMMARIZATION,
      ModelCapability.TRANSLATION,
      ModelCapability.QUESTION_GENERATION,
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.validateRequest(request);

    const model = request.model ?? this.config.model ?? DEFAULT_LOCAL_MODEL;
    const { result, latency } = await this.measureLatency(async () => {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: request.messages,
          options: {
            temperature: request.temperature ?? 0.7,
            top_p: request.topP,
            stop: request.stop,
          },
        }),
      });

      if (!response.ok) {
        throw new CasuyaAIError(
          `Local provider error: ${response.statusText}`,
          ErrorCode.PROVIDER_UNAVAILABLE,
        );
      }

      return (await response.json()) as LocalChatResult;
    });

    return {
      id: `local-${Date.now()}`,
      model,
      content: result.message?.content ?? '',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: 'stop',
      latency,
    };
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    this.validateRequest(request);

    const model = request.model ?? this.config.model ?? DEFAULT_LOCAL_MODEL;
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new CasuyaAIError(
        `Local provider stream error: ${response.statusText}`,
        ErrorCode.PROVIDER_UNAVAILABLE,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new CasuyaAIError('Stream not available', ErrorCode.PROVIDER_INVALID_RESPONSE);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        yield { content: '', done: true };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed) as LocalChatResult;
          if (data.done) {
            yield { content: '', done: true };
            return;
          }
          if (data.message?.content) {
            yield { content: data.message.content, done: false };
          }
        } catch {
          // skip malformed
        }
      }
    }
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateEmbeddingRequest(request);

    const model = 'nomic-embed-text';
    const { result, latency } = await this.measureLatency(async () => {
      const input = typeof request.input === 'string' ? [request.input] : request.input;
      const embeddings: number[][] = [];

      for (const text of input) {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
        });

        if (!response.ok) {
          throw new CasuyaAIError(
            `Embedding error: ${response.statusText}`,
            ErrorCode.PROVIDER_UNAVAILABLE,
          );
        }

        const data = (await response.json()) as LocalEmbeddingResult;
        embeddings.push(data.embedding ?? []);
      }

      return embeddings;
    });

    return {
      model,
      embeddings: result,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latency,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number; model: string; error?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (response.ok) {
        return { healthy: true, latency: Date.now() - start, model: this.config.model ?? DEFAULT_LOCAL_MODEL };
      }
      return { healthy: false, latency: Date.now() - start, model: this.config.model ?? DEFAULT_LOCAL_MODEL, error: 'Not available' };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        model: this.config.model ?? DEFAULT_LOCAL_MODEL,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}
