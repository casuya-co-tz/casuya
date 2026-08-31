/** Pull visible answer text from OpenAI-compatible and Gemini-style payloads. */

export function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
}

export function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const rec = part as Record<string, unknown>;
          return String(rec.text ?? rec.content ?? rec.output_text ?? '');
        }
        return '';
      })
      .join('')
      .trim();
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return asText(rec.text ?? rec.content ?? rec.output_text ?? rec.reasoning_content);
  }
  return String(value).trim();
}

export function extractChoiceText(choice: {
  message?: Record<string, unknown>;
  delta?: Record<string, unknown>;
} | undefined): string {
  const message = choice?.message ?? {};
  const delta = choice?.delta ?? {};
  return firstNonEmpty(
    message.content,
    message.reasoning_content,
    message.reasoning,
    delta.content,
    delta.reasoning_content,
    delta.reasoning,
  );
}

export function extractGeminiText(candidate: {
  content?: { parts?: Array<{ text?: string }> };
} | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}
