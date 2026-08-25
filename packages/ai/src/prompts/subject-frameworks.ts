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
  biology: {
    subject: 'Biology',
    emoji: '🌱',
    rules: [
      'Use correct classification terms (Kingdom → Phylum → Class...) when relevant.',
      'Draw diagrams as labeled ASCII/flow: e.g. Sun → Grass → Zebra → Lion.',
      'Use Tanzanian ecological examples (Serengeti, Lake Victoria basin, local crops/diseases) in blockquotes.',
    ],
    nectaTip: 'Diagram arrows must point correctly (energy direction). Don\'t confuse similar terms like diffusion vs. osmosis.',
  },
  geography: {
    subject: 'Geography',
    emoji: '🌍',
    rules: [
      'Use cause → process → effect framework for physical geography topics.',
      'For map-work: state the method (e.g. "measure bearing clockwise from North") not just the answer.',
      'Use real Tanzanian features (Great Rift Valley, Lake Victoria, Kilimanjaro, Rufiji basin) in blockquotes.',
    ],
    nectaTip: 'Always state units on map-work answers (km, degrees). Bearing is clockwise from North, 3-digit figure.',
  },
  history: {
    subject: 'History',
    emoji: '🏛️',
    rules: [
      'Separate causes into social, political, and economic factors distinctly — markers award marks per category.',
      'Use timeline flow for event sequences: Event A → Event B → Event C.',
      'Ground answers in Tanzanian/East African history (colonial period, independence, Ujamaa) where relevant.',
    ],
    nectaTip: 'Write the specific factor category the question asked for, not narrative history. Name dates/leaders precisely.',
  },
  civics: {
    subject: 'Civics',
    emoji: '⚖️',
    rules: [
      'Structure essays as: Introduction (define key term) → Body (numbered points with constitutional references) → Conclusion.',
      'Reference actual Tanzanian institutions: the Constitution, Bunge/Parliament, local government, the Judiciary.',
    ],
    nectaTip: 'Don\'t give vague generic points — tie them to Tanzania\'s actual governance structure. Always include a conclusion.',
  },
  kiswahili: {
    subject: 'Kiswahili',
    emoji: '🗣️',
    rules: [
      'Distinguish between Fasihi (literature) and Sarufi (grammar) — they are graded differently.',
      'For literature: reference TIE-prescribed set books; flag if unsure which edition is current.',
      'Use correct literary terms: mhusika, dhamira, mtindo.',
    ],
    nectaTip: 'Use Kiswahili sanifu (standard), not slang/dialect. Use proper literary terminology in Fasihi answers.',
  },
  english: {
    subject: 'English',
    emoji: '📖',
    rules: [
      'Distinguish between Literature and Language question types.',
      'For composition: use clear paragraph structure, varied vocabulary, and correct grammar.',
      'Reference TIE-prescribed texts where applicable.',
    ],
    nectaTip: 'Avoid colloquial language in formal answers. Use precise literary terminology.',
  },
  computing: {
    subject: 'Computing',
    emoji: '💻',
    rules: [
      'Use pseudocode or structured flowcharts (A → B → C) for algorithm questions.',
      'Show step-by-step trace tables for program execution.',
      'Reference real-world Tanzanian applications (M-Pesa, agricultural tech) where relevant.',
    ],
    nectaTip: 'Always show the trace table or step-by-step execution. Markers award marks for each correct step.',
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
