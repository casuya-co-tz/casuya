/** Minimal HTML sanitization for lesson content rendered outside a sandbox
 * (e.g. plain-text previews, search snippets). Full lesson bodies are
 * rendered inside an iframe/shadow-dom sandbox instead of being sanitized
 * and inlined, so this is deliberately conservative and only used for
 * short, non-interactive fragments. */

const SCRIPT_OR_EVENT_RE = /<script[\s\S]*?<\/script>|on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const TAG_RE = /<[^>]+>/g;

export function stripScripts(html) {
  return html.replace(SCRIPT_OR_EVENT_RE, '');
}

export function stripAllTags(html) {
  return stripScripts(html).replace(TAG_RE, '');
}

export function toPlainTextSnippet(html, maxLength = 200) {
  const text = stripAllTags(html).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
