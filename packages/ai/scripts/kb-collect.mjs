// File walking + doc classification for the knowledge-base index build.

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { normSubject } from './kb-renderers.mjs';

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

function classify(file, kbRoot) {
  const rel = relative(kbRoot, file).split(sep);
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

export { collectJson, classify, inferSubject };