#!/usr/bin/env node
/**
 * build-kb-embed.mjs — Generate kb-data/embeddings.json for hybrid RAG.
 *
 * Usage:
 *   node scripts/build-kb-embed.mjs [--limit N]
 *
 * Requires GEMINI_API_KEY or GOOGLE_AI_API_KEY.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'kb-data');
const KB_ROOT = join(__dirname, '..', 'knowledge_base');
const INDEX_PATH = join(OUT_DIR, 'index.json');

function env(name) {
  const v = process.env[name];
  return v?.trim() || '';
}

function apiKey() {
  return env('GEMINI_API_KEY') || env('GOOGLE_AI_API_KEY') || env('GOOGLE_API_KEY');
}

async function embedText(text, key) {
  const model = env('GEMINI_EMBED_MODEL') || 'text-embedding-004';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 2048) }] } }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const data = await res.json();
  return data.embedding?.values || null;
}

async function main() {
  if (process.argv.includes('--verify')) {
    if (!existsSync(INDEX_PATH)) {
      console.error('Missing kb-data/index.json');
      process.exit(1);
    }
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const docs = index.docs || [];
    console.error(`KB index OK (${docs.length} docs)`);
    process.exit(0);
  }

  const key = apiKey();
  if (!key) {
    console.error('Set GEMINI_API_KEY or GOOGLE_AI_API_KEY to build embeddings.');
    process.exit(1);
  }
  if (!existsSync(INDEX_PATH)) {
    console.error('Missing kb-data/index.json — run node scripts/build-kb.mjs first.');
    process.exit(1);
  }

  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 0 : 0;

  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  const docs = index.docs || [];
  const out = {};
  let done = 0;

  for (const doc of docs) {
    if (limit && done >= limit) break;
    let raw = '';
    try {
      raw = readFileSync(join(KB_ROOT, doc.file), 'utf8');
    } catch {
      continue;
    }
    const snippet = raw.replace(/\s+/g, ' ').slice(0, 1200);
    if (snippet.length < 40) continue;
    try {
      const vec = await embedText(`${doc.title}\n${snippet}`, key);
      if (vec?.length) {
        out[String(doc.id)] = vec;
        done += 1;
        if (done % 25 === 0) console.error(`Embedded ${done} docs…`);
        await new Promise((r) => setTimeout(r, 120));
      }
    } catch (err) {
      console.error(`Skip doc ${doc.id}:`, err.message || err);
    }
  }

  const outPath = join(OUT_DIR, 'embeddings.json');
  writeFileSync(outPath, JSON.stringify(out));
  console.error(`Wrote ${outPath} (${done} vectors)`);
}

main();
