import {
  SummarizationRequest,
  SummarizationResult,
  SummarizationStrategy,
  SummaryLength,
  ExtractedSentence,
} from '../types';
import { BaseProvider } from '../providers/base-provider';
import { PromptManager } from '../prompts/prompt-manager';
import { CacheManager } from '../caching/cache-manager';
import { CasuyaAIError, ErrorCode, Logger } from '../utilities';

const LENGTH_MULTIPLIERS: Record<SummaryLength, number> = {
  [SummaryLength.TINY]: 0.05,
  [SummaryLength.SHORT]: 0.1,
  [SummaryLength.MEDIUM]: 0.2,
  [SummaryLength.LONG]: 0.4,
  [SummaryLength.FULL]: 0.7,
};

export class Summarizer {
  private cache: CacheManager;

  constructor(
    private provider: BaseProvider,
    private promptManager: PromptManager,
    _logger?: Logger,
  ) {
    this.cache = new CacheManager({ defaultTTL: 60 * 60 * 1000 });
  }

  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    this.validateRequest(request);

    const cacheKey = `summ:${request.strategy}:${request.length}:${request.language}`;
    const cached = this.cache.get<SummarizationResult>(cacheKey);
    if (cached) return cached;

    let result: SummarizationResult;

    switch (request.strategy) {
      case SummarizationStrategy.EXTRACTIVE:
        result = await this.extractiveSummarize(request);
        break;
      case SummarizationStrategy.ABSTRACTIVE:
        result = await this.abstractiveSummarize(request);
        break;
      case SummarizationStrategy.HYBRID:
      default:
        result = await this.hybridSummarize(request);
        break;
    }

    this.cache.set(cacheKey, result, 30 * 60 * 1000);
    return result;
  }

  private async extractiveSummarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const sentences = this.splitSentences(request.content);
    const targetCount = Math.max(1, Math.floor(sentences.length * LENGTH_MULTIPLIERS[request.length]));
    const scored = await this.scoreSentences(sentences, request);

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, targetCount);
    selected.sort((a, b) => a.position - b.position);

    const summary = selected.map((s) => s.text).join(' ');
    const originalLength = request.content.length;

    return {
      summary,
      originalLength,
      summaryLength: summary.length,
      compressionRatio: originalLength > 0 ? summary.length / originalLength : 0,
      strategy: SummarizationStrategy.EXTRACTIVE,
      keyPoints: selected.slice(0, 3).map((s) => s.text),
      language: request.language,
      confidence: 0.85,
    };
  }

  private async abstractiveSummarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const promptResult = this.promptManager.execute({
      templateId: 'summarization-educational',
      variables: {
        content: request.content,
        difficulty: request.difficulty ?? 'intermediate',
        length: request.length,
        language: request.language,
        numKeyPoints: 3,
      },
    });

    const response = await this.provider.chatCompletion({
      messages: [
        { role: 'system', content: 'You are an educational summarization assistant.' },
        { role: 'user', content: promptResult.content },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    const [summary, ...keyPoints] = response.content.split('\n').filter((l) => l.trim());
    const originalLength = request.content.length;

    return {
      summary: summary ?? response.content,
      originalLength,
      summaryLength: (summary ?? response.content).length,
      compressionRatio: originalLength > 0 ? (summary ?? response.content).length / originalLength : 0,
      strategy: SummarizationStrategy.ABSTRACTIVE,
      keyPoints: keyPoints.slice(0, 5),
      language: request.language,
      confidence: 0.90,
    };
  }

  private async hybridSummarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const extractive = await this.extractiveSummarize(request);
    const hybridRequest: SummarizationRequest = {
      ...request,
      content: extractive.summary,
      strategy: SummarizationStrategy.ABSTRACTIVE,
    };
    const abstractive = await this.abstractiveSummarize(hybridRequest);

    return {
      ...abstractive,
      strategy: SummarizationStrategy.HYBRID,
      compressionRatio: request.content.length > 0
        ? abstractive.summary.length / request.content.length
        : 0,
    };
  }

  private async scoreSentences(sentences: string[], _request: SummarizationRequest): Promise<ExtractedSentence[]> {
    const total = sentences.length;
    const center = Math.floor(total / 2);

    return sentences.map((text, i) => {
      let score = 0;

      score += 1.0 - Math.abs(i - center) / center;
      score += text.length > 40 ? 0.3 : 0;
      score += text.length > 100 ? 0.2 : 0;

      const importantWords = ['key', 'important', 'significant', 'therefore', 'conclusion', 'result', 'because', 'thus'];
      for (const word of importantWords) {
        if (text.toLowerCase().includes(word)) score += 0.1;
      }

      const firstLineBonus = i === 0 ? 0.5 : 0;
      score += firstLineBonus;

      return { text, score, position: i, selected: false };
    });
  }

  private splitSentences(text: string): string[] {
    const sentences = text.match(/[^.!?\n]+[.!?]*\s*/g) ?? [text];
    return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  private validateRequest(request: SummarizationRequest): void {
    if (!request.content || request.content.length === 0) {
      throw new CasuyaAIError('Content is required for summarization', ErrorCode.VALIDATION_ERROR);
    }
  }
}
