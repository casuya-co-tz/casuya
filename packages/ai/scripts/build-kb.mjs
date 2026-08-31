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

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_ROOT = join(__dirname, '..', 'knowledge_base');
const OUT_DIR = join(__dirname, '..', 'kb-data');

// ---------------------------------------------------------------------------
// Tokenizer: lowercase, split on non-alphanumerics, drop stopwords + tiny terms
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Document extraction from the various KB JSON shapes
// ---------------------------------------------------------------------------

function normSubject(s) {
  return (s || '')
    .replace(/_/g, ' ')
    .replace(/\bOLE\b|\bO level\b|\bO-Level\b/gi, '')
    .trim();
}

/** Recursively gather all *.json file paths (excluding pdfs + .gitignore). */
function collectJson(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'pdfs') continue;
      collectJson(full, out);
    } else if (entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/** Render a syllabus doc into a searchable + RAG-ready text block. */
function renderSyllabus(data) {
  const lines = [];
  lines.push(`SYLLABUS: ${data.subject_name || ''} (${data.subject_code || ''})`);
  lines.push(`LEVEL: ${data.level || ''}`);
  if (Array.isArray(data.units)) {
    for (const unit of data.units) {
      lines.push('');
      lines.push(`UNIT ${unit.unit_number}: ${unit.unit_title} (Form ${unit.form})`);
      if (Array.isArray(unit.topics)) {
        for (const topic of unit.topics) {
          lines.push(`  TOPIC ${topic.competence_code}: ${topic.topic_name}`);
          if (Array.isArray(topic.lessons)) {
            for (const lesson of topic.lessons) {
              let entry = `    LESSON ${lesson.lesson_id}: ${lesson.title}`;
              if (lesson.markdown_content && lesson.markdown_content !== lesson.title) {
                entry += `\n${stripMd(lesson.markdown_content)}`;
              }
              lines.push(entry);
            }
          }
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

function stripMd(md) {
  return String(md)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MCQ_WORDS = new Set('which what how why who where when choose answer given alternatives'.split(' '));

/** Render an exam doc (past paper or internal). */
function renderExam(data) {
  const lines = [];
  lines.push(`EXAM: ${data.subject || ''} ${data.year || ''}`);
  lines.push(`LEVEL: ${data.level || ''}`);
  if (data.form) lines.push(`FORM: ${data.form}`);
  if (data.duration) lines.push(`DURATION: ${data.duration}`);
  if (data.total_marks) lines.push(`TOTAL MARKS: ${data.total_marks}`);
  if (data.instructions) lines.push(`INSTRUCTIONS: ${data.instructions}`);
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      lines.push('');
      lines.push(`SECTION ${sec.name}: ${sec.instructions || ''} (${sec.marks != null ? sec.marks + ' marks' : ''})`.trim());
      if (Array.isArray(sec.questions)) {
        for (const q of sec.questions) {
          const label = q.number != null ? `Q${q.number}` : '';
          const type = q.type ? `[${q.type}]` : '';
          const text = stripMd(q.text || q.question || '');
          // Trim redundant "Choose Answer : -" tails
          const clean = text.replace(/choose answer\s*:[:\s-]*$/i, '').trim();
          if (clean) lines.push(`  ${label} ${type} ${clean}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render a marking scheme. */
function renderMarkingScheme(data) {
  const lines = [];
  lines.push(`MARKING SCHEME: ${data.subject || ''} (${data.code || ''})`);
  lines.push(`LEVEL: ${data.level || ''} | YEAR: ${data.year || ''} | MAX MARKS: ${data.max_marks != null ? data.max_marks : ''}`);
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      lines.push('');
      lines.push(`SECTION ${sec.name} (${sec.marks != null ? sec.marks + ' marks' : ''})`);
      if (Array.isArray(sec.questions)) {
        for (const q of sec.questions) {
          const answers = Array.isArray(q.answers) ? q.answers.join(', ') : (q.answer || '');
          lines.push(`  Q${q.number} [${q.type || ''}] answers: ${answers}`);
          if (q.detail) lines.push(`    ${q.detail}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render exam format (large parsed spec). */
function renderExamFormat(data) {
  const lines = [];
  const name = data.subject || data.name || data.level || 'Exam Format';
  lines.push(`EXAM FORMAT: ${name}`);
  if (data.level) lines.push(`LEVEL: ${data.level}`);
  if (data.duration) lines.push(`DURATION: ${data.duration}`);
  if (data.total_marks) lines.push(`TOTAL MARKS: ${data.total_marks}`);
  if (Array.isArray(data.subjects)) {
    for (const s of data.subjects) {
      const subjName = s.subject || s.name || s.code || '';
      lines.push('');
      lines.push(`SUBJECT: ${subjName}`);
      if (s.code) lines.push(`  CODE: ${s.code}`);
      if (s.duration) lines.push(`  DURATION: ${s.duration}`);
      if (s.total_marks) lines.push(`  TOTAL MARKS: ${s.total_marks}`);
      if (Array.isArray(s.sections)) {
        for (const sec of s.sections) {
          const sn = sec.name || sec.section || 'Section';
          lines.push(`  ${sn} (${sec.marks || sec.marks_percentage || ''}${sec.marks ? ' marks' : ''})`);
          const desc = sec.description || sec.instructions || sec.notes || sec.items_description || '';
          if (desc) lines.push(`    ${stripMd(String(desc))}`);
          if (Array.isArray(sec.items)) {
            for (const it of sec.items.slice(0, 40)) {
              const itemText = `${it.number || it.item || ''} ${it.type || ''} ${stripMd(String(it.description || it.instructions || ''))}`.trim();
              if (itemText) lines.push(`    - ${itemText}`);
            }
          }
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render a lesson plan. */
function renderLesson(data) {
  const lines = [];
  lines.push(`LESSON PLAN: ${data.subject || ''} ${data.form || ''}`);
  if (Array.isArray(data.topics)) {
    for (const t of data.topics) {
      lines.push('');
      lines.push(`TOPIC ${t.topic_number}: ${t.topic_name}`);
      const p = t.plan || {};
      if (p.competence) lines.push(`  COMPETENCE: ${p.competence}`);
      if (p.general_objectives) lines.push(`  GENERAL OBJECTIVES: ${p.general_objectives}`);
      if (p.specific_objectives) lines.push(`  SPECIFIC OBJECTIVES: ${p.specific_objectives}`);
      if (p.main_topic) lines.push(`  MAIN TOPIC: ${p.main_topic}`);
      if (p.sub_topic) lines.push(`  SUB TOPIC: ${p.sub_topic}`);
      if (p.teaching_aids) lines.push(`  TEACHING AIDS: ${p.teaching_aids}`);
      if (Array.isArray(p.teaching_structure)) {
        for (const st of p.teaching_structure) {
          const stage = st.stage || 'Stage';
          lines.push(`  ${stage} (${st.time || ''} min): TEACHER: ${st.teacher_activities || ''} | STUDENT: ${st.student_activities || ''}`);
        }
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

/** Render a scheme of work. */
function renderScheme(data) {
  const json = JSON.stringify(data);
  // Schemes have varied shapes; fall back to a compact pretty-print of key table rows.
  const lines = [];
  for (const key of ['subject', 'form', 'academic_year', 'scheme_name', 'term']) {
    if (data[key]) lines.push(`${String(key).toUpperCase()}: ${data[key]}`);
  }
  const weekRows = collectSchemeRows(data);
  if (weekRows.length) {
    lines.push('');
    for (const row of weekRows) lines.push(`- ${row}`);
  }
  if (lines.length === 0 || lines.length <= 3) {
    return json.replace(/[{}\[\],"]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return lines.join('\n');
}

function collectSchemeRows(obj, out = [], depth = 0) {
  if (depth > 4) return out;
  if (Array.isArray(obj)) {
    for (const item of obj) collectSchemeRows(item, out, depth + 1);
    return out;
  }
  if (obj && typeof obj === 'object') {
    const textish = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === 'string' && /week|topic|competence|objective|activity|lesson|sub.?topic|period|date/i.test(k)) {
        if (v.trim()) textish.push(`${k}: ${v.trim()}`);
      }
    }
    if (textish.length) out.push(textish.join(' | '));
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') collectSchemeRows(v, out, depth + 1);
    }
  }
  return out;
}

/** Render a references file (subject -> list of citations). */
function renderReferences(data) {
  const lines = [];
  for (const [subject, refs] of Object.entries(data)) {
    lines.push(`REFERENCES — ${subject}`);
    if (Array.isArray(refs)) {
      for (const r of refs.slice(0, 400)) {
        const text = r.full_text || (r.author ? `${r.author} (${r.year || ''}) ${r.title}` : (r.title || ''));
        if (text) lines.push(`- ${text}`);
      }
    }
  }
  return lines.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Doc classification by path
// ---------------------------------------------------------------------------

function classify(file) {
  const rel = relative(KB_ROOT, file).split(sep);
  const [top, sub] = rel;
  if (top === 'syllabi') {
    return { kind: 'syllabus', form: sub === 'a_level' ? 'a' : 'o' };
  }
  if (top === 'exams') {
    if (sub === 'internal') {
      const formDir = rel[2] || '';
      return { kind: 'exam', form: formDir };
    }
    return { kind: 'exam', level: sub }; // ftna | csee | acsee
  }
  if (top === 'marking_schemes') return { kind: 'marking_scheme' };
  if (top === 'exam_formats') {
    if (sub === 'parsed') return { kind: 'exam_format' };
    if (sub === 'templates') return { kind: 'template' };
    return { kind: 'exam_format' };
  }
  if (top === 'lessons') return { kind: 'lesson', form: sub };
  if (top === 'schemes') return { kind: 'scheme', form: sub };
  if (top === 'references') return { kind: 'reference' };
  return { kind: 'other' };
}

function inferSubject(kind, data) {
  if (!data) return undefined;
  if (data.subject_name) return data.subject_name;
  if (data.subject) return normSubject(data.subject);
  if (data.code && typeof data.code === 'string' && data.code.length <= 3) return data.subject;
  return undefined;
}

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
  const c = classify(file);
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
