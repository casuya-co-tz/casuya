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
import { CasuyaAIError, ErrorCode, withRetry } from '../../utilities';
import { Logger } from '../../utilities/logger';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface OpenAIChoice {
  message?: { content?: string };
  delta?: { content?: string };
  finish_reason?: string;
}

interface OpenAICompletionResult {
  id: string;
  model: string;
  choices: OpenAIChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAIEmbeddingResult {
  model: string;
  data: Array<{ embedding: number[] }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

export class OpenAIProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig, logger?: Logger) {
    super(config, logger);
    this.baseUrl = config.endpoint ?? OPENAI_BASE_URL;
  }

  get type(): string {
    return 'openai';
  }

  get supportedCapabilities(): ModelCapability[] {
    return [
      ModelCapability.CHAT,
      ModelCapability.EMBEDDINGS,
      ModelCapability.SUMMARIZATION,
      ModelCapability.TRANSLATION,
      ModelCapability.MODERATION,
      ModelCapability.QUESTION_GENERATION,
      ModelCapability.CODE,
      ModelCapability.VISION,
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.validateRequest(request);

    return withRetry(async () => {
      const { result, latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: request.model ?? this.config.model ?? 'gpt-4o',
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens,
            top_p: request.topP,
            frequency_penalty: request.frequencyPenalty,
            presence_penalty: request.presencePenalty,
            stop: request.stop,
          }),
        });

        if (!response.ok) {
          await this.handleError(response);
        }

        return (await response.json()) as OpenAICompletionResult;
      });

      return {
        id: result.id,
        model: result.model,
        content: result.choices[0]?.message?.content ?? '',
        usage: {
          promptTokens: result.usage?.prompt_tokens ?? 0,
          completionTokens: result.usage?.completion_tokens ?? 0,
          totalTokens: result.usage?.total_tokens ?? 0,
        },
        finishReason: result.choices[0]?.finish_reason ?? 'stop',
        latency,
      };
    }, { maxRetries: this.config.maxRetries ?? 3 });
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    this.validateRequest(request);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model ?? this.config.model ?? 'gpt-4o',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new CasuyaAIError('Stream not available', ErrorCode.PROVIDER_INVALID_RESPONSE);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const data = JSON.parse(jsonStr) as OpenAICompletionResult;
          const content = data.choices?.[0]?.delta?.content ?? '';
          if (content) {
            yield { content, done: false };
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.validateEmbeddingRequest(request);

    return withRetry(async () => {
      const { result, latency } = await this.measureLatency(async () => {
        const input = typeof request.input === 'string' ? [request.input] : request.input;
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: request.model ?? 'text-embedding-3-small',
            input,
          }),
        });

        if (!response.ok) {
          await this.handleError(response);
        }

        return (await response.json()) as OpenAIEmbeddingResult;
      });

      return {
        model: result.model,
        embeddings: result.data.map((d) => d.embedding),
        usage: {
          promptTokens: result.usage?.prompt_tokens ?? 0,
          completionTokens: 0,
          totalTokens: result.usage?.total_tokens ?? 0,
        },
        latency,
      };
    });
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey ?? ''}`,
    };
  }

  private async handleError(response: Response): Promise<never> {
    const body = await response.text();
    let parsed: { error?: { message?: string; code?: string } } = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      // ignore parse errors
    }

    const message = parsed.error?.message ?? `OpenAI API error: ${response.status}`;

    switch (response.status) {
      case 429:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_RATE_LIMITED);
      case 401:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_AUTH_FAILED);
      case 500:
      case 502:
      case 503:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_UNAVAILABLE);
      default:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_INVALID_RESPONSE);
    }
  }
}
