/**
 * SyllabusAdapter — fetches NECTA/TIE curriculum data from casuya-platform.
 *
 * This adapter connects the AI agent to the exact Tanzania national curriculum
 * so that tutoring, question generation, and recommendations are aligned
 * with the official TIE syllabus for each subject and form level.
 */

import { Logger } from '../utilities/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SyllabusSubject {
  id: string;
  name: string;
  code: string;
  slug: string;
  necta_code: string | null;
  form_start: number;
  form_end: number;
  is_core: boolean;
  description: string | null;
  topics: SyllabusTopic[];
}

export interface SyllabusTopic {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  form_level: number;
  order_index: number;
  estimated_periods: number | null;
  necta_weight: string | null;
  subtopics: SyllabusSubtopic[];
}

export interface SyllabusSubtopic {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  order_index: number;
  estimated_periods: number | null;
  outcomes: LearningOutcome[];
}

export interface LearningOutcome {
  id: string;
  description: string;
  cognitive_level: string;
  order_index: number;
}

export interface CurriculumContext {
  subject: string;
  form_level: number;
  context: string;
}

export interface OutcomeSearchResult {
  outcome: string;
  cognitive_level: string;
  subtopic: string;
  topic: string;
  subject: string;
  form_level: number;
}

export interface SyllabusAdapterConfig {
  platformUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  cacheTTL?: number;
}

// ── Adapter ───────────────────────────────────────────────────────────────

export class SyllabusAdapter {
  private logger: Logger;
  private platformUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private cacheTTL: number;

  /** In-memory cache: key → { data, expiresAt } */
  private cache: Map<string, { data: unknown; expiresAt: number }>;

  constructor(config: SyllabusAdapterConfig, logger?: Logger) {
    this.logger = logger ?? new Logger({ prefix: '[SyllabusAdapter]' });
    this.platformUrl = config.platformUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.cacheTTL = config.cacheTTL ?? 300_000; // 5 minutes
    this.cache = new Map();
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Get all NECTA subjects, optionally filtered by form level.
   */
  async listSubjects(formLevel?: number): Promise<Array<{
    id: string; name: string; code: string; slug: string;
    necta_code: string | null; form_start: number; form_end: number;
    is_core: boolean; topic_count: number;
  }>> {
    const params = new URLSearchParams();
    if (formLevel !== undefined) params.set('form_level', String(formLevel));

    return this.fetch(`/syllabus/subjects?${params}`);
  }

  /**
   * Get a subject with all topics, subtopics, and learning outcomes.
   */
  async getSubject(slug: string): Promise<SyllabusSubject> {
    return this.fetch(`/syllabus/subjects/${slug}`);
  }

  /**
   * Get a subject's topics for a specific form level.
   */
  async getSubjectByForm(slug: string, formLevel: number): Promise<{
    id: string; name: string; code: string; slug: string;
    form_level: number; topics: SyllabusTopic[];
  }> {
    return this.fetch(`/syllabus/subjects/${slug}/forms/${formLevel}`);
  }

  /**
   * Get the formatted curriculum context string for AI prompt injection.
   *
   * This is the primary method the tutoring engine uses. It returns a
   * text block describing the exact TIE syllabus content for a given
   * subject and form level, including:
   * - Topic codes and names with NECTA weight
   * - Subtopic codes and names
   * - Learning outcomes with cognitive levels (Bloom's taxonomy)
   */
  async getCurriculumContext(slug: string, formLevel: number): Promise<string> {
    const cacheKey = `ctx:${slug}:${formLevel}`;
    const cached = this.cacheGet<string>(cacheKey);
    if (cached !== null) return cached;

    const result = await this.fetch<CurriculumContext>(
      `/syllabus/ai/curriculum-context/${slug}/${formLevel}`,
    );
    this.cacheSet(cacheKey, result.context);
    return result.context;
  }

  /**
   * Search for learning outcomes matching a query.
   *
   * The AI uses this to find the exact TIE learning objectives that
   * relate to a student's question, ensuring the response targets
   * the correct syllabus outcome.
   */
  async searchOutcomes(
    query: string,
    subjectSlug?: string,
    formLevel?: number,
  ): Promise<OutcomeSearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (subjectSlug) params.set('subject', subjectSlug);
    if (formLevel !== undefined) params.set('form_level', String(formLevel));

    const result = await this.fetch<{ results: OutcomeSearchResult[] }>(
      `/syllabus/ai/search-outcomes?${params}`,
    );
    return result.results;
  }

  /**
   * Get the next recommended topic for a student based on their
   * current position in the syllabus.
   */
  async getNextTopic(
    subjectSlug: string,
    formLevel: number,
    currentTopicCode: string | null,
  ): Promise<SyllabusTopic | null> {
    const subject = await this.getSubjectByForm(subjectSlug, formLevel);
    if (!subject || !subject.topics.length) return null;

    if (!currentTopicCode) return subject.topics[0];

    const currentIndex = subject.topics.findIndex(
      (t) => t.code === currentTopicCode,
    );
    if (currentIndex < 0 || currentIndex >= subject.topics.length - 1) {
      return null;
    }

    return subject.topics[currentIndex + 1];
  }

  /**
   * Build a focused curriculum excerpt for a specific topic.
   * Returns a condensed string with just the relevant subtopics
   * and outcomes, useful for targeted question generation.
   */
  async getTopicContext(
    subjectSlug: string,
    formLevel: number,
    topicCode: string,
  ): Promise<string> {
    const subject = await this.getSubjectByForm(subjectSlug, formLevel);
    if (!subject) return '';

    const topic = subject.topics.find((t) => t.code === topicCode);
    if (!topic) return '';

    const lines = [
      `TOPIC: ${topic.title} (${topic.code})`,
      `Form: ${formLevel} | Subject: ${subject.name} | Weight: ${topic.necta_weight ?? 'medium'}`,
      '',
    ];

    for (const sub of topic.subtopics) {
      lines.push(`Subtopic ${sub.code}: ${sub.title}`);
      for (const outcome of sub.outcomes) {
        lines.push(`  [${outcome.cognitive_level}] ${outcome.description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Map a subject slug and form level to the correct NECTA subject code.
   */
  async getNectaCode(subjectSlug: string): Promise<string | null> {
    const subjects = await this.listSubjects();
    const match = subjects.find((s) => s.slug === subjectSlug);
    return match?.necta_code ?? null;
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.platformUrl}${path}`;
    const cacheKey = `fetch:${url}`;
    const cached = this.cacheGet<T>(cacheKey);
    if (cached !== null) return cached;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Syllabus API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      this.cacheSet(cacheKey, data);
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch syllabus data from ${path}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private cacheSet(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTTL,
    });
  }
}
