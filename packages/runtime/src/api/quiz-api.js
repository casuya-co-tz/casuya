export class QuizAPI {
  constructor(options = {}) {
    this._options = {
      stateManager: null,
      eventBus: null,
      ...options
    };
    this._answers = {};
    this._scores = {};
    this._currentQuiz = null;
    this._listeners = new Map();
  }

  setCurrentQuiz(quizId) {
    this._currentQuiz = quizId;
  }

  getCurrentQuiz() {
    return this._currentQuiz;
  }

  submitAnswer(questionId, answer, metadata = {}) {
    if (!questionId) {
      throw new Error('questionId is required');
    }
    const entry = {
      questionId,
      answer,
      timestamp: Date.now(),
      metadata
    };
    this._answers[questionId] = entry;
    this._saveToState('quizAnswers', questionId, entry);
    this._emit('quiz:answer', entry);
    return { success: true, questionId };
  }

  getAnswer(questionId) {
    return this._answers[questionId] || null;
  }

  getAllAnswers() {
    return { ...this._answers };
  }

  scoreQuiz(quizId, score, maxScore, metadata = {}) {
    const result = {
      quizId,
      score,
      maxScore,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      timestamp: Date.now(),
      metadata
    };
    this._scores[quizId] = result;
    this._saveToState('quizScores', quizId, result);
    this._emit('quiz:scored', result);
    return result;
  }

  getScore(quizId) {
    return this._scores[quizId] || null;
  }

  getAllScores() {
    return { ...this._scores };
  }

  getPercentage(quizId) {
    const score = this._scores[quizId];
    if (!score) return null;
    return score.percentage;
  }

  isCorrect(questionId) {
    return !!this._answers[questionId];
  }

  reset(quizId) {
    if (quizId) {
      delete this._answers[quizId];
      delete this._scores[quizId];
    } else {
      this._answers = {};
      this._scores = {};
    }
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch {}
      }
    }
    this._options.eventBus?.emit(event, data);
  }

  _saveToState(key, id, value) {
    if (this._options.stateManager) {
      this._options.stateManager.set(`${key}.${id}`, value);
    }
  }

  destroy() {
    this._listeners.clear();
    this._answers = {};
    this._scores = {};
  }
}
