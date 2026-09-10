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