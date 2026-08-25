import { Summarizer } from '../../../src/summarization/summarizer';
import { PromptManager } from '../../../src/prompts/prompt-manager';
import { getTemplateById } from '../../../src/prompts/template-library';
import { BaseProvider } from '../../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../../src/types/providers';
import { SummarizationStrategy, SummaryLength } from '../../../src/types/summarization';
import { Language, Difficulty } from '../../../src/types/common';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../../src/types/providers';

class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT, ModelCapability.SUMMARIZATION]; }
  async chatCompletion(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      id: 'mock-id', model: 'mock-model', content: 'This is a summary of the provided text.',
      usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 }, finishReason: 'stop', latency: 100,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: 'mock', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return { model: 'mock', embeddings: [[0.1]], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency: 0 };
  }
}

describe('Summarizer', () => {
  let summarizer: Summarizer;
  let provider: MockProvider;
  let promptManager: PromptManager;

  beforeEach(() => {
    provider = new MockProvider({ type: ProviderType.LOCAL });
    promptManager = new PromptManager();
    const template = getTemplateById('summarization-educational');
    if (template) promptManager.registerTemplate(template);
    summarizer = new Summarizer(provider, promptManager);
  });

  const longText = 'Artificial intelligence is transforming education. Students can now receive personalized tutoring.';

  it('should generate an extractive summary', async () => {
    const result = await summarizer.summarize({
      content: longText, strategy: SummarizationStrategy.EXTRACTIVE,
      length: SummaryLength.SHORT, language: Language.ENGLISH,
    });
    expect(result.summary).toBeDefined();
    expect(result.strategy).toBe(SummarizationStrategy.EXTRACTIVE);
  });

  it('should generate an abstractive summary', async () => {
    const result = await summarizer.summarize({
      content: longText, strategy: SummarizationStrategy.ABSTRACTIVE,
      length: SummaryLength.MEDIUM, language: Language.ENGLISH,
    });
    expect(result.summary).toBeDefined();
    expect(result.strategy).toBe(SummarizationStrategy.ABSTRACTIVE);
  });

  it('should generate a hybrid summary', async () => {
    const result = await summarizer.summarize({
      content: longText, strategy: SummarizationStrategy.HYBRID,
      length: SummaryLength.MEDIUM, language: Language.ENGLISH,
    });
    expect(result.summary).toBeDefined();
    expect(result.strategy).toBe(SummarizationStrategy.HYBRID);
  });

  it('should include key points and compression ratio', async () => {
    const result = await summarizer.summarize({
      content: longText, strategy: SummarizationStrategy.EXTRACTIVE,
      length: SummaryLength.SHORT, language: Language.ENGLISH,
    });
    expect(Array.isArray(result.keyPoints)).toBe(true);
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.originalLength).toBeGreaterThan(0);
  });

  it('should handle difficulty option', async () => {
    const result = await summarizer.summarize({
      content: longText, strategy: SummarizationStrategy.ABSTRACTIVE,
      length: SummaryLength.MEDIUM, language: Language.ENGLISH, difficulty: Difficulty.BEGINNER,
    });
    expect(result.summary).toBeDefined();
  });

  it('should throw on provider failure', async () => {
    const failingProvider = new (class extends BaseProvider {
      get type(): string { return 'failing'; }
      get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
      async chatCompletion(): Promise<ChatCompletionResponse> { throw new Error('API Error'); }
      async *chatCompletionStream(): AsyncIterable<StreamChunk> { yield { content: '', done: true }; }
      async generateEmbeddings(): Promise<EmbeddingResponse> { throw new Error('fail'); }
    })({ type: ProviderType.LOCAL });
    const badSummarizer = new Summarizer(failingProvider, promptManager);
    await expect(badSummarizer.summarize({
      content: longText, strategy: SummarizationStrategy.ABSTRACTIVE,
      length: SummaryLength.SHORT, language: Language.ENGLISH,
    })).rejects.toThrow();
  });
});
