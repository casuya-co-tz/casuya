import {
  TutoringRequest,
  TutoringResponse,
  TutoringSession,
  KnowledgeState,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { PromptManager } from '../prompts/prompt-manager';
import { CacheManager } from '../caching/cache-manager';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';
import { SyllabusAdapter } from '../adapters/syllabus-adapter';
import { buildTutoringSystemPrompt, buildTutoringUserPrompt, getTemperature, getMaxTokens } from './prompts';
import { postProcessTutoringResponse } from './post-process';

export class TutoringEngine {
  private sessions: Map<string, TutoringSession>;
  private logger: Logger;
  private cache: CacheManager;
  private syllabusAdapter: SyllabusAdapter | null;

  constructor(
    private provider: BaseProvider,
    private promptManager: PromptManager,
    logger?: Logger,
    syllabusAdapter?: SyllabusAdapter,
  ) {
    this.sessions = new Map();
    this.logger = logger ?? new Logger({ prefix: '[TutoringEngine]' });
    this.cache = new CacheManager({ defaultTTL: 30 * 60 * 1000 });
    this.syllabusAdapter = syllabusAdapter ?? null;
  }

  async tutor(request: TutoringRequest): Promise<TutoringResponse> {
    this.validateRequest(request);

    const cacheKey = `tutoring:${request.studentId}:${request.topic}:${request.mode}:${request.message.slice(0, 120)}`;
    const cached = this.cache.get<TutoringResponse>(cacheKey);
    if (cached?.message?.trim()) return cached;

    const systemPrompt = await buildTutoringSystemPrompt(request, this.promptManager, this.syllabusAdapter, this.logger);
    const userPrompt = buildTutoringUserPrompt(request);

    const response = await this.provider.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        ...(request.context?.previousMessages ?? []).map((m) => ({
          role: m.role === 'tutor' ? 'assistant' as const : 'user' as const,
          content: m.message,
        })),
        { role: 'user', content: userPrompt },
      ],
      temperature: getTemperature(request.mode),
      maxTokens: getMaxTokens(request.mode),
    });

    const rawMessage = response.content;
    const message = postProcessTutoringResponse(rawMessage);

    const tutoringResponse: TutoringResponse = {
      message,
      mode: request.mode,
      suggestions: this.extractSuggestions(message),
      concepts: [],
      confidence: this.calculateConfidence(response),
      usage: {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalCost: this.calculateCost(response.usage.totalTokens),
      },
    };

    this.updateSession(request);
    if (message.trim()) {
      this.cache.set(cacheKey, tutoringResponse, 60 * 1000);
    }

    return tutoringResponse;
  }

  async getKnowledgeState(studentId: string): Promise<KnowledgeState | null> {
    const cacheKey = `knowledge:${studentId}`;
    return this.cache.get<KnowledgeState>(cacheKey) ?? null;
  }

  async updateKnowledgeState(state: KnowledgeState): Promise<void> {
    const cacheKey = `knowledge:${state.studentId}`;
    this.cache.set(cacheKey, state, 24 * 60 * 60 * 1000);
  }

  getSession(sessionId: string): TutoringSession | undefined {
    return this.sessions.get(sessionId);
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endedAt = new Date();
      this.logger.info(`Session ended: ${sessionId}`);
    }
  }

  private validateRequest(request: TutoringRequest): void {
    if (!request.studentId) {
      throw new CasuyaAIError('Student ID is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!request.topic) {
      throw new CasuyaAIError('Topic is required', ErrorCode.VALIDATION_ERROR);
    }
    if (!request.message) {
      throw new CasuyaAIError('Message is required', ErrorCode.VALIDATION_ERROR);
    }
  }

  private extractSuggestions(response: string): string[] {
    const suggestions: string[] = [];
    const lines = response.split('\n');
    let inSuggestions = false;

    for (const line of lines) {
      if (/suggestions|you could|try|practice|next/i.test(line) && line.includes(':')) {
        inSuggestions = true;
      }
      if (inSuggestions && (line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim()))) {
        suggestions.push(line.trim().replace(/^[-*\d.]+/, '').trim());
      }
    }

    return suggestions.slice(0, 5);
  }

  private calculateConfidence(response: { finishReason: string }): number {
    if (response.finishReason === 'stop') return 0.95;
    if (response.finishReason === 'length') return 0.7;
    return 0.5;
  }

  private calculateCost(totalTokens: number): number {
    return (totalTokens / 1000) * 0.01;
  }

  private updateSession(request: TutoringRequest): void {
    const sessionId = `${request.studentId}:${request.subject}`;
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        studentId: request.studentId,
        subject: request.subject,
        startedAt: new Date(),
        mode: request.mode,
        messages: 0,
        conceptsCovered: [],
        averageConfidence: 0,
      };
    }

    session.messages++;
    if (!session.conceptsCovered.includes(request.topic)) {
      session.conceptsCovered.push(request.topic);
    }
    session.mode = request.mode;

    this.sessions.set(sessionId, session);
  }
}