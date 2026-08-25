import { Translator } from '../../../src/translation/translator';
import { PromptManager } from '../../../src/prompts/prompt-manager';
import { getTemplateById } from '../../../src/prompts/template-library';
import { BaseProvider } from '../../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../../src/types/providers';
import { Language } from '../../../src/types/common';
import { TranslationDomain } from '../../../src/types/translation';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../../src/types/providers';

class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT, ModelCapability.TRANSLATION]; }
  async chatCompletion(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      id: 'mock-id', model: 'mock-model', content: 'Bonjour le monde',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, finishReason: 'stop', latency: 100,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: 'mock', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return { model: 'mock', embeddings: [[0.1]], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency: 0 };
  }
}

describe('Translator', () => {
  let translator: Translator;
  let provider: MockProvider;
  let promptManager: PromptManager;

  beforeEach(() => {
    provider = new MockProvider({ type: ProviderType.LOCAL });
    promptManager = new PromptManager();
    const template = getTemplateById('translation-educational');
    if (template) promptManager.registerTemplate(template);
    translator = new Translator(provider, promptManager);
  });

  it('should translate text between languages', async () => {
    const result = await translator.translate({
      text: 'Hello world', sourceLanguage: Language.ENGLISH, targetLanguage: Language.FRENCH,
    });
    expect(result.translatedText).toBe('Bonjour le monde');
    expect(result.sourceLanguage).toBe(Language.ENGLISH);
    expect(result.targetLanguage).toBe(Language.FRENCH);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should support domain-specific translation', async () => {
    const result = await translator.translate({
      text: 'E=mc^2', sourceLanguage: Language.ENGLISH, targetLanguage: Language.SPANISH, domain: TranslationDomain.SCIENCE,
    });
    expect(result.translatedText).toBeDefined();
  });

  it('should detect language from text', async () => {
    const detection = await translator.detectLanguage('Hello world');
    expect(detection.detectedLanguage).toBeDefined();
    expect(detection.confidence).toBeGreaterThan(0);
  });

  it('should translate multiple texts in batch', async () => {
    const results = await translator.batchTranslate(['Hello', 'Goodbye'], Language.ENGLISH, Language.FRENCH);
    expect(results).toHaveLength(2);
    results.forEach(r => { expect(r.translatedText).toBeDefined(); });
  });

  it('should throw on provider failure', async () => {
    const failingProvider = new (class extends BaseProvider {
      get type(): string { return 'failing'; }
      get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
      async chatCompletion(): Promise<ChatCompletionResponse> { throw new Error('API Error'); }
      async *chatCompletionStream(): AsyncIterable<StreamChunk> { yield { content: '', done: true }; }
      async generateEmbeddings(): Promise<EmbeddingResponse> { throw new Error('fail'); }
    })({ type: ProviderType.LOCAL });
    const badTranslator = new Translator(failingProvider, promptManager);
    await expect(badTranslator.translate({
      text: 'Hello', sourceLanguage: Language.ENGLISH, targetLanguage: Language.FRENCH,
    })).rejects.toThrow();
  });
});
