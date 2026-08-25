import { ComponentType, type QuizComponentData, type QuizQuestion, type QuizOption, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';
import { generateId } from '../utils/id-generator.js';

export class QuizComponent extends BaseComponent {
  private quizData: QuizComponentData;

  constructor(
    id: string,
    title = 'Quiz',
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Quiz, id, 'Quiz', position, size);
    this.quizData = {
      ...this.data,
      type: ComponentType.Quiz,
      title,
      questions: [],
      passingScore: 70,
      showFeedback: true,
      randomizeOptions: false,
    };
    if (style) {
      this.setStyle(style);
      this.quizData.style = this.data.style;
    }
  }

  get title(): string {
    return this.quizData.title;
  }

  set title(value: string) {
    this.quizData.title = value;
  }

  get questions(): QuizQuestion[] {
    return [...this.quizData.questions];
  }

  get passingScore(): number {
    return this.quizData.passingScore;
  }

  set passingScore(value: number) {
    this.quizData.passingScore = Math.max(0, Math.min(100, value));
  }

  get showFeedback(): boolean {
    return this.quizData.showFeedback;
  }

  set showFeedback(value: boolean) {
    this.quizData.showFeedback = value;
  }

  get randomizeOptions(): boolean {
    return this.quizData.randomizeOptions;
  }

  set randomizeOptions(value: boolean) {
    this.quizData.randomizeOptions = value;
  }

  addQuestion(text: string, type: QuizQuestion['type'] = 'multiple-choice'): QuizQuestion {
    const question: QuizQuestion = {
      id: generateId(),
      text,
      type,
      options: type === 'true-false'
        ? [
            { id: generateId(), text: 'True', isCorrect: true },
            { id: generateId(), text: 'False', isCorrect: false },
          ]
        : [],
      correctAnswer: '',
      points: 10,
      explanation: '',
    };
    this.quizData.questions.push(question);
    return question;
  }

  removeQuestion(questionId: string): boolean {
    const index = this.quizData.questions.findIndex((q) => q.id === questionId);
    if (index === -1) return false;
    this.quizData.questions.splice(index, 1);
    return true;
  }

  updateQuestion(questionId: string, updates: Partial<QuizQuestion>): boolean {
    const question = this.quizData.questions.find((q) => q.id === questionId);
    if (!question) return false;
    Object.assign(question, updates);
    return true;
  }

  addOption(questionId: string, text: string, isCorrect = false): QuizOption | null {
    const question = this.quizData.questions.find((q) => q.id === questionId);
    if (!question) return null;
    const option: QuizOption = { id: generateId(), text, isCorrect };
    question.options.push(option);
    return option;
  }

  removeOption(questionId: string, optionId: string): boolean {
    const question = this.quizData.questions.find((q) => q.id === questionId);
    if (!question) return false;
    const index = question.options.findIndex((o) => o.id === optionId);
    if (index === -1) return false;
    question.options.splice(index, 1);
    return true;
  }

  getQuestionCount(): number {
    return this.quizData.questions.length;
  }

  getTotalPoints(): number {
    return this.quizData.questions.reduce((sum, q) => sum + q.points, 0);
  }

  calculateScore(answers: Record<string, string>): { score: number; percentage: number; passed: boolean } {
    let earned = 0;
    let total = 0;

    for (const question of this.quizData.questions) {
      total += question.points;
      const answer = answers[question.id];
      if (answer !== undefined) {
        const correct = question.options.find((o) => o.isCorrect);
        if (correct && answer === correct.id) {
          earned += question.points;
        } else if (question.type === 'short-answer' && answer.toLowerCase() === question.correctAnswer.toLowerCase()) {
          earned += question.points;
        }
      }
    }

    const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;
    return {
      score: earned,
      percentage,
      passed: percentage >= this.quizData.passingScore,
    };
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.quizData.style = this.data.style;
  }

  toJSON(): QuizComponentData {
    return {
      ...this.data,
      type: ComponentType.Quiz,
      title: this.quizData.title,
      questions: this.quizData.questions,
      passingScore: this.quizData.passingScore,
      showFeedback: this.quizData.showFeedback,
      randomizeOptions: this.quizData.randomizeOptions,
    };
  }

  clone(newId: string): QuizComponent {
    const cloned = new QuizComponent(
      newId,
      this.quizData.title,
      this.position,
      this.size,
      this.style
    );
    cloned.quizData.questions = JSON.parse(JSON.stringify(this.quizData.questions));
    cloned.passingScore = this.quizData.passingScore;
    cloned.showFeedback = this.quizData.showFeedback;
    cloned.randomizeOptions = this.quizData.randomizeOptions;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: QuizComponentData): QuizComponent {
    const component = new QuizComponent(
      data.id,
      data.title,
      data.position,
      data.size,
      data.style
    );
    component.quizData.questions = data.questions;
    component.passingScore = data.passingScore;
    component.showFeedback = data.showFeedback;
    component.randomizeOptions = data.randomizeOptions;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
