import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginAsTeacher } from './helpers/auth';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'minimal-paper.json'), 'utf8'),
);

function mockTestGeneratorApis(page: import('@playwright/test').Page) {
  page.route('**/ai/tests/presets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presets: [{
          paper: 'theory',
          paper_code: '031/1',
          paper_title: 'PHYSICS 1',
          duration: '1:00 Hour',
          total_marks: 45,
          question_count: 5,
          structure_summary: 'Sec A: 2 Q (8 marks)',
          available: true,
        }],
        testType: 'topical',
        formLevel: 4,
      }),
    });
  });

  page.route('**/syllabus/subjects/**/topics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { title: 'Mechanics', subtopics: [{ title: 'Force and Motion' }] },
      ]),
    });
  });

  page.route('**/ai/tests/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });
}

test('teacher test generator renders NECTA exam paper', async ({ page }) => {
  mockTestGeneratorApis(page);
  await loginAsTeacher(page);

  await page.locator('[data-view="test-generator"]').click();
  await expect(page.locator('#test-gen-run')).toBeVisible();

  await page.locator('.test-gen-topic-cb').first().check();
  await page.locator('#test-gen-run').click();

  await expect(page.locator('[data-exam-root]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-exam-root] .exam-page').first()).toBeVisible();
  await expect(page.locator('.exam-code-box').first()).toContainText('031');
  await expect(page.locator('[data-exam-print]')).toBeVisible();
});

test('test generator requires at least one topic', async ({ page }) => {
  mockTestGeneratorApis(page);
  await loginAsTeacher(page);

  await page.locator('[data-view="test-generator"]').click();
  await page.locator('#test-gen-run').click();
  await expect(page.locator('#test-gen-status')).toContainText(/topic/i);
});
