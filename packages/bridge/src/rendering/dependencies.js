/** Resolve stylesheet/script paths declared in a lesson package against apiBaseUrl.
 * Relative paths are prefixed; absolute URLs, data:, and blob: pass through. */

const ABSOLUTE_RE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

export function resolveAssetUrl(path, apiBaseUrl) {
  if (path == null || path === '') return path;
  const value = String(path);
  if (ABSOLUTE_RE.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  const rel = value.startsWith('/') ? value : `/${value}`;
  return base ? `${base}${rel}` : rel;
}

export function rewriteHtmlDependencies(html, apiBaseUrl) {
  if (!html || !apiBaseUrl) return html || '';
  return String(html).replace(
    /\b((?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,
    (match, attr, quote, url) => `${attr}${quote}${resolveAssetUrl(url, apiBaseUrl)}${quote}`
  );
}
