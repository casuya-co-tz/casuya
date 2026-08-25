import {
  StudentProfile,
  StudentModel,
  AdaptiveParameters,
  PersonalizationEvent,
  PersonalizationEventType,
  Difficulty,
  ContentType,
  Language,
} from '../types';
import { CacheManager } from '../caching/cache-manager';
import { Logger } from '../utilities/logger';

export class PersonalizationEngine {
  private profiles: Map<string, StudentModel>;
  private cache: CacheManager;

  constructor(_logger?: Logger) {
    this.profiles = new Map();
    this.cache = new CacheManager({ defaultTTL: 24 * 60 * 60 * 1000 });
  }

  async getStudentProfile(studentId: string): Promise<StudentProfile | null> {
    const cached = this.cache.get<StudentProfile>(`profile:${studentId}`);
    if (cached) return cached;

    const model = this.profiles.get(studentId);
    return model?.profile ?? null;
  }

  async updateStudentProfile(studentId: string, profile: Partial<StudentProfile>): Promise<StudentProfile> {
    let model = this.profiles.get(studentId);
    if (!model) {
      model = this.createDefaultModel(studentId);
    }

    model.profile = { ...model.profile, ...profile, id: studentId };
    model.lastUpdated = new Date();
    this.profiles.set(studentId, model);
    this.cache.set(`profile:${studentId}`, model.profile);

    return model.profile;
  }

  async recordEvent(event: PersonalizationEvent): Promise<void> {
    let model = this.profiles.get(event.studentId);
    if (!model) {
      model = this.createDefaultModel(event.studentId);
    }

    model.history.push(event);
    model.lastUpdated = new Date();

    if (model.history.length > 1000) {
      model.history = model.history.slice(-500);
    }

    this.profiles.set(event.studentId, model);
    this.processEvent(event, model);
  }

  async getAdaptiveParameters(studentId: string): Promise<AdaptiveParameters> {
    const model = this.profiles.get(studentId);
    if (!model) return this.createDefaultAdaptiveParams();

    const recentEvents = model.history.slice(-50);
    return this.calculateAdaptiveParams(recentEvents, model);
  }

  async calculateDifficulty(studentId: string): Promise<Difficulty> {
    const model = this.profiles.get(studentId);
    if (!model) return Difficulty.BEGINNER;

    const recentPerformance = model.history
      .filter((e) => e.type === PersonalizationEventType.QUIZ_ATTEMPTED)
      .slice(-10);

    if (recentPerformance.length === 0) return Difficulty.BEGINNER;

    const avgScore = recentPerformance.reduce((sum, e) => {
      return sum + ((e.data.score as number) ?? 0);
    }, 0) / recentPerformance.length;

    if (avgScore >= 0.9) return Difficulty.EXPERT;
    if (avgScore >= 0.75) return Difficulty.ADVANCED;
    if (avgScore >= 0.55) return Difficulty.INTERMEDIATE;
    if (avgScore >= 0.35) return Difficulty.ELEMENTARY;
    return Difficulty.BEGINNER;
  }

  private processEvent(event: PersonalizationEvent, model: StudentModel): void {
    switch (event.type) {
      case PersonalizationEventType.CONCEPT_MASTERED:
        model.profile.knowledgeState.masteredConcepts++;
        break;
      case PersonalizationEventType.CONCEPT_STRUGGLED:
        model.adaptParams.scaffoldingAmount = 'extensive';
        break;
      case PersonalizationEventType.ENGAGEMENT_DROP:
        model.adaptParams.paceMultiplier = Math.max(0.5, model.adaptParams.paceMultiplier - 0.1);
        break;
      case PersonalizationEventType.DIFFICULTY_ADJUSTED:
        model.adaptParams.currentDifficulty = event.data.difficulty as Difficulty;
        break;
    }
  }

  private calculateAdaptiveParams(
    recentEvents: PersonalizationEvent[],
    model: StudentModel,
  ): AdaptiveParameters {
    const params = { ...model.adaptParams };

    const completedEvents = recentEvents.filter(
      (e) => e.type === PersonalizationEventType.LESSON_COMPLETED,
    );
    if (completedEvents.length > 5) {
      params.paceMultiplier = Math.min(2.0, params.paceMultiplier + 0.1);
    }

    const struggledEvents = recentEvents.filter(
      (e) => e.type === PersonalizationEventType.CONCEPT_STRUGGLED,
    );
    if (struggledEvents.length > 3) {
      params.hintLevel = Math.min(5, params.hintLevel + 1);
    }

    return params;
  }

  private createDefaultModel(studentId: string): StudentModel {
    return {
      profile: {
        id: studentId,
        language: Language.ENGLISH,
        learningStyle: { visual: 0.5, auditory: 0.5, reading: 0.5, kinesthetic: 0.5 },
        preferences: {
          language: Language.ENGLISH,
          difficulty: Difficulty.BEGINNER,
          contentTypes: [ContentType.LESSON],
          sessionDuration: 30,
          includeGamification: true,
          includeRealWorldExamples: true,
        },
        accessibility: {
          fontSize: 'medium',
          highContrast: false,
          screenReader: false,
          subtitlePreference: false,
          reducedMotion: false,
        },
        knowledgeState: {
          overallMastery: 0,
          subjectsCompleted: 0,
          totalConcepts: 0,
          masteredConcepts: 0,
          averageTimePerLesson: 0,
        },
      },
      adaptParams: this.createDefaultAdaptiveParams(),
      history: [],
      lastUpdated: new Date(),
    };
  }

  private createDefaultAdaptiveParams(): AdaptiveParameters {
    return {
      currentDifficulty: Difficulty.BEGINNER,
      paceMultiplier: 1.0,
      hintLevel: 1,
      scaffoldingAmount: 'moderate',
      repetitionInterval: 1,
    };
  }
}
