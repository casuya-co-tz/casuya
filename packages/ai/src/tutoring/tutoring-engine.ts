import {
  TutoringRequest,
  TutoringResponse,
  TutoringSession,
  TutoringMode,
  KnowledgeState,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { PromptManager } from '../prompts/prompt-manager';
import { CacheManager } from '../caching/cache-manager';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';
import { SyllabusAdapter } from '../adapters/syllabus-adapter';
import { buildSubjectFrameworkBlock } from '../prompts/subject-frameworks';

/** Maps subject names/slugs to TIE syllabus slugs */
const SUBJECT_SLUG_MAP: Record<string, string> = {
  mathematics: 'mathematics',
  'basic mathematics': 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  english: 'english',
  'english language': 'english',
  kiswahili: 'kiswahili',
};

/** Forms I-II default to Kiswahili-medium */
function isKiswahiliMedium(formLevel?: number): boolean {
  return formLevel !== undefined && formLevel <= 2;
}

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

    const cacheKey = `tutoring:${request.studentId}:${request.topic}:${request.mode}`;
    const cached = this.cache.get<TutoringResponse>(cacheKey);
    if (cached) return cached;

    const systemPrompt = await this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.provider.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        ...(request.context?.previousMessages ?? []).map((m) => ({
          role: m.role === 'tutor' ? 'assistant' as const : 'user' as const,
          content: m.message,
        })),
        { role: 'user', content: userPrompt },
      ],
      temperature: this.getTemperature(request.mode),
      maxTokens: this.getMaxTokens(request.mode),
    });

    const rawMessage = response.content;
    const message = postProcessTutoringResponse(rawMessage);

    const tutoringResponse: TutoringResponse = {
      message,
      mode: request.mode,
      suggestions: this.extractSuggestions(response.content),
      concepts: [],
      confidence: this.calculateConfidence(response),
      usage: {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalCost: this.calculateCost(response.usage.totalTokens),
      },
    };

    this.updateSession(request);
    this.cache.set(cacheKey, tutoringResponse, 60 * 1000);

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

  private async buildSystemPrompt(request: TutoringRequest): Promise<string> {
    const formLevel = (request.preferences as unknown as Record<string, unknown>)?.formLevel as number | undefined;
    const subjectSlug = SUBJECT_SLUG_MAP[request.subject?.toLowerCase?.() ?? ''] ?? '';
    const useKiswahili = isKiswahiliMedium(formLevel);

    // Fetch TIE curriculum context if adapter is available
    let curriculumContext = '';
    if (this.syllabusAdapter && subjectSlug && formLevel) {
      try {
        curriculumContext = await this.syllabusAdapter.getCurriculumContext(subjectSlug, formLevel);
      } catch {
        this.logger.warn(`Failed to fetch curriculum context for ${subjectSlug} Form ${formLevel}`);
      }
    }

    // Choose NECTA-aligned template or fall back to generic
    const templateId = curriculumContext
      ? (useKiswahili ? 'necta-tutoring-kiswahili' : 'necta-tutoring')
      : 'tutoring-explain';

    const variables: Record<string, unknown> = {
      subject: request.subject,
      topic: request.topic,
      difficulty: request.preferences?.difficulty ?? 'intermediate',
      language: request.preferences?.language ?? 'en',
      question: request.message,
      subject_framework: buildSubjectFrameworkBlock(subjectSlug || 'general'),
    };

    if (curriculumContext) {
      variables.curriculum_context = curriculumContext;
      variables.form_level = formLevel ?? 1;
      variables.necta_code = subjectSlug.toUpperCase().slice(0, 4);
    }

    return this.promptManager.execute({ templateId, variables }).content;
  }

  private buildUserPrompt(request: TutoringRequest): string {
    const modeInstructions: Record<TutoringMode, string> = {
      [TutoringMode.EXPLAIN]: 'Provide a clear, comprehensive explanation.',
      [TutoringMode.SOCRATIC]: 'Guide the student to discover the answer through questions.',
      [TutoringMode.PRACTICE]: 'Provide practice problems and exercises.',
      [TutoringMode.REVIEW]: 'Review previously covered material and identify gaps.',
      [TutoringMode.ASSESS]: 'Assess the student understanding and provide feedback.',
    };

    return `${modeInstructions[request.mode]}\n\nStudent question: ${request.message}`;
  }

  private getTemperature(mode: TutoringMode): number {
    switch (mode) {
      case TutoringMode.EXPLAIN: return 0.3;
      case TutoringMode.SOCRATIC: return 0.7;
      case TutoringMode.PRACTICE: return 0.4;
      case TutoringMode.REVIEW: return 0.3;
      case TutoringMode.ASSESS: return 0.2;
    }
  }

  private getMaxTokens(mode: TutoringMode): number {
    switch (mode) {
      case TutoringMode.EXPLAIN: return 1024;
      case TutoringMode.SOCRATIC: return 512;
      case TutoringMode.PRACTICE: return 1024;
      case TutoringMode.REVIEW: return 768;
      case TutoringMode.ASSESS: return 512;
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
      if (inSuggestions && line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim())) {
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

// ---------------------------------------------------------------------------
// Post-processing: fixes formatting drift from the AI model
// ---------------------------------------------------------------------------

/**
 * Wraps bare "🌍 ... Context" lines in markdown blockquotes (>).
 * The AI model sometimes emits the context line as plain text instead of `>`.
 */
function wrapContextBlockquote(text: string): string {
  return text.replace(
    /^((?:🌍|> ?🌍|\*\*🌍|🌍 )\s*.*?Context.*)$/gm,
    (match) => {
      const cleaned = match.replace(/^>\s*/, '').replace(/^\*\*/, '');
      return `> ${cleaned}`;
    },
  );
}

/**
 * Ensures a `---` or `***` horizontal rule exists before
 * "💡 NECTA Examination Tip" if one is missing.
 */
function ensureNectaTipDivider(text: string): string {
  return text.replace(
    /(?<!^---\s*\n|^>\s*---\s*\n|^>\s*\*\*\*\s*\n|^\*\*\*\s*\n)(^(?:💡|> ?💡|\*\*💡)\s*\*?\*?NECTA Examination Tip)/gm,
    '---\n\n$1',
  );
}

/**
 * Normalizes notation quirks: "(1n)" → "(n)" for gamete chromosome counts.
 */
function cleanNotation(text: string): string {
  return text.replace(/\(1n\)/g, '(n)');
}

/**
 * Removes the literal `[next sub-topic]` placeholder and replaces it
 * with a generic but helpful suggestion.
 */
function cleanPlaceholders(text: string): string {
  return text.replace(
    /\[next sub-topic\]/gi,
    'a related topic',
  );
}

/**
 * Runs all post-processing fixes on the raw AI response.
 */
function postProcessTutoringResponse(text: string): string {
  let result = text;
  result = wrapContextBlockquote(result);
  result = ensureNectaTipDivider(result);
  result = cleanNotation(result);
  result = cleanPlaceholders(result);
  return result;
}
