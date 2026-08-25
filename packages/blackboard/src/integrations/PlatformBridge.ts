import { Blackboard } from '../Blackboard';
import type { Element, Snapshot, BlackboardOptions } from '../types';
import { ExamsBridge, type ExamsConfig, type StepSubmission, type StepResult, type ExamResult } from './ExamsBridge';
import { MathBridge, type MathConfig } from './MathBridge';
import { OcrBridge, type OcrConfig, type OcrResult } from './OcrBridge';

export interface PlatformConfig {
  apiBase: string;
  authToken?: string;
  lessonId?: string;
  studentId?: string;
  exams?: ExamsConfig;
  math?: MathConfig;
  ocr?: OcrConfig;
  blackboard?: Partial<BlackboardOptions>;
}

export class PlatformBridge {
  private config: PlatformConfig;
  private blackboard: Blackboard | null = null;
  private exams: ExamsBridge | null = null;
  private math: MathBridge | null = null;
  private ocr: OcrBridge | null = null;
  private currentStep = 1;
  private stepElements: Map<number, Element[]> = new Map();
  private saveTimer: number | null = null;

  constructor(config: PlatformConfig) {
    this.config = config;
    this.initBridges();
  }

  private initBridges(): void {
    if (this.config.exams) {
      this.exams = new ExamsBridge({
        ...this.config.exams,
        apiBase: this.config.apiBase,
        authToken: this.config.authToken,
        lessonId: this.config.lessonId,
        studentId: this.config.studentId,
      });
    }

    if (this.config.math) {
      this.math = new MathBridge({
        ...this.config.math,
        apiBase: this.config.apiBase,
      });
    }

    if (this.config.ocr) {
      this.ocr = new OcrBridge(this.config.ocr);
    }
  }

  mount(container: HTMLElement, options?: Partial<BlackboardOptions>): Blackboard {
    this.blackboard = new Blackboard({
      container,
      width: options?.width ?? 880,
      height: options?.height ?? 560,
      color: options?.color ?? '#1e293b',
      strokeWidth: options?.strokeWidth ?? 2,
      graph: options?.graph,
    });

    this.setupAutoSave();
    return this.blackboard;
  }

  unmount(): void {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.blackboard?.destroy();
    this.blackboard = null;
  }

  private setupAutoSave(): void {
    if (!this.blackboard) return;
    this.saveTimer = window.setInterval(() => {
      this.saveProgress();
    }, 30000);
  }

  async saveProgress(): Promise<void> {
    if (!this.blackboard) return;
    const snapshot = this.blackboard.exportJSON();
    this.stepElements.set(this.currentStep, snapshot.elements);

    try {
      await fetch(`${this.config.apiBase}/progress/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`,
        },
        body: JSON.stringify({
          student_id: this.config.studentId,
          lesson_id: this.config.lessonId,
          step: this.currentStep,
          elements: snapshot.elements,
          timestamp: Date.now(),
        }),
      });
    } catch { /* offline - saved locally */ }
  }

  async loadProgress(): Promise<boolean> {
    if (!this.blackboard) return false;
    try {
      const resp = await fetch(`${this.config.apiBase}/progress/${this.config.studentId}/${this.config.lessonId}`, {
        headers: { 'Authorization': `Bearer ${this.config.authToken}` },
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.elements) {
        this.blackboard.importJSON({ elements: data.elements, width: 880, height: 560 });
        this.currentStep = data.step || 1;
        this.stepElements.set(this.currentStep, data.elements);
        return true;
      }
    } catch { return false; }
    return false;
  }

  async nextStep(): Promise<{ step: number; result?: StepResult }> {
    if (!this.blackboard || !this.exams) {
      this.currentStep++;
      this.blackboard?.clear();
      return { step: this.currentStep };
    }

    const elements = this.blackboard.getElements() as Element[];
    const stepSubmission: StepSubmission = {
      stepNumber: this.currentStep,
      elements,
      timeSpentMs: Date.now() - (this.stepElements.get(this.currentStep)?.[0]?.createdAt ?? Date.now()),
    };

    const result = await this.exams.submitStep(stepSubmission);
    this.stepElements.set(this.currentStep, elements);
    this.currentStep++;
    this.blackboard.clear();

    return { step: this.currentStep, result };
  }

  async submitExam(): Promise<ExamResult | null> {
    if (!this.exams) return null;
    return this.exams.submitExam();
  }

  async recognizeHandwriting(imageData: string | HTMLCanvasElement | Blob): Promise<OcrResult | null> {
    if (!this.ocr) return null;
    return this.ocr.recognize(imageData);
  }

  async renderMath(latex: string, element: HTMLElement): Promise<void> {
    if (!this.math) return;
    await this.math.renderToDom(latex, element);
  }

  getMathBridge(): MathBridge | null {
    return this.math;
  }

  getExamsBridge(): ExamsBridge | null {
    return this.exams;
  }

  getOcrBridge(): OcrBridge | null {
    return this.ocr;
  }

  getBlackboard(): Blackboard | null {
    return this.blackboard;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  setStep(step: number): void {
    this.currentStep = step;
  }

  setAuthToken(token: string): void {
    this.config.authToken = token;
    this.exams?.setAuthToken(token);
  }
}