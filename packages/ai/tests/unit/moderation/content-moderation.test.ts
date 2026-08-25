import { ContentModerator } from '../../../src/moderation/content-moderation';
import { PromptManager } from '../../../src/prompts/prompt-manager';
import { getTemplateById } from '../../../src/prompts/template-library';
import { BaseProvider } from '../../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../../src/types/providers';
import { ModerationContentType, FlagType, ModerationAction } from '../../../src/types/moderation';
import { Language } from '../../../src/types/common';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../../src/types/providers';

class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT, ModelCapability.MODERATION]; }
  async chatCompletion(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      id: 'mock-id', model: 'mock-model',
      content: JSON.stringify({ approved: true, flags: [], score: { overall: 0.02 }, action: 'allow', reviewedBy: 'ai', timestamp: new Date().toISOString() }),
      usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 }, finishReason: 'stop', latency: 100,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: 'mock', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return { model: 'mock', embeddings: [[0.1]], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency: 0 };
  }
}

describe('ContentModerator', () => {
  let moderator: ContentModerator;
  let provider: MockProvider;
  let promptManager: PromptManager;

  beforeEach(() => {
    provider = new MockProvider({ type: ProviderType.LOCAL });
    promptManager = new PromptManager();
    const template = getTemplateById('moderation-content');
    if (template) promptManager.registerTemplate(template);
    moderator = new ContentModerator(provider, promptManager);
  });

  it('should approve safe content', async () => {
    const result = await moderator.moderate({
      content: 'This is an educational lesson about math.',
      contentType: ModerationContentType.TEXT, language: Language.ENGLISH,
    });
    expect(result.approved).toBe(true);
  });

  it('should check age appropriateness', async () => {
    const result = await moderator.checkAgeAppropriateness('Introduction to biology for young learners', 10);
    expect(result).toBeDefined();
    expect(result.appropriate).toBeDefined();
  });

  it('should support adding custom policies', () => {
    moderator.addPolicy({
      id: 'custom-policy', name: 'Custom Policy', description: 'Custom moderation rule',
      flags: [FlagType.SPAM], action: ModerationAction.FLAG, threshold: 0.7, enabled: true,
    });
  });

  it('should handle provider failure gracefully', async () => {
    const failingProvider = new (class extends BaseProvider {
      get type(): string { return 'failing'; }
      get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
      async chatCompletion(): Promise<ChatCompletionResponse> { throw new Error('API Error'); }
      async *chatCompletionStream(): AsyncIterable<StreamChunk> { yield { content: '', done: true }; }
      async generateEmbeddings(): Promise<EmbeddingResponse> { throw new Error('fail'); }
    })({ type: ProviderType.LOCAL });
    const badModerator = new ContentModerator(failingProvider, promptManager);
    const result = await badModerator.moderate({
      content: 'Safe content', contentType: ModerationContentType.TEXT, language: Language.ENGLISH,
    });
    expect(result).toBeDefined();
  });
});
