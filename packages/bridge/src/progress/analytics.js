/** Aggregates completed sessions into simple per-lesson analytics. */

export function summarizeSessions(sessions) {
  if (sessions.length === 0) {
    return { count: 0, avgElapsedMs: 0, avgCompletionPercentage: 0, avgScorePercentage: 0 };
  }

  const count = sessions.length;
  const avgElapsedMs = Math.round(
    sessions.reduce((sum, s) => sum + (s.elapsedMs ?? 0), 0) / count
  );
  const avgCompletionPercentage = Math.round(
    sessions.reduce((sum, s) => sum + (s.completionPercentage ?? 0), 0) / count
  );
  const scored = sessions.filter((s) => typeof s.scorePercentage === 'number');
  const avgScorePercentage =
    scored.length === 0
      ? 0
      : Math.round(scored.reduce((sum, s) => sum + s.scorePercentage, 0) / scored.length);

  return { count, avgElapsedMs, avgCompletionPercentage, avgScorePercentage };
}
