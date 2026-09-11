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
import { Logger } from '../utilities';
import { SyllabusAdapter } from '../adapters/syllabus-adapter';
import { validateRequest } from './request-validation';
import { parseQuestionResponse } from './question-parser';
import { buildCurriculumContext } from './curriculum-context';

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
    validateRequest(request);

    const topicsSig = (request.topicsCovered ?? []).slice(0, 8).join('|');
    const subTopicsSig = (request.subtopicsCovered ?? []).slice(0, 8).join('|');
    const cacheKey = `qgen:${request.subject}:${request.topic}:${topicsSig}:${subTopicsSig}:${(request.subtopic ?? '')}:${request.difficulty}:${request.count}:${(request.context ?? '').slice(0, 120)}:${(request.referenceContext ?? '').slice(0, 120)}`;
    const cached = this.cache.get<GeneratedQuestion[]>(cacheKey);
    if (cached) return cached;

    // Fetch TIE curriculum context for NECTA-aligned questions
    const { curriculumContext, subjectSlug, formLevel } = await buildCurriculumContext(
      request,
      this.syllabusAdapter,
      this.logger,
    );

    const grounded = (request.referenceContext ?? '').trim();
    const templateId = grounded
      ? 'test-generation-grounded'
      : curriculumContext
        ? 'necta-question-generation'
        : 'question-generation-mcq';
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

    if (grounded) {
      variables.reference_context = grounded;
      variables.test_type_label = request.testTypeLabel ?? 'Practice Test';
      const topicsCovered = request.topicsCovered?.length ? request.topicsCovered : [request.topic];
      const subtopicsCovered = request.subtopicsCovered?.length
        ? request.subtopicsCovered
        : request.subtopic
          ? [request.subtopic]
          : ['All sub-topics'];
      variables.topics_covered = topicsCovered.map((t) => `- ${t}`).join('\n');
      variables.subtopics_covered = subtopicsCovered.map((t) => `- ${t}`).join('\n');
      variables.scope = [
        `Subject: ${request.subject}`,
        `Form: ${formLevel ?? 1}`,
        `Topics (${topicsCovered.length}): ${topicsCovered.join('; ')}`,
        `Subtopics (${subtopicsCovered.length}): ${subtopicsCovered.join('; ')}`,
      ]
        .filter(Boolean)
        .join(' | ');
      variables.form_level = formLevel ?? 1;
    }

    const promptResult = this.promptManager.execute({ templateId, variables });

    const response = await this.provider.chatCompletion({
      messages: [
        { role: 'system', content: 'You are an educational assessment generator. Generate questions and respond with valid JSON.' },
        { role: 'user', content: promptResult.content },
      ],
      temperature: request.temperature ?? 0.7,
      maxTokens: Math.min(4096, Math.max(1024, request.count * 280)),
    });

    const questions = parseQuestionResponse(response.content, request, this.logger);
    if (!questions.length) {
      return [];
    }

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
}