import {
  TranslationRequest,
  TranslationResult,
  LanguageDetectionResult,
  TranslationDomain,
  Language,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { PromptManager } from '../prompts/prompt-manager';
import { CacheManager } from '../caching/cache-manager';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';

const LANGUAGE_KEYWORDS: Record<string, RegExp> = {
  [Language.ENGLISH]: /\b(the|is|are|was|were|have|has|been|will|would|could|should)\b/i,
  [Language.SPANISH]: /\b(el|la|los|las|es|son|está|están|tener|haber|poder|deber)\b/i,
  [Language.FRENCH]: /\b(le|la|les|est|sont|ont|être|avoir|pouvoir|devoir)\b/i,
  [Language.GERMAN]: /\b(der|die|das|ist|sind|haben|sein|werden|können|müssen)\b/i,
  [Language.PORTUGUESE]: /\b(o|a|os|as|é|são|está|têm|ser|ter|poder|dever)\b/i,
};

export class Translator {
  private cache: CacheManager;

  constructor(
    private provider: BaseProvider,
    private promptManager: PromptManager,
    _logger?: Logger,
  ) {
    this.cache = new CacheManager({ defaultTTL: 60 * 60 * 1000 });
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.validateRequest(request);

    const cacheKey = `trans:${request.sourceLanguage}:${request.targetLanguage}:${request.text.length}`;
    const cached = this.cache.get<TranslationResult>(cacheKey);
    if (cached) return cached;

    const promptResult = this.promptManager.execute({
      templateId: 'translation-educational',
      variables: {
        content: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        domain: request.domain ?? TranslationDomain.EDUCATION,
      },
    });

    const response = await this.provider.chatCompletion({
      messages: [
        { role: 'system', content: 'You are an educational translator. Translate accurately while preserving meaning.' },
        { role: 'user', content: promptResult.content },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    const result: TranslationResult = {
      translatedText: response.content,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: response.finishReason === 'stop' ? 0.9 : 0.7,
      latency: response.latency,
    };

    this.cache.set(cacheKey, result, 60 * 60 * 1000);
    return result;
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    const scores: Array<{ language: Language; confidence: number }> = [];

    for (const [lang, pattern] of Object.entries(LANGUAGE_KEYWORDS)) {
      const matches = text.match(pattern);
      if (matches) {
        scores.push({
          language: lang as Language,
          confidence: matches.length / text.split(/\s+/).length,
        });
      }
    }

    scores.sort((a, b) => b.confidence - a.confidence);

    if (scores.length === 0) {
      return {
        detectedLanguage: Language.ENGLISH,
        confidence: 0.5,
        alternatives: [],
      };
    }

    return {
      detectedLanguage: scores[0].language,
      confidence: Math.min(1, scores[0].confidence * 5),
      alternatives: scores.slice(1, 3),
    };
  }

  async batchTranslate(texts: string[], sourceLanguage: Language, targetLanguage: Language, domain?: TranslationDomain): Promise<TranslationResult[]> {
    if (texts.length > 100) {
      throw new CasuyaAIError('Batch translation limited to 100 texts', ErrorCode.VALIDATION_ERROR);
    }

    return Promise.all(
      texts.map((text) =>
        this.translate({ text, sourceLanguage, targetLanguage, domain }),
      ),
    );
  }

  private validateRequest(request: TranslationRequest): void {
    if (!request.text || request.text.length === 0) {
      throw new CasuyaAIError('Text is required for translation', ErrorCode.VALIDATION_ERROR);
    }
    if (request.text.length > 50000) {
      throw new CasuyaAIError('Text exceeds maximum length of 50000 characters', ErrorCode.VALIDATION_ERROR);
    }
  }
}
