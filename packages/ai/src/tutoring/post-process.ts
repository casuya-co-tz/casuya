/**
 * Wraps bare "🌍 ... Context" lines in markdown blockquotes (>).
 * The AI model sometimes emits the context line as plain text instead of `>`.
 */
function wrapContextBlockquote(text: string): string {
  return text.replace(
    /^((?:🌍|> ?🌍|\*\*🌍|🌍 )\s*.*?Context.*)$/gm,
    (match) => {
      const cleaned = match.replace(/^>\s*/, '').replace(/^\*\*/, '');
      return `> ${cleaned}`;
    },
  );
}

/**
 * Ensures a `---` or `***` horizontal rule exists before
 * "💡 NECTA Examination Tip" if one is missing.
 */
function ensureNectaTipDivider(text: string): string {
  return text.replace(
    /(?<!^---\s*\n|^>\s*---\s*\n|^>\s*\*\*\*\s*\n|^\*\*\*\s*\n)(^(?:💡|> ?💡|\*\*💡)\s*\*?\*?NECTA Examination Tip)/gm,
    '---\n\n$1',
  );
}

/**
 * Normalizes notation quirks: "(1n)" → "(n)" for gamete chromosome counts.
 */
function cleanNotation(text: string): string {
  return text.replace(/\(1n\)/g, '(n)');
}

/**
 * Removes the literal `[next sub-topic]` placeholder and replaces it
 * with a generic but helpful suggestion.
 */
function cleanPlaceholders(text: string): string {
  return text.replace(
    /\[next sub-topic\]/gi,
    'a related topic',
  );
}

export type NectaFormatLevel = 'complete' | 'partial' | 'none';

const FORMAT_RANK: Record<NectaFormatLevel, number> = {
  none: 0,
  partial: 1,
  complete: 2,
};

/**
 * Scores how closely a tutoring answer follows the mandatory NECTA template.
 */
export function scoreNectaFormatCompliance(text: string): NectaFormatLevel {
  const hasContext = /🌍|Context|Muktadha/i.test(text);
  const hasNecta = /NECTA|Exam(?:ination)? Tip|Kidokezo cha NECTA/i.test(text);
  const hasStructure = /^#{1,3}\s/m.test(text) || /^\*\*/m.test(text) || /^>\s/m.test(text);
  const hasReview = /Review Question|Swali la Mazoezi/i.test(text);
  const score = [hasContext, hasNecta, hasStructure, hasReview].filter(Boolean).length;
  if (score >= 3) return 'complete';
  if (score >= 2) return 'partial';
  return 'none';
}

export function compareNectaFormat(a: NectaFormatLevel, b: NectaFormatLevel): number {
  return FORMAT_RANK[a] - FORMAT_RANK[b];
}

export const NECTA_FORMAT_RETRY_HINT =
  '\n\n[IMPORTANT: Your answer MUST include all mandatory NECTA tutor sections — '
  + 'a 🌍 Context blockquote, structured step-by-step explanation, *** NECTA Examination Tip ***, '
  + 'and a Review Question line.]';

/**
 * Runs all post-processing fixes on the raw AI response.
 */
export function postProcessTutoringResponse(text: string): string {
  let result = text;
  result = wrapContextBlockquote(result);
  result = ensureNectaTipDivider(result);
  result = cleanNotation(result);
  result = cleanPlaceholders(result);
  return result;
}