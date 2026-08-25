/** Determines whether a lesson session counts as "complete" and computes
 * a 0-100 completion percentage from tracked section visits. */

export function computeCompletion(totalSections, visitedSectionIds) {
  const visited = new Set(visitedSectionIds);
  let visitedCount;
  if (typeof totalSections === 'number' && totalSections > 0) {
    visitedCount = [...visited].filter((id) => {
      const num = typeof id === 'number' ? id : Number(id);
      return !Number.isNaN(num) && num >= 0 && num < totalSections;
    }).length;
  } else {
    visitedCount = visited.size;
  }
  const percentage = totalSections <= 0 ? 0 : Math.round((visitedCount / totalSections) * 100);
  return { visitedCount, totalSections, percentage, isComplete: percentage >= 100 };
}