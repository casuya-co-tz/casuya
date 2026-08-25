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

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

interface AnthropicContent {
  text?: string;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicCompletionResult {
  id: string;
  model: string;
  content?: AnthropicContent[];
  usage?: AnthropicUsage;
  stop_reason?: string;
}

export class AnthropicProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig, logger?: Logger) {
    super(config, logger);
    this.baseUrl = config.endpoint ?? ANTHROPIC_BASE_URL;
  }

  get type(): string {
    return 'anthropic';
  }

  get supportedCapabilities(): ModelCapability[] {
    return [
      ModelCapability.CHAT,
      ModelCapability.SUMMARIZATION,
      ModelCapability.TRANSLATION,
      ModelCapability.QUESTION_GENERATION,
      ModelCapability.CODE,
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.validateRequest(request);

    return withRetry(async () => {
      const { result, latency } = await this.measureLatency(async () => {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: request.model ?? this.config.model ?? 'claude-3-5-sonnet-20241022',
            max_tokens: request.maxTokens ?? 4096,
            messages: request.messages.filter((m) => m.role !== 'system'),
            system: this.findSystemMessage(request.messages),
            temperature: request.temperature ?? 0.7,
            top_p: request.topP,
            stop_sequences: request.stop,
          }),
        });

        if (!response.ok) {
          await this.handleError(response);
        }

        return (await response.json()) as AnthropicCompletionResult;
      });

      return {
        id: result.id,
        model: result.model,
        content: result.content?.[0]?.text ?? '',
        usage: {
          promptTokens: result.usage?.input_tokens ?? 0,
          completionTokens: result.usage?.output_tokens ?? 0,
          totalTokens: (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0),
        },
        finishReason: result.stop_reason ?? 'end_turn',
        latency,
      };
    }, { maxRetries: this.config.maxRetries ?? 3 });
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    this.validateRequest(request);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model ?? this.config.model ?? 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens ?? 4096,
        messages: request.messages.filter((m) => m.role !== 'system'),
        system: this.findSystemMessage(request.messages),
        temperature: request.temperature ?? 0.7,
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
      if (done) {
        yield { content: '', done: true };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const data = JSON.parse(jsonStr) as { type?: string; delta?: { text?: string } };
          if (data.type === 'content_block_delta') {
            const text = data.delta?.text ?? '';
            if (text) {
              yield { content: text, done: false };
            }
          }
        } catch {
          // skip malformed
        }
      }
    }
  }

  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new CasuyaAIError(
      'Embeddings not supported by Anthropic provider',
      ErrorCode.MODEL_CAPABILITY_MISSING,
    );
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    };
  }

  private findSystemMessage(messages: { role: string; content: string }[]): string {
    return messages.find((m) => m.role === 'system')?.content ?? '';
  }

  private async handleError(response: Response): Promise<never> {
    const body = await response.text();
    let parsed: { error?: { message?: string } } = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      // ignore
    }

    const message = parsed.error?.message ?? `Anthropic API error: ${response.status}`;
    switch (response.status) {
      case 429:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_RATE_LIMITED);
      case 401:
      case 403:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_AUTH_FAILED);
      default:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_INVALID_RESPONSE);
    }
  }
}
