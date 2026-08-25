import type { Element, Snapshot } from '../types';

export interface ExamsConfig {
  apiBase: string;
  authToken?: string;
  lessonId?: string;
  studentId?: string;
}

export interface StepSubmission {
  stepNumber: number;
  elements: Element[];
  recognizedLatex?: string;
  expectedAnswer?: string;
  timeSpentMs: number;
}

export interface StepResult {
  stepNumber: number;
  correct: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  recognizedLatex?: string;
}

export interface ExamSubmission {
  lessonId: string;
  studentId: string;
  steps: StepSubmission[];
  totalTimeMs: number;
  snapshot?: Snapshot;
}

export interface ExamResult {
  examId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  stepResults: StepResult[];
  passed: boolean;
}

export class ExamsBridge {
  private config: ExamsConfig;
  private stepQueue: StepSubmission[] = [];
  private startTime = Date.now();

  constructor(config: ExamsConfig) {
    this.config = config;
  }

  setAuthToken(token: string): void {
    this.config.authToken = token;
  }

  async submitStep(step: StepSubmission): Promise<StepResult> {
    this.stepQueue.push(step);
    return this.validateStep(step);
  }

  private async validateStep(step: StepSubmission): Promise<StepResult> {
    if (!this.config.apiBase) {
      return this.localValidate(step);
    }

    try {
      const resp = await fetch(`${this.config.apiBase}/exams/validate-step`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          lessonId: this.config.lessonId,
          studentId: this.config.studentId,
          step,
        }),
      });

      if (!resp.ok) throw new Error(`Validation failed: ${resp.status}`);
      return await resp.json();
    } catch {
      return this.localValidate(step);
    }
  }

  private localValidate(step: StepSubmission): StepResult {
    if (!step.expectedAnswer || !step.recognizedLatex) {
      return {
        stepNumber: step.stepNumber,
        correct: false,
        score: 0,
        maxScore: 1,
        feedback: 'No answer to validate',
      };
    }

    const normalized = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const correct = normalized(step.recognizedLatex) === normalized(step.expectedAnswer);

    return {
      stepNumber: step.stepNumber,
      correct,
      score: correct ? 1 : 0,
      maxScore: 1,
      feedback: correct ? 'Correct!' : `Expected: ${step.expectedAnswer}`,
    };
  }

  async submitExam(): Promise<ExamResult> {
    const totalTimeMs = Date.now() - this.startTime;
    const submission: ExamSubmission = {
      lessonId: this.config.lessonId!,
      studentId: this.config.studentId!,
      steps: this.stepQueue,
      totalTimeMs,
    };

    if (this.config.apiBase) {
      try {
        const resp = await fetch(`${this.config.apiBase}/exams/submit`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(submission),
        });
        if (resp.ok) return await resp.json();
      } catch { /* fall back to local */ }
    }

    const stepResults = this.stepQueue.map(s => this.localValidate(s));
    const totalScore = stepResults.reduce((sum, r) => sum + r.score, 0);
    const maxScore = stepResults.reduce((sum, r) => sum + r.maxScore, 0);

    return {
      examId: `local-${Date.now()}`,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      stepResults,
      passed: maxScore > 0 && totalScore / maxScore >= 0.5,
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.authToken) headers['Authorization'] = `Bearer ${this.config.authToken}`;
    return headers;
  }

  getSteps(): StepSubmission[] {
    return this.stepQueue;
  }

  reset(): void {
    this.stepQueue = [];
    this.startTime = Date.now();
  }
}