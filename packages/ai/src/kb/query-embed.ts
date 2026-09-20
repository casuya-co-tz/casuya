/**
 * Optional Gemini query embedding for hybrid RAG (runtime).
 * Skips silently when no Google/Gemini API key is configured.
 */

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const key = firstEnv('GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY');
  if (!key || !text?.trim()) return null;

  const model = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 2048) }] } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    return data.embedding?.values?.length ? data.embedding.values : null;
  } catch {
    return null;
  }
}
