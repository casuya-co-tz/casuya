/**
 * Subject-specific framework instructions for the TIE/NECTA tutoring system.
 *
 * Each framework provides rules, formatting conventions, diagram styles,
 * local examples, and common NECTA mistakes for a specific subject.
 */

export interface SubjectFramework {
  /** Subject name */
  subject: string;
  /** Functional emoji for markdown headers */
  emoji: string;
  /** Core rules for how responses should be structured */
  rules: string[];
  /** NECTA-specific marking tip */
  nectaTip: string;
}

const FRAMEWORKS: Record<string, SubjectFramework> = {
  mathematics: {
    subject: 'Mathematics',
    emoji: '🧮',
    rules: [
      'Show full working, step by step — NECTA marking schemes award marks per step, not just the final answer.',
      'Use standard notation from TIE Mathematics textbooks (e.g. sin θ, not sin(theta)).',
      'For geometry/graphs, describe the sketch in words (axes, key points, intercepts).',
      'Flag common losses: forgetting units, not simplifying fractions, wrong significant figures.',
    ],
    nectaTip: 'Always show the formula before substituting values. Markers award "method marks" even if the final answer is wrong.',
  },
  physics: {
    subject: 'Physics',
    emoji: '⚛️',
    rules: [
      'Always give quantities with correct SI units.',
      'State the formula first, define each symbol, then substitute values.',
      'For circuits/forces/rays, use an ASCII diagram with labeled points (e.g. [Battery]---[Resistor]---[Bulb]).',
    ],
    nectaTip: 'Unit conversion errors lose the most marks. Always write the formula before substituting — markers award method marks.',
  },
  chemistry: {
    subject: 'Chemistry',
    emoji: '🧪',
    rules: [
      'Show balanced chemical equations with state symbols: (s) (l) (g) (aq).',
      'Use IUPAC names alongside common names where TIE textbooks do.',
      'For practical questions, structure as: Aim → Apparatus → Procedure → Observation → Conclusion.',
    ],
    nectaTip: 'Unbalanced equations and missing state symbols are the top mark-losers. Check valency in formula writing.',
  },
};

const COMMON: SubjectFramework = {
  subject: 'General',
  emoji: '📚',
  rules: [
    'Start with a direct, precise answer.',
    'Use real-world Tanzanian examples where applicable.',
    'Adapt depth to the student\'s level.',
  ],
  nectaTip: 'Use precise terminology from the TIE textbook. Markers look for exact keywords.',
};

/**
 * Get the subject-specific framework for a given subject slug.
 * Returns the common framework if no specific one is found.
 */
export function getSubjectFramework(subjectSlug: string): SubjectFramework {
  const key = subjectSlug.toLowerCase().replace(/[\s-]/g, '');
  return FRAMEWORKS[key] ?? COMMON;
}

/**
 * Build the subject-specific framework section for injection into a system prompt.
 */
export function buildSubjectFrameworkBlock(subjectSlug: string): string {
  const fw = getSubjectFramework(subjectSlug);
  const rules = fw.rules.map(r => `- ${r}`).join('\n');
  return `### ${fw.emoji} ${fw.subject} — Response Rules\n\n${rules}\n\n> 💡 **NECTA Tip:** ${fw.nectaTip}`;
}
