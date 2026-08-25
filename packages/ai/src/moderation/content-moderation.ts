import {
  ModerationRequest,
  ModerationResult,
  ModerationFlag,
  ModerationScore,
  ModerationAction,
  FlagType,
  FlagSeverity,
  ModerationContentType,
  AgeAppropriatenessResult,
  PolicyRule,
  Language,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { PromptManager } from '../prompts/prompt-manager';
import { CacheManager } from '../caching/cache-manager';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';

const TOXIC_PATTERNS: Array<{ pattern: RegExp; type: FlagType; severity: FlagSeverity }> = [
  { pattern: /\b(fuck|shit|damn|ass|bitch|bastard)\b/i, type: FlagType.TOXICITY, severity: FlagSeverity.MEDIUM },
  { pattern: /\b(kill|murder|death threat|hurt you)\b/i, type: FlagType.VIOLENCE, severity: FlagSeverity.HIGH },
  { pattern: /\b(suicide|kill myself|end my life)\b/i, type: FlagType.SELF_HARM, severity: FlagSeverity.CRITICAL },
  { pattern: /https?:\/\/[^\s]+/g, type: FlagType.SPAM, severity: FlagSeverity.LOW },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: FlagType.PERSONAL_INFO, severity: FlagSeverity.HIGH },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, type: FlagType.PERSONAL_INFO, severity: FlagSeverity.HIGH },
];

export class ContentModerator {
  private logger: Logger;
  private cache: CacheManager;
  private policies: PolicyRule[];

  constructor(
    private provider: BaseProvider,
    private promptManager: PromptManager,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger({ prefix: '[ContentModerator]' });
    this.cache = new CacheManager({ defaultTTL: 30 * 60 * 1000 });
    this.policies = this.loadDefaultPolicies();
  }

  async moderate(request: ModerationRequest): Promise<ModerationResult> {
    this.validateRequest(request);

    const cacheKey = `mod:${request.content.length}:${request.language}`;
    const cached = this.cache.get<ModerationResult>(cacheKey);
    if (cached) return cached;

    const patternFlags = this.checkPatterns(request.content);
    const aiFlags = await this.checkWithAI(request);
    const allFlags = [...patternFlags, ...aiFlags];

    const score = this.calculateScore(allFlags);
    const action = this.determineAction(score, allFlags);

    const result: ModerationResult = {
      approved: action === ModerationAction.ALLOW,
      flags: allFlags,
      score,
      action,
      reviewedBy: allFlags.length > 0 && aiFlags.length > 0 ? 'ai' : 'ai',
      timestamp: new Date(),
    };

    this.cache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  async checkAgeAppropriateness(content: string, age: number): Promise<AgeAppropriatenessResult> {
    const request: ModerationRequest = {
      content,
      contentType: ModerationContentType.TEXT,
      language: Language.ENGLISH,
      studentAge: age,
    };
    const result = await this.moderate(request);

    const hasConcerns = result.flags.some((f) => f.severity === FlagSeverity.HIGH || f.severity === FlagSeverity.CRITICAL);

    if (hasConcerns && age < 13) {
      return {
        appropriate: false,
        minimumAge: 13,
        contentRating: 'PG13',
        concerns: result.flags.filter((f) => f.severity >= FlagSeverity.HIGH).map((f) => f.category),
      };
    }

    return {
      appropriate: true,
      minimumAge: 0,
      contentRating: 'G',
      concerns: [],
    };
  }

  addPolicy(policy: PolicyRule): void {
    this.policies.push(policy);
    this.logger.info(`Policy added: ${policy.name}`);
  }

  private checkPatterns(content: string): ModerationFlag[] {
    const flags: ModerationFlag[] = [];

    for (const { pattern, type, severity } of TOXIC_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const index = content.indexOf(match);
          flags.push({
            type,
            severity,
            category: type.replace(/_/g, ' '),
            details: `Matched pattern: ${match}`,
            location: {
              start: index,
              end: index + match.length,
              snippet: match,
            },
          });
        }
      }
    }

    return flags;
  }

  private async checkWithAI(request: ModerationRequest): Promise<ModerationFlag[]> {
    try {
      const promptResult = this.promptManager.execute({
        templateId: 'moderation-content',
        variables: {
          content: request.content.slice(0, 2000),
          contentType: request.contentType,
          studentAge: request.studentAge ?? 13,
        },
      });

      const response = await this.provider.chatCompletion({
        messages: [
          { role: 'system', content: 'You are a content moderation system. Respond with JSON only.' },
          { role: 'user', content: promptResult.content },
        ],
        temperature: 0.1,
        maxTokens: 512,
      });

      return this.parseAIFlags(response.content);
    } catch (error) {
      this.logger.warn('AI moderation failed, falling back to pattern matching', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private parseAIFlags(content: string): ModerationFlag[] {
    try {
      const parsed = JSON.parse(content) as Record<string, number>;
      const flags: ModerationFlag[] = [];

      for (const [category, score] of Object.entries(parsed)) {
        if (typeof score === 'number' && score > 0.5) {
          flags.push({
            type: category as FlagType,
            severity: score > 0.8 ? FlagSeverity.HIGH : FlagSeverity.MEDIUM,
            category,
            details: `AI detected ${category} score: ${score}`,
          });
        }
      }

      return flags;
    } catch {
      return [];
    }
  }

  private calculateScore(flags: ModerationFlag[]): ModerationScore {
    const scores: Record<string, number> = {
      toxicity: 0, hateSpeech: 0, harassment: 0, inappropriate: 0,
      violence: 0, selfHarm: 0, sexual: 0, spam: 0,
    };

    for (const flag of flags) {
      const value = this.severityToValue(flag.severity);
      const key = flag.type as string;
      if (key in scores) {
        scores[key] = Math.max(scores[key], value);
      }
    }

    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    const overall = Object.keys(scores).length > 0 ? sum / Object.keys(scores).length : 0;

    return {
      toxicity: scores.toxicity,
      hateSpeech: scores.hateSpeech,
      harassment: scores.harassment,
      inappropriate: scores.inappropriate,
      violence: scores.violence,
      selfHarm: scores.selfHarm,
      sexual: scores.sexual,
      spam: scores.spam,
      overall,
    };
  }

  private determineAction(score: ModerationScore, flags: ModerationFlag[]): ModerationAction {
    if (flags.some((f) => f.severity === FlagSeverity.CRITICAL)) return ModerationAction.BLOCK;
    if (score.overall > 0.7) return ModerationAction.BLOCK;
    if (score.overall > 0.4) return ModerationAction.FLAG;
    if (flags.length > 0) return ModerationAction.REVIEW;
    return ModerationAction.ALLOW;
  }

  private severityToValue(severity: FlagSeverity): number {
    switch (severity) {
      case FlagSeverity.LOW: return 0.25;
      case FlagSeverity.MEDIUM: return 0.5;
      case FlagSeverity.HIGH: return 0.75;
      case FlagSeverity.CRITICAL: return 1.0;
    }
  }

  private validateRequest(request: ModerationRequest): void {
    if (!request.content) {
      throw new CasuyaAIError('Content is required for moderation', ErrorCode.VALIDATION_ERROR);
    }
  }

  private loadDefaultPolicies(): PolicyRule[] {
    return [
      {
        id: 'policy-toxicity',
        name: 'Toxicity Filter',
        description: 'Filter toxic and abusive content',
        flags: [FlagType.TOXICITY, FlagType.HATE_SPEECH, FlagType.HARASSMENT],
        action: ModerationAction.BLOCK,
        threshold: 0.7,
        enabled: true,
      },
      {
        id: 'policy-safety',
        name: 'Safety Filter',
        description: 'Protect minors from harmful content',
        flags: [FlagType.VIOLENCE, FlagType.SELF_HARM, FlagType.SEXUAL],
        action: ModerationAction.BLOCK,
        threshold: 0.5,
        enabled: true,
      },
      {
        id: 'policy-privacy',
        name: 'Privacy Filter',
        description: 'Prevent personal information sharing',
        flags: [FlagType.PERSONAL_INFO],
        action: ModerationAction.BLOCK,
        threshold: 0.8,
        enabled: true,
      },
    ];
  }
}
