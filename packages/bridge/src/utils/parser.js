/** Lightweight parsing helpers for lesson HTML packages. */

const TITLE_RE = /<title>(.*?)<\/title>/is;
const META_RE = /<meta\s+name=["']([\w:-]+)["']\s+content=["'](.*?)["']\s*\/?>/gi;

export function parseLessonMeta(html) {
  const meta = {};

  const titleMatch = TITLE_RE.exec(html);
  if (titleMatch) meta.title = titleMatch[1].trim();

  let match;
  META_RE.lastIndex = 0;
  while ((match = META_RE.exec(html)) !== null) {
    meta[match[1]] = match[2].trim();
  }

  return meta;
}

export function parseQueryParams(url) {
  const result = {};
  const search = url.includes('?') ? url.split('?')[1] : url;
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    result[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return result;
}
