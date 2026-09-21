import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginAsTeacher } from './helpers/auth';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'minimal-paper.json'), 'utf8'),
);

function mockAssignmentApis(page: import('@playwright/test').Page) {
  page.route('**/lessons', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'lesson-e2e-1', title: 'Introduction to Force', subject: 'Physics' },
      ]),
    });
  });

  page.route('**/assignments/exam-presets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'necta',
        kind: 'necta',
        test_type: 'topical',
        subject_slug: 'physics',
        form_level: 4,
        duration: '1:00 Hour',
        papers: [{
          paper: 'theory',
          paper_code: '031/1',
          paper_title: 'PHYSICS 1',
          duration: '1:00 Hour',
          total_marks: 45,
          question_count: 5,
          structure_summary: 'Sec A: 2 Q (8 marks)',
          available: true,
        }],
      }),
    });
  });

  page.route('**/assignments/generate-paper', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paper: fixture.paper,
        markingScheme: fixture.markingScheme,
        generator: 'casuya-ai',
        valid: true,
        issues: [],
        context: {
          lesson_id: 'lesson-1',
          lesson_title: 'Introduction to Force',
          subject: 'Physics',
          subject_slug: 'physics',
          form_level: 4,
          topic: 'Mechanics',
        },
      }),
    });
  });

  page.route('**/assignments?*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'assignment-e2e-1', title: 'E2E Assignment' }),
      });
      return;
    }
    await route.continue();
  });
}

test('teacher can generate and preview NECTA assignment paper', async ({ page }) => {
  mockAssignmentApis(page);
  await loginAsTeacher(page);

  await page.locator('[data-view="assignments"]').click();
  await page.locator('#new-assignment-btn').click();
  await expect(page.locator('#exam-generate')).toBeVisible();

  await page.selectOption('#exam-lesson', 'lesson-e2e-1');
  await expect(page.locator('#exam-paper-chips .test-paper-chip')).toBeVisible({ timeout: 10000 });

  await page.locator('#exam-generate').click();
  await expect(page.locator('[data-exam-root]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-exam-root] .exam-page').first()).toBeVisible();
  await expect(page.locator('#exam-assign')).toBeVisible();
});
