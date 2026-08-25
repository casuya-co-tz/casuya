import { QuestionGenerator } from '../../../src/question-generation/question-generator';
import { PromptManager } from '../../../src/prompts/prompt-manager';
import { getTemplateById } from '../../../src/prompts/template-library';
import { BaseProvider } from '../../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../../src/types/providers';
import { Difficulty, Language } from '../../../src/types/common';
import { QuestionType, QuestionCategory } from '../../../src/types/question-generation';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../../src/types/providers';

class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
  async chatCompletion(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      id: 'mock-id', model: 'mock-model',
      content: JSON.stringify([
        { id: 'q1', question: 'What is 2+2?', options: ['3', '4', '5', '6'], correctAnswer: '4', explanation: 'Simple addition' },
      ]),
      usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 }, finishReason: 'stop', latency: 100,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: 'mock', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return { model: 'mock', embeddings: [[0.1]], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency: 0 };
  }
}

describe('QuestionGenerator', () => {
  let generator: QuestionGenerator;
  let provider: MockProvider;
  let promptManager: PromptManager;

  beforeEach(() => {
    provider = new MockProvider({ type: ProviderType.LOCAL });
    promptManager = new PromptManager();
    const mcqTemplate = getTemplateById('question-generation-mcq');
    if (mcqTemplate) promptManager.registerTemplate(mcqTemplate);
    generator = new QuestionGenerator(provider, promptManager);
  });

  it('should generate questions from request', async () => {
    const questions = await generator.generateQuestions({
      subject: 'Mathematics', topic: 'Basic Math', count: 1,
      questionType: QuestionType.MULTIPLE_CHOICE,
      category: QuestionCategory.RECALL,
      difficulty: Difficulty.BEGINNER,
      language: Language.ENGLISH,
    });
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBeDefined();
  });

  it('should retrieve questions from bank', () => {
    const bank = generator.getFromBank('Mathematics', 'Algebra', Difficulty.INTERMEDIATE);
    expect(Array.isArray(bank)).toBe(true);
  });

  it('should throw on provider failure', async () => {
    const failingProvider = new (class extends BaseProvider {
      get type(): string { return 'failing'; }
      get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
      async chatCompletion(): Promise<ChatCompletionResponse> { throw new Error('API Error'); }
      async *chatCompletionStream(): AsyncIterable<StreamChunk> { yield { content: '', done: true }; }
      async generateEmbeddings(): Promise<EmbeddingResponse> { throw new Error('fail'); }
    })({ type: ProviderType.LOCAL });
    const badGenerator = new QuestionGenerator(failingProvider, promptManager);
    await expect(badGenerator.generateQuestions({
      subject: 'Test', topic: 'Test Topic', count: 1,
      questionType: QuestionType.MULTIPLE_CHOICE,
      category: QuestionCategory.RECALL,
      difficulty: Difficulty.BEGINNER,
    })).rejects.toThrow();
  });
});
