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

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiContent {
  parts: Array<{ text: string }>;
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
}

interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiCompletionResult {
  candidates?: GeminiCandidate[];
  modelVersion?: string;
  usageMetadata?: GeminiUsage;
}

interface GeminiEmbeddingResult {
  embedding?: { values?: number[] };
}

export class GeminiProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig, logger?: Logger) {
    super(config, logger);
    this.baseUrl = config.endpoint ?? GEMINI_BASE_URL;
  }

  get type(): string {
    return 'gemini';
  }

  get supportedCapabilities(): ModelCapability[] {
    return [
      ModelCapability.CHAT,
      ModelCapability.EMBEDDINGS,
      ModelCapability.SUMMARIZATION,
      ModelCapability.TRANSLATION,
      ModelCapability.QUESTION_GENERATION,
      ModelCapability.CODE,
      ModelCapability.VISION,
    ];
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.validateRequest(request);

    return withRetry(async () => {
      const { result, latency } = await this.measureLatency(async () => {
        const model = request.model ?? this.config.model ?? 'gemini-1.5-pro';
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;

        const contents = this.convertMessages(request.messages);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              maxOutputTokens: request.maxTokens,
              topP: request.topP,
              stopSequences: request.stop,
            },
          }),
        });

        if (!response.ok) {
          await this.handleError(response);
        }

        return (await response.json()) as GeminiCompletionResult;
      });

      const modelName = request.model ?? this.config.model ?? 'gemini-1.5-pro';
      const candidate = result.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text ?? '';
      const finishReason = candidate?.finishReason ?? 'STOP';

      return {
        id: `gemini-${Date.now()}`,
        model: result.modelVersion ?? modelName,
        content,
        usage: {
          promptTokens: result.usageMetadata?.promptTokenCount ?? 0,
          completionTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: result.usageMetadata?.totalTokenCount ?? 0,
        },
        finishReason: finishReason.toLowerCase(),
        latency,
      };
    }, { maxRetries: this.config.maxRetries ?? 3 });
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model ?? this.config.model ?? 'gemini-1.5-pro';
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.config.apiKey}`;

    const contents = this.convertMessages(request.messages);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
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
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed) as GeminiCompletionResult;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (text) {
            yield { content: text, done: false };
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
        const model = 'text-embedding-004';
        const url = `${this.baseUrl}/models/${model}:embedContent?key=${this.config.apiKey}`;

        const input = typeof request.input === 'string' ? [request.input] : request.input;
        const responses = await Promise.all(
          input.map(async (text) => {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: { parts: [{ text }] },
              }),
            });
            if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
            return (await res.json()) as GeminiEmbeddingResult;
          }),
        );

        return responses;
      });

      return {
        model: 'text-embedding-004',
        embeddings: result.map((r: GeminiEmbeddingResult) => r.embedding?.values ?? []),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latency,
      };
    });
  }

  private convertMessages(messages: { role: string; content: string }[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    for (const msg of messages) {
      const role = msg.role === 'system' ? 'user' : msg.role;
      const existing = contents[contents.length - 1];
      if (existing && (existing as { role?: string }).role === role) {
        existing.parts.push({ text: msg.content });
      } else {
        contents.push({ parts: [{ text: msg.content }] } as GeminiContent & { role?: string });
        (contents[contents.length - 1] as { role?: string }).role = role;
      }
    }
    return contents;
  }

  private async handleError(response: Response): Promise<never> {
    const body = await response.text();
    let parsed: { error?: { message?: string } } = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      // ignore
    }

    const message = parsed.error?.message ?? `Gemini API error: ${response.status}`;
    switch (response.status) {
      case 429:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_RATE_LIMITED);
      case 403:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_AUTH_FAILED);
      default:
        throw new CasuyaAIError(message, ErrorCode.PROVIDER_INVALID_RESPONSE);
    }
  }
}
