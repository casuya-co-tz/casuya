import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginAsTeacher } from './helpers/auth';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'minimal-paper.json'), 'utf8'),
);

function mockAssignmentApis(page: import('@playwright/test').Page) {
  // Created assignments are kept in memory so the reload triggered by the
  // Assign action can be observed. Registered first: Playwright evaluates
  // route handlers in reverse registration order, so the more specific
  // routes below win and everything else falls through to the network.
  const created: Array<Record<string, unknown>> = [];
  page.route('**/assignments*', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/\/+$/, '');
    if (!path.endsWith('/assignments')) {
      await route.continue();
      return;
    }
    if (req.method() === 'POST') {
      const params = new URL(req.url()).searchParams;
      const record = {
        id: `assignment-e2e-${created.length + 1}`,
        title: params.get('title') || 'Assignment',
        lesson_id: params.get('lesson_id') || 'lesson-e2e-1',
        due_date: params.get('due_date') || '',
        status: 'active',
      };
      created.push(record);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

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
        generator: 'local',
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
}

test('teacher can generate and preview NECTA assignment paper', async ({ page }) => {
  mockAssignmentApis(page);
  await loginAsTeacher(page);

  await page.locator('[data-view="assignments"]').click();
  await expect(page.locator('#new-assignment-btn')).toBeVisible({ timeout: 15000 });
  await page.locator('#new-assignment-btn').click();
  await expect(page.locator('#exam-generate')).toBeVisible({ timeout: 15000 });

  await page.selectOption('#exam-lesson', 'lesson-e2e-1');
  await expect(page.locator('#exam-paper-chips .test-paper-chip')).toBeVisible({ timeout: 10000 });

  await page.locator('#exam-generate').click();
  await expect(page.locator('[data-exam-root]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-exam-root] .exam-page').first()).toBeVisible();
  await expect(page.locator('#exam-assign')).toBeVisible();

  // Actually assign it: the POST must persist and the reloaded list must show
  // the new assignment (previously the click was never exercised). The static
  // frontend caches GETs in memory for 30s, so clear it first — the initial
  // list load already cached the (empty) result.
  const postAssignments = page.waitForRequest(
    (req) => req.url().includes('/assignments') && req.method() === 'POST',
    { timeout: 15000 },
  );
  await page.evaluate(() => window.clearRequestCaches?.());
  await page.locator('#exam-assign').click();
  const posted = await postAssignments;
  expect(posted.url()).toContain('lesson_id=lesson-e2e-1');

  await expect(page.locator('[data-open-assignment="assignment-e2e-1"]')).toBeVisible({
    timeout: 15000,
  });
  // The card shows the generated paper's title, proving the payload round-tripped.
  await expect(page.locator('.card h4', { hasText: 'PHYSICS' }).first()).toBeVisible();
});
