export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(Boolean).length;
}

export function extractKeyPhrases(text: string, maxPhrases: number = 5): string[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'by', 'with', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
    'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very',
  ]);

  const freq: Map<string, number> = new Map();
  for (const word of words) {
    if (!stopWords.has(word) && word.length > 2) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPhrases)
    .map(([word]) => word);
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
