import {
  ProviderConfig,
  ProviderType,
  TutoringRequest,
  TutoringResponse,
  RecommendationRequest,
  RecommendationResult,
  SummarizationRequest,
  SummarizationResult,
  TranslationRequest,
  TranslationResult,
  ModerationRequest,
  ModerationResult,
  GeneratedQuestion,
  QuestionGenerationRequest,
  StudentProfile,
  LearningPathRequest,
  LearningPath,
  AdaptiveParameters,
  PersonalizationEvent,
} from './types';
import { Logger } from './utilities/logger';
import { ProviderFactory } from './providers/provider-factory';
import { PromptManager } from './prompts/prompt-manager';
import { DEFAULT_TEMPLATES } from './prompts/template-library';
import { TutoringEngine } from './tutoring/tutoring-engine';
import { RecommendationEngine } from './recommendations/recommendation-engine';
import { PersonalizationEngine } from './personalization/personalization-engine';
import { LearningPathGenerator } from './learning-paths/path-generator';
import { QuestionGenerator } from './question-generation/question-generator';
import { Summarizer } from './summarization/summarizer';
import { Translator } from './translation/translator';
import { ContentModerator } from './moderation/content-moderation';
import { ProviderAdapter } from './adapters/provider-adapter';
import { RuntimeAdapter } from './adapters/runtime-adapter';
import { SyllabusAdapter, SyllabusAdapterConfig } from './adapters/syllabus-adapter';
import { AnalyticsCollector } from './analytics/analytics-collector';
import { CacheManager } from './caching/cache-manager';
import { NECTA_TEMPLATES } from './prompts/necta-templates';

export interface CasuyaAIConfig {
  providers: Map<string, ProviderConfig>;
  defaultProvider: string;
  syllabus?: SyllabusAdapterConfig;
  logging?: {
    level?: string;
    prefix?: string;
  };
  cache?: {
    defaultTTL?: number;
    maxEntries?: number;
  };
}

export class CasuyaAI {
  public tutoring: TutoringEngine;
  public recommendations: RecommendationEngine;
  public personalization: PersonalizationEngine;
  public learningPaths: LearningPathGenerator;
  public questionGenerator: QuestionGenerator;
  public summarizer: Summarizer;
  public translator: Translator;
  public moderation: ContentModerator;
  public providerAdapter: ProviderAdapter;
  public runtimeAdapter: RuntimeAdapter;
  public analytics: AnalyticsCollector;
  public cache: CacheManager;
  public prompts: PromptManager;
  public syllabus: SyllabusAdapter | null;

  private logger: Logger;
  private initialized: boolean = false;

  constructor(config?: Partial<CasuyaAIConfig>) {
    this.logger = new Logger({
      prefix: '[CasuyaAI]',
      level: (config?.logging?.level as never) ?? 'info',
    });

    this.cache = new CacheManager(config?.cache);
    this.prompts = new PromptManager();
    this.providerAdapter = new ProviderAdapter();
    this.runtimeAdapter = new RuntimeAdapter();
    this.analytics = new AnalyticsCollector();

    // Initialize syllabus adapter if config provided
    this.syllabus = config?.syllabus ? new SyllabusAdapter(config.syllabus, this.logger) : null;

    this.prompts.registerTemplates(DEFAULT_TEMPLATES);
    this.prompts.registerTemplates(NECTA_TEMPLATES);

    const defaultProvider = ProviderFactory.createProvider(
      config?.providers?.get(config?.defaultProvider ?? '') ?? {
        type: ProviderType.LOCAL,
        model: 'llama3.2',
      },
    );

    this.tutoring = new TutoringEngine(defaultProvider, this.prompts, undefined, this.syllabus ?? undefined);
    this.recommendations = new RecommendationEngine();
    this.personalization = new PersonalizationEngine();
    this.learningPaths = new LearningPathGenerator();
    this.questionGenerator = new QuestionGenerator(defaultProvider, this.prompts, undefined, this.syllabus ?? undefined);
    this.summarizer = new Summarizer(defaultProvider, this.prompts);
    this.translator = new Translator(defaultProvider, this.prompts);
    this.moderation = new ContentModerator(defaultProvider, this.prompts);

    if (config?.providers && config.defaultProvider) {
      this.initializeProviders(config.providers, config.defaultProvider);
    }
  }

  async initializeProviders(providerConfigs: Map<string, ProviderConfig>, defaultProvider: string): Promise<void> {
    await ProviderFactory.initializeProviders(providerConfigs);
    this.providerAdapter.setDefaultProvider(defaultProvider);

    const provider = ProviderFactory.getProvider(defaultProvider);
    if (provider) {
      this.tutoring = new TutoringEngine(provider, this.prompts, undefined, this.syllabus ?? undefined);
      this.questionGenerator = new QuestionGenerator(provider, this.prompts, undefined, this.syllabus ?? undefined);
      this.summarizer = new Summarizer(provider, this.prompts);
      this.translator = new Translator(provider, this.prompts);
      this.moderation = new ContentModerator(provider, this.prompts);
    }

    this.initialized = true;
    this.logger.info('CasuyaAI fully initialized');
  }

  async tutor(request: TutoringRequest): Promise<TutoringResponse> {
    this.ensureInitialized();
    this.analytics.track({ type: 'tutoring:request', properties: { subject: request.subject, topic: request.topic, mode: request.mode }, studentId: request.studentId });
    return this.tutoring.tutor(request);
  }

  async recommend(request: RecommendationRequest): Promise<RecommendationResult> {
    this.ensureInitialized();
    this.analytics.track({ type: 'recommendation:request', properties: { context: request.context }, studentId: request.studentId });
    return this.recommendations.getRecommendations(request);
  }

  async generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]> {
    this.ensureInitialized();
    this.analytics.track({ type: 'question:generate', properties: { subject: request.subject, topic: request.topic, count: request.count } });
    return this.questionGenerator.generateQuestions(request);
  }

  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    this.ensureInitialized();
    this.analytics.track({ type: 'summarization:request', properties: { strategy: request.strategy, length: request.length } });
    return this.summarizer.summarize(request);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.ensureInitialized();
    this.analytics.track({ type: 'translation:request', properties: { sourceLanguage: request.sourceLanguage, targetLanguage: request.targetLanguage } });
    return this.translator.translate(request);
  }

  async moderate(request: ModerationRequest): Promise<ModerationResult> {
    this.ensureInitialized();
    return this.moderation.moderate(request);
  }

  async generateLearningPath(request: LearningPathRequest): Promise<LearningPath> {
    this.ensureInitialized();
    return this.learningPaths.generatePath(request);
  }

  async getStudentProfile(studentId: string): Promise<StudentProfile | null> {
    this.ensureInitialized();
    return this.personalization.getStudentProfile(studentId);
  }

  async getAdaptiveParameters(studentId: string): Promise<AdaptiveParameters> {
    this.ensureInitialized();
    return this.personalization.getAdaptiveParameters(studentId);
  }

  async recordPersonalizationEvent(event: PersonalizationEvent): Promise<void> {
    this.ensureInitialized();
    return this.personalization.recordEvent(event);
  }

  async healthCheck(): Promise<{ healthy: boolean; providers: string[] }> {
    return {
      healthy: this.initialized,
      providers: ProviderFactory.listProviders(),
    };
  }

  async shutdown(): Promise<void> {
    await ProviderFactory.shutdownAll();
    this.analytics.destroy();
    this.cache.destroy();
    this.initialized = false;
    this.logger.info('CasuyaAI shutdown complete');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.logger.warn('CasuyaAI not fully initialized, using defaults');
    }
  }
}
