const HEADING_RE = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;

function stripTags(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9']+/g)
    ?.filter((w) => w.length >= 2) || [];
}

export interface LessonChunk {
  heading: string;
  text: string;
  score: number;
}

/** Split lesson HTML into heading-scoped chunks for RAG context. */
export function chunkLessonHtml(html: string, maxChunk = 1200): LessonChunk[] {
  const src = String(html || '');
  if (!src.trim()) return [];

  const chunks: LessonChunk[] = [];
  let lastIndex = 0;
  let currentHeading = 'Introduction';
  let match: RegExpExecArray | null;

  HEADING_RE.lastIndex = 0;
  while ((match = HEADING_RE.exec(src)) !== null) {
    const body = src.slice(lastIndex, match.index);
    const text = stripTags(body);
    if (text.length >= 40) {
      chunks.push({
        heading: currentHeading,
        text: text.slice(0, maxChunk),
        score: 0,
      });
    }
    currentHeading = stripTags(match[2]).slice(0, 120) || currentHeading;
    lastIndex = match.index + match[0].length;
  }

  const tail = stripTags(src.slice(lastIndex));
  if (tail.length >= 40) {
    chunks.push({ heading: currentHeading, text: tail.slice(0, maxChunk), score: 0 });
  }

  if (!chunks.length) {
    const plain = stripTags(src);
    if (plain) chunks.push({ heading: 'Lesson', text: plain.slice(0, maxChunk), score: 0 });
  }

  return chunks;
}

/** Pick the best-matching lesson chunk for a student question. */
export function selectLessonChunk(query: string, html: string, maxChars = 2000): string {
  const qTokens = new Set(tokenize(query));
  const chunks = chunkLessonHtml(html);
  if (!chunks.length) return stripTags(html).slice(0, maxChars);

  let best = chunks[0];
  let bestScore = 0;
  for (const chunk of chunks) {
    const tokens = new Set(tokenize(chunk.heading + ' ' + chunk.text));
    let overlap = 0;
    for (const t of qTokens) {
      if (tokens.has(t)) overlap += 1;
    }
    const score = overlap / Math.max(qTokens.size, 1);
    chunk.score = score;
    if (score > bestScore) {
      bestScore = score;
      best = chunk;
    }
  }

  const header = best.heading ? `## ${best.heading}\n` : '';
  return (header + best.text).slice(0, maxChars);
}
