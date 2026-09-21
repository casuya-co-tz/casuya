import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'csee-physics-topical-paper.json');
const goldenPath = join(here, 'fixtures', 'csee-physics-topical-paper.golden.html');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadRenderer() {
  const src = readFileSync(
    join(here, '..', '..', 'frontend', 'assets', 'js', 'modules', 'exams.js'),
    'utf8',
  );
  const fn = new Function('escapeHtml', `${src}\n;return { renderExamPaper, renderExamMath };`);
  return fn(escapeHtml);
}

function normalizeHtml(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

test('renderExamPaper matches golden HTML for CSEE physics topical', () => {
  const { renderExamPaper } = loadRenderer();
  const paper = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const html = renderExamPaper(paper, { mode: 'preview', showActions: false });

  assert.match(html, /data-exam-root/);
  assert.match(html, /exam-page/);
  assert.match(html, /031/);
  assert.match(html, /mcq_bundle|exam-mcq-item/);

  if (!existsSync(goldenPath) && process.env.UPDATE_GOLDEN === '1') {
    writeFileSync(goldenPath, normalizeHtml(html), 'utf8');
  }

  if (existsSync(goldenPath)) {
    const golden = readFileSync(goldenPath, 'utf8');
    assert.equal(normalizeHtml(html), golden);
  }
});

test('renderExamPaper includes math delimiters for KaTeX', () => {
  const { renderExamPaper } = loadRenderer();
  const paper = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const html = renderExamPaper(paper, { mode: 'preview', showActions: false });
  assert.match(html, /\$F=ma\$|\$m=2\$/);
});
