#!/usr/bin/env node
/**
 * build-kb.mjs — Builds the Casuya knowledge-base search index.
 *
 * Scans the 2,610 JSON files in knowledge_base/ and produces a single compact
 * index (kb-data/index.json) containing:
 *   - docs:       metadata + normalized plain-text content for each document
 *   - inverted:   token -> [ [docId, termFrequency], ... ] postings (BM25-ready)
 *   - subjectCodes: NECTA subject code -> subject name map
 *   - counts:     per-kind document counts
 *
 * The runtime (src/kb/knowledge-base.ts) loads this index ONCE at boot into
 * memory, giving sub-millisecond keyword retrieval and instant RAG chunk
 * rendering with no per-request disk reads.
 *
 * Run: node scripts/build-kb.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { tokenize } from './kb-tokenizer.mjs';
import {
  renderSyllabus,
  renderExam,
  renderMarkingScheme,
  renderExamFormat,
  renderLesson,
  renderScheme,
  renderReferences,
} from './kb-renderers.mjs';
import { collectJson, classify, inferSubject } from './kb-collect.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_ROOT = join(__dirname, '..', 'knowledge_base');
const OUT_DIR = join(__dirname, '..', 'kb-data');

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const files = collectJson(KB_ROOT, []);
const docs = [];
const subjectCodes = {};

let skipped = 0;
for (const file of files) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    skipped++;
    continue;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    skipped++;
    continue;
  }

  if (data == null) { skipped++; continue; }
  const c = classify(file, KB_ROOT);
  const relPath = relative(KB_ROOT, file).split(sep).join('/');

  let title = '';
  let text = '';
  const kind = c.kind;

  if (kind === 'syllabus') {
    text = renderSyllabus(data);
    title = `${data.subject_name || ''} Syllabus (${data.subject_code || ''})`.trim();
    const code = data.subject_code;
    if (code) subjectCodes[code] = data.subject_name || code;
  } else if (kind === 'exam') {
    text = renderExam(data);
    title = `${data.subject || ''} ${data.level || ''} ${data.year || ''}`.trim();
    if (data.code) subjectCodes[data.code] = data.subject || data.code;
  } else if (kind === 'marking_scheme') {
    text = renderMarkingScheme(data);
    title = `${data.subject || ''} Marking Scheme (${data.code || ''}) ${data.year || ''}`.trim();
    if (data.code) subjectCodes[data.code] = data.subject || data.code;
  } else if (kind === 'exam_format') {
    text = renderExamFormat(data);
    title = `Exam Format ${data.subject || data.name || data.level || ''}`.trim();
  } else if (kind === 'lesson') {
    text = renderLesson(data);
    title = `Lesson Plan ${data.subject || ''} ${data.form || ''}`.trim();
  } else if (kind === 'scheme') {
    text = renderScheme(data);
    title = `Scheme of Work ${data.subject || ''} ${data.form || ''}`.trim();
  } else if (kind === 'reference') {
    text = renderReferences(data);
    title = `References ${data.level || ''} ${data.year || ''}`.trim();
  } else {
    text = '';
    title = relPath;
  }

  if (!text || text.length < 20) { skipped++; continue; }

  const subject = inferSubject(kind, data) || '';
  const tokens = tokenize(text);
  const doc = {
    id: docs.length,
    kind,
    subject,
    code: data.code || data.subject_code || undefined,
    form: c.form || data.form || undefined,
    level: data.level || undefined,
    year: data.year !== undefined ? String(data.year) : undefined,
    title,
    file: relPath,
    tokens: tokens.length,
  };
  docs.push(doc);
}

// ---------------------------------------------------------------------------
// Build inverted index with term frequency per doc
// ---------------------------------------------------------------------------
const inverted = new Map(); // term -> array of [docId, tf]

// For speed/memory, we re-tokenize each doc's text during inverted build.
function build() {
  const start = Date.now();
  for (const doc of docs) {
    let fileText;
    try {
      fileText = readFileSync(join(KB_ROOT, doc.file), 'utf8');
    } catch {
      continue;
    }
    const tokens = tokenize(fileText);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [term, count] of tf) {
      const list = inverted.get(term);
      if (list) list.push([doc.id, count]);
      else inverted.set(term, [[doc.id, count]]);
    }
  }

  // Sort postings by doc id for stability
  for (const list of inverted.values()) list.sort((a, b) => a[0] - b[0]);

  console.error(`Indexed ${docs.length} docs, ${inverted.size} terms in ${Date.now() - start}ms`);
}

// ---------------------------------------------------------------------------
// Write compact output
// ---------------------------------------------------------------------------
function writeOutput() {
  const out = {
    version: '2.0',
    generated: new Date().toISOString(),
    counts: {
      total: docs.length,
      byKind: docs.reduce((acc, d) => { acc[d.kind] = (acc[d.kind] || 0) + 1; return acc; }, {}),
    },
    docs,
    subjectCodes,
    inverted: Object.fromEntries(inverted),
  };

  const outPath = join(OUT_DIR, 'index.json');
  mkdirSync(OUT_DIR, { recursive: true });

  const json = JSON.stringify(out);
  writeFileSync(outPath, json, 'utf8');
  console.error(`Wrote ${outPath} (${(json.length / 1024 / 1024).toFixed(2)} MB)`);

  // Ship the raw KB as a single tarball: Docker's build context hits a
  // file-count limit with the 2,600+ file knowledge_base/ tree, so the
  // runtime image consumes one archive instead (see Dockerfile).
  const tarPath = join(OUT_DIR, 'knowledge.tar.gz');
  if (existsSync(tarPath)) rmSync(tarPath);
  execFileSync('tar', ['-czf', tarPath, '-C', KB_ROOT, '.']);
  console.error(`Wrote ${tarPath} (${(statSync(tarPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

build();
writeOutput();