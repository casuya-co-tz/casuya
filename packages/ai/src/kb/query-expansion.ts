/**
 * Swahili ↔ English syllabus term expansion for BM25 retrieval.
 * Phase 3B: helps Kiswahili student questions match English KB docs.
 */

const SW_EN_GLOSSARY: Record<string, string[]> = {
  photosynthesis: ['usanisi', 'photosynthesis', 'chlorophyll', 'klorofili'],
  respiration: ['pumzi', 'respiration', 'breathing'],
  equation: ['milinganyo', 'equation', 'algebra', 'hisabati'],
  fraction: ['sehemu', 'fraction', 'ratio', 'uwiano'],
  force: ['nguvu', 'force', 'motion', 'mwendo'],
  energy: ['nguvu', 'energy', 'work', 'kazi'],
  acid: ['asidi', 'acid', 'base', 'besi', 'alkali'],
  atom: ['atomu', 'atom', 'element', 'elementi'],
  cell: ['seli', 'cell', 'tissue', 'tishu'],
  reproduction: ['uzazi', 'reproduction', 'sexual', 'kijinsia'],
  linear: ['mstari', 'linear', 'graph', 'grafu'],
  variable: ['kigeu', 'variable', 'unknown', 'haijulikani'],
  triangle: ['pembetatu', 'triangle', 'angle', 'pembe'],
  circle: ['duara', 'circle', 'radius', 'radi'],
  probability: ['uwezekano', 'probability', 'chance'],
  density: ['msongamano', 'density', 'mass', 'uzito'],
  volume: ['ujazo', 'volume', 'capacity'],
  temperature: ['joto', 'temperature', 'heat', 'mkao'],
  velocity: ['kasi', 'velocity', 'speed'],
  gravity: ['mvuto', 'gravity', 'weight', 'uzito'],
  electricity: ['umeme', 'electricity', 'current', 'mkondo'],
  magnet: ['sumaku', 'magnet', 'magnetic'],
  water: ['maji', 'water', 'hydrogen', 'hidrojeni', 'oxygen', 'oksijeni'],
  carbon: ['kaboni', 'carbon', 'dioxide', 'dioksidi'],
  plant: ['mmea', 'plant', 'vegetation'],
  animal: ['mnyama', 'animal', 'organism', 'kiumbe'],
  exam: ['mtihani', 'exam', 'necta', 'csee'],
  define: ['fafanua', 'define', 'definition', 'ufafanuzi'],
  explain: ['eleza', 'explain', 'explanation'],
  calculate: ['hesabu', 'calculate', 'computation'],
};

/** Return extra search terms derived from the query via the glossary. */
export function expandQueryTerms(query: string): string[] {
  const lower = String(query || '').toLowerCase();
  const words = lower.match(/[a-z0-9']+/g) || [];
  const expanded = new Set<string>();

  for (const word of words) {
    if (word.length < 3) continue;
    expanded.add(word);
    for (const [canonical, variants] of Object.entries(SW_EN_GLOSSARY)) {
      const all = [canonical, ...variants];
      if (all.some((v) => v === word || word.includes(v) || v.includes(word))) {
        all.forEach((v) => expanded.add(v));
      }
    }
  }

  return [...expanded];
}

/** Append expanded terms to the query string for BM25. */
export function expandQuery(query: string): string {
  const extras = expandQueryTerms(query).filter((t) => !query.toLowerCase().includes(t));
  if (!extras.length) return query;
  return `${query} ${extras.join(' ')}`.trim();
}
