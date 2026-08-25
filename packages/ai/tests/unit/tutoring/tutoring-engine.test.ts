import { TutoringEngine } from '../../../src/tutoring/tutoring-engine';
import { PromptManager } from '../../../src/prompts/prompt-manager';
import { getTemplateById } from '../../../src/prompts/template-library';
import { BaseProvider } from '../../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../../src/types/providers';
import { TutoringMode, TutoringSubject } from '../../../src/types/tutoring';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../../src/types/providers';

class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
  async chatCompletion(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      id: 'mock-id', model: 'mock-model', content: 'Here is an explanation of the topic.',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, finishReason: 'stop', latency: 100,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: 'mock', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return { model: 'mock', embeddings: [[0.1]], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency: 0 };
  }
}

describe('TutoringEngine', () => {
  let engine: TutoringEngine;
  let promptManager: PromptManager;
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider({ type: ProviderType.LOCAL, endpoint: 'http://localhost' });
    promptManager = new PromptManager();
    const explainTemplate = getTemplateById('tutoring-explain');
    if (explainTemplate) promptManager.registerTemplate(explainTemplate);
    engine = new TutoringEngine(provider, promptManager);
  });

  it('should return a tutoring response', async () => {
    const result = await engine.tutor({
      studentId: 'student-1', subject: TutoringSubject.MATHEMATICS,
      topic: 'Algebra', mode: TutoringMode.EXPLAIN, message: 'Explain quadratic equations',
    });
    expect(result.message).toBeDefined();
    expect(result.mode).toBe(TutoringMode.EXPLAIN);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should support all tutoring modes', async () => {
    for (const mode of Object.values(TutoringMode)) {
      const result = await engine.tutor({
        studentId: 'student-1', subject: TutoringSubject.GENERAL,
        topic: 'Test', mode, message: `Test ${mode} mode`,
      });
      expect(result.message).toBeDefined();
    }
  });

  it('should return null for unknown student knowledge state', async () => {
    const state = await engine.getKnowledgeState('unknown-student');
    expect(state).toBeNull();
  });

  it('should handle provider failure', async () => {
    const failingProvider = new (class extends BaseProvider {
      get type(): string { return 'failing'; }
      get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
      async chatCompletion(): Promise<ChatCompletionResponse> { throw new Error('API Error'); }
      async *chatCompletionStream(): AsyncIterable<StreamChunk> { yield { content: '', done: true }; }
      async generateEmbeddings(): Promise<EmbeddingResponse> { throw new Error('fail'); }
    })({ type: ProviderType.LOCAL });
    const badEngine = new TutoringEngine(failingProvider, promptManager);
    await expect(badEngine.tutor({
      studentId: 's1', subject: TutoringSubject.GENERAL,
      topic: 'Test', mode: TutoringMode.EXPLAIN, message: 'Hello',
    })).rejects.toThrow();
  });
});
