import {
  QuestionGenerationRequest,
  GeneratedQuestion,
  QuestionType,
  QuestionCategory,
  Difficulty,
  QuestionBankEntry,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { PromptManager } from '../prompts/prompt-manager';
import { CacheManager } from '../caching/cache-manager';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';
import { SyllabusAdapter } from '../adapters/syllabus-adapter';

/** Maps subject names/slugs to TIE syllabus slugs */
const SUBJECT_SLUG_MAP: Record<string, string> = {
  mathematics: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  english: 'english',
  kiswahili: 'kiswahili',
};

export class QuestionGenerator {
  private cache: CacheManager;
  private questionBank: Map<string, QuestionBankEntry[]>;
  private syllabusAdapter: SyllabusAdapter | null;
  private logger?: Logger;

  constructor(
    private provider: BaseProvider,
    private promptManager: PromptManager,
    _logger?: Logger,
    syllabusAdapter?: SyllabusAdapter,
  ) {
    this.cache = new CacheManager({ defaultTTL: 60 * 60 * 1000 });
    this.questionBank = new Map();
    this.syllabusAdapter = syllabusAdapter ?? null;
    this.logger = _logger;
  }

  async generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]> {
    this.validateRequest(request);

    const cacheKey = `qgen:${request.subject}:${request.topic}:${request.difficulty}:${request.count}`;
    const cached = this.cache.get<GeneratedQuestion[]>(cacheKey);
    if (cached) return cached;

    // Fetch TIE curriculum context for NECTA-aligned questions
    let curriculumContext = '';
    const subjectSlug = SUBJECT_SLUG_MAP[request.subject?.toLowerCase?.() ?? ''] ?? '';
    const formLevel = (request as unknown as Record<string, unknown>).formLevel as number | undefined;

    if (this.syllabusAdapter && subjectSlug && formLevel) {
      try {
        curriculumContext = await this.syllabusAdapter.getCurriculumContext(subjectSlug, formLevel);
      } catch {
        this.logger?.warn(`Failed to fetch curriculum context for question generation`);
      }
    }

    const templateId = curriculumContext ? 'necta-question-generation' : 'question-generation-mcq';
    const variables: Record<string, unknown> = {
      subject: request.subject,
      topic: request.topic,
      difficulty: request.difficulty,
      count: request.count,
      context: request.context ?? '',
    };

    if (curriculumContext) {
      variables.curriculum_context = curriculumContext;
      variables.form_level = formLevel ?? 1;
      variables.necta_code = subjectSlug.toUpperCase().slice(0, 4);
      variables.exam_section = 'mixed';
    }

    const promptResult = this.promptManager.execute({ templateId, variables });

    const response = await this.provider.chatCompletion({
      messages: [
        { role: 'system', content: 'You are an educational assessment generator. Generate questions and respond with valid JSON.' },
        { role: 'user', content: promptResult.content },
      ],
      temperature: 0.7,
      maxTokens: 2048,
    });

    const questions = this.parseQuestions(response.content, request);

    for (const q of questions) {
      this.addToBank(q);
    }

    this.cache.set(cacheKey, questions, 30 * 60 * 1000);
    return questions;
  }

  async generateFromTemplate(
    _templateId: string,
    variables: Record<string, unknown>,
    count: number,
  ): Promise<GeneratedQuestion[]> {
    const request: QuestionGenerationRequest = {
      subject: String(variables.subject ?? 'general'),
      topic: String(variables.topic ?? 'general'),
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: String(variables.difficulty ?? 'intermediate') as Difficulty,
      category: QuestionCategory.COMPREHENSION,
      count,
    };

    return this.generateQuestions(request);
  }

  getFromBank(subject: string, topic: string, difficulty: Difficulty): QuestionBankEntry[] {
    const key = `${subject}:${topic}:${difficulty}`;
    return this.questionBank.get(key) ?? [];
  }

  private validateRequest(request: QuestionGenerationRequest): void {
    if (!request.subject) {
      throw new CasuyaAIError('Subject is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!request.topic) {
      throw new CasuyaAIError('Topic is required', ErrorCode.VALIDATION_ERROR);
    }
    if (request.count < 1 || request.count > 50) {
      throw new CasuyaAIError('Count must be between 1 and 50', ErrorCode.VALIDATION_ERROR);
    }
  }

  private parseQuestions(response: string, request: QuestionGenerationRequest): GeneratedQuestion[] {
    // Strip markdown code fences (```json ... ```) that models wrap around JSON
    let cleaned = response.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, request.count).map((q, i) => this.normalizeQuestion(q, i, request));
      }
    } catch {
      // Not JSON, fall through
    }

    return this.extractQuestionsFromText(response, request);
  }

  private normalizeQuestion(raw: Record<string, unknown>, index: number, request: QuestionGenerationRequest): GeneratedQuestion {
    // Handle options as either array of strings or {A: ..., B: ...} object
    let options: string[] | undefined;
    const rawOptions = raw.options as Record<string, string> | string[] | undefined;
    if (rawOptions) {
      if (Array.isArray(rawOptions)) {
        options = rawOptions;
      } else if (typeof rawOptions === 'object') {
        options = Object.values(rawOptions).map(String);
      }
    }

    return {
      id: `q-${Date.now()}-${index}`,
      type: request.questionType,
      category: (raw.category as QuestionCategory) ?? request.category,
      difficulty: request.difficulty,
      subject: request.subject,
      topic: request.topic,
      text: String(raw.text ?? raw.question ?? ''),
      options,
      correctAnswer: String(raw.correctAnswer ?? raw.correct_answer ?? raw.answer ?? ''),
      explanation: String(raw.explanation ?? ''),
      hints: raw.hints as string[] | undefined,
      metadata: {
        estimatedTime: this.estimateTime(request.questionType),
        bloomLevel: request.category,
        concepts: [request.topic],
        tags: [request.subject, request.topic],
        reviewed: false,
        version: '1.0.0',
      },
    };
  }

  private extractQuestionsFromText(text: string, request: QuestionGenerationRequest): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    const blocks = text.split(/\n\s*(?=\d+[.)]|Q[.)])/);
    let index = 0;

    for (const block of blocks) {
      if (!block.trim()) continue;
      questions.push({
        id: `q-${Date.now()}-${index}`,
        type: request.questionType,
        category: request.category,
        difficulty: request.difficulty,
        subject: request.subject,
        topic: request.topic,
        text: block.trim(),
        correctAnswer: '',
        explanation: '',
        metadata: {
          estimatedTime: this.estimateTime(request.questionType),
          bloomLevel: request.category,
          concepts: [request.topic],
          tags: [request.subject, request.topic],
          reviewed: false,
          version: '1.0.0',
        },
      });
      index++;
    }

    return questions;
  }

  private addToBank(question: GeneratedQuestion): void {
    const key = `${question.subject}:${question.topic}:${question.difficulty}`;
    if (!this.questionBank.has(key)) {
      this.questionBank.set(key, []);
    }

    const bank = this.questionBank.get(key)!;
    const existing = bank.findIndex((e) => e.question.text === question.text);
    if (existing >= 0) {
      bank[existing].usageCount++;
    } else {
      bank.push({
        question,
        usageCount: 0,
        successRate: 0,
        averageTime: 0,
        lastUsed: new Date(),
      });
    }
  }

  private estimateTime(type: QuestionType): number {
    switch (type) {
      case QuestionType.MULTIPLE_CHOICE: return 60;
      case QuestionType.TRUE_FALSE: return 30;
      case QuestionType.SHORT_ANSWER: return 90;
      case QuestionType.ESSAY: return 300;
      case QuestionType.FILL_IN_BLANK: return 45;
      case QuestionType.MATCHING: return 120;
      case QuestionType.ORDERING: return 60;
      default: return 60;
    }
  }
}
