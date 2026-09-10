// Tokenizer for the knowledge-base index (stopwords + tokenize).

const STOPWORDS = new Set(`
  a an and are as at be but by for from had has have he her his i if in into is
  it its me my no not of on or our she so than that the their them then there
  these they this to up was we were what when where which who will with you your
  does do did can could should would may might must shall been being am about
  after also because before between both each few how more most other over same
  some such than too under very via
`.trim().split(/\s+/));

const NECTA_VERBS = new Set();

/** Lowercase, strip punctuation, return word array. */
function tokenize(text) {
  if (!text) return [];
  const words = String(text).toLowerCase().match(/[a-z0-9']+/g) || [];
  const out = [];
  for (const w of words) {
    if (w.length < 2) continue;
    if (STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

export { STOPWORDS, NECTA_VERBS, tokenize };