/** Scoring for quiz-mode interactions within a lesson. */

export function computeScore(answers) {
  const total = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { total, correct, incorrect: total - correct, percentage };
}

export function letterGrade(percentage) {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}
