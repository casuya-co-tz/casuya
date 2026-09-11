import { QuestionGenerator } from '../../../src/question-generation/question-generator';
import { PromptManager } from '../../../src/prompts/prompt-manager';
import { TEST_GENERATION_TEMPLATE } from '../../../src/prompts/necta/test-generation';
import { BaseProvider } from '../../../src/providers/base-provider';
import { ProviderType, ModelCapability } from '../../../src/types/providers';
import { Difficulty } from '../../../src/types/common';
import { QuestionType, QuestionCategory } from '../../../src/types/question-generation';
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk, EmbeddingRequest, EmbeddingResponse } from '../../../src/types/providers';

class RecordingProvider extends BaseProvider {
  public lastRequest: ChatCompletionRequest | null = null;
  get type(): string { return 'recording'; }
  get supportedCapabilities(): ModelCapability[] { return [ModelCapability.CHAT]; }
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.lastRequest = request;
    return {
      id: 'm', model: 'm',
      content: JSON.stringify([
        { text: 'Which salt is formed when an acid reacts with a base?', options: ['A normal salt', 'B', 'C', 'D'], correctAnswer: 'B', explanation: 'Neutralisation forms a salt and water.' },
      ]),
      usage: { promptTokens: 10, completionTokens: 30, totalTokens: 40 }, finishReason: 'stop', latency: 0,
    };
  }
  async *chatCompletionStream(_request: ChatCompletionRequest): AsyncIterable<StreamChunk> { yield { content: '', done: true }; }
  async generateEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> { throw new Error('fail'); }
}

describe('QuestionGenerator grounded test generation', () => {
  let provider: RecordingProvider;
  let promptManager: PromptManager;
  let generator: QuestionGenerator;

  beforeEach(() => {
    provider = new RecordingProvider({ type: ProviderType.LOCAL });
    promptManager = new PromptManager();
    promptManager.registerTemplate(TEST_GENERATION_TEMPLATE);
    generator = new QuestionGenerator(provider, promptManager);
  });

  it('uses the grounded template and low temperature when referenceContext is provided', async () => {
    const questions = await generator.generateQuestions({
      subject: 'Chemistry',
      topic: 'Acids, Bases and Salts',
      subtopic: 'Preparation of Salts',
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.INTERMEDIATE,
      category: QuestionCategory.COMPREHENSION,
      count: 3,
      formLevel: 4,
      testTypeLabel: 'NECTA Form IV',
      referenceContext: '[[KB:exam|Chemistry 2023]]\nSalt preparation...',
      temperature: 0.15,
    });

    expect(questions).toHaveLength(1);
    expect(provider.lastRequest).not.toBeNull();
    expect(provider.lastRequest!.temperature).toBe(0.15);
    const prompt = provider.lastRequest!.messages![1].content;
    expect(prompt).toContain('NECTA Form IV');
    expect(prompt).toContain('Preparation of Salts');
    expect(prompt).toContain('DO NOT copy any question from the reference material verbatim');
    expect(prompt).toContain('Chemistry 2023');
    expect(prompt).not.toMatch(/\{\{\w+\}\}/);
  });

  it('honours a custom temperature within the 0.1-0.2 band', async () => {
    await generator.generateQuestions({
      subject: 'Physics',
      topic: 'Forces',
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.INTERMEDIATE,
      category: QuestionCategory.COMPREHENSION,
      count: 2,
      formLevel: 2,
      testTypeLabel: 'Topical Test',
      referenceContext: '[[KB:exam|Topical Forces]]\nNewton\'s laws.',
      temperature: 0.1,
    });
    expect(provider.lastRequest!.temperature).toBe(0.1);
  });

  it('lists every checked topic/subtopic in the grounded prompt', async () => {
    await generator.generateQuestions({
      subject: 'Chemistry',
      topic: 'Acids, Bases and Salts',
      subtopic: '',
      topicsCovered: ['Acids, Bases and Salts', 'Salts and Solutions'],
      subtopicsCovered: ['Preparation of Salts', 'Uses of Salts'],
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.INTERMEDIATE,
      category: QuestionCategory.COMPREHENSION,
      count: 4,
      formLevel: 4,
      testTypeLabel: 'Terminal Test',
      referenceContext: '[[KB:exam|Chemistry Terminal 2023]]\nSalt concepts.',
      temperature: 0.15,
    });

    const prompt = provider.lastRequest!.messages![1].content;
    expect(prompt).toContain('TOPICS IN THIS TEST:\n- Acids, Bases and Salts\n- Salts and Solutions');
    expect(prompt).toContain('SUBTTOPICS IN THIS TEST:\n- Preparation of Salts\n- Uses of Salts');
    expect(prompt).toContain('Topics (2): Acids, Bases and Salts; Salts and Solutions');
    expect(prompt).toContain('Subtopics (2): Preparation of Salts; Uses of Salts');
    expect(prompt).not.toMatch(/\{\{\w+\}\}/);
  });
});