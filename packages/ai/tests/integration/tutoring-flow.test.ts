import { CasuyaAI } from '../../src/casuya-ai';
import { TutoringMode, TutoringSubject, Language, Difficulty, QuestionType, QuestionCategory } from '../../src/types';
import { PromptManager } from '../../src/prompts/prompt-manager';
import { DEFAULT_TEMPLATES } from '../../src/prompts/template-library';
import { BaseProvider } from '../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../src/types/providers';
import { TutoringEngine } from '../../src/tutoring/tutoring-engine';
import { QuestionGenerator } from '../../src/question-generation/question-generator';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../src/types/providers';

class MockProvider extends BaseProvider {
  get type(): string { return 'mock'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
  async chatCompletion(_request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return {
      id: 'mock-id', model: 'mock-model', content: 'Mock tutoring response for testing.',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, finishReason: 'stop', latency: 100,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: 'mock', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return { model: 'mock', embeddings: [[0.1]], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, latency: 0 };
  }
}

describe('Tutoring Flow Integration', () => {
  let casuya: CasuyaAI;
  let mockProvider: MockProvider;
  let promptManager: PromptManager;

  beforeAll(() => {
    mockProvider = new MockProvider({ type: ProviderType.LOCAL });
    promptManager = new PromptManager();
    promptManager.registerTemplates(DEFAULT_TEMPLATES);

    casuya = new CasuyaAI();
    casuya.tutoring = new TutoringEngine(mockProvider, promptManager);
    casuya.questionGenerator = new QuestionGenerator(mockProvider, promptManager);
  });

  afterAll(async () => {
    await casuya.shutdown();
  });

  it('should create tutoring session', async () => {
    const response = await casuya.tutor({
      studentId: 'student-1',
      subject: TutoringSubject.MATHEMATICS,
      topic: 'Algebra Basics',
      mode: TutoringMode.EXPLAIN,
      message: 'What is a variable?',
      preferences: {
        language: Language.ENGLISH,
        difficulty: Difficulty.BEGINNER,
        explanationDepth: 'moderate',
        pace: 'normal',
        includeExamples: true,
        includeVisualizations: false,
        socraticMethod: false,
      },
    });

    expect(response).toBeDefined();
    expect(response.message).toBeTruthy();
    expect(response.mode).toBe(TutoringMode.EXPLAIN);
    expect(response.usage.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('should generate questions', async () => {
    const questions = await casuya.generateQuestions({
      subject: 'science',
      topic: 'Photosynthesis',
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.INTERMEDIATE,
      category: QuestionCategory.COMPREHENSION,
      count: 3,
      language: Language.ENGLISH,
    });

    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
  });

  it('should provide health check', async () => {
    const health = await casuya.healthCheck();
    expect(health).toBeDefined();
    expect(typeof health.healthy).toBe('boolean');
    expect(Array.isArray(health.providers)).toBe(true);
  });
});
