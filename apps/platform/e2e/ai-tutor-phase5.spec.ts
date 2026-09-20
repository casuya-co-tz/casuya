import { expect, test } from '@playwright/test';

async function loginAsStudent(page: import('@playwright/test').Page) {
  await page.goto('/login.html');
  await page.fill('#email', 'student@casuya.co.tz');
  await page.fill('#password', 'student123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/student\/?$/);
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login.html');
  await page.fill('#email', 'admin@casuya.co.tz');
  await page.fill('#password', 'admin123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/admin\/?$/);
}

async function loginAsTeacher(page: import('@playwright/test').Page) {
  await page.goto('/login.html');
  await page.fill('#email', 'teacher@casuya.co.tz');
  await page.fill('#password', 'teacher123');
  await page.click('#submit-btn');
  await expect(page).toHaveURL(/\/teacher\/?$/);
}

function mockTutorStream(page: import('@playwright/test').Page) {
  const nectaBody = [
    '💡 **NECTA Examination Tip**',
    'Always isolate the variable before substituting values.',
  ].join('\n');

  page.route('**/ai/tutoring/explain', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: nectaBody,
        source: 'casuya-ai',
        kbHits: [],
        formatComplete: true,
        formatLevel: 'complete',
      }),
    });
  });

  return page.route('**/ai/tutoring/stream', async (route) => {
    const sse = [
      `data: ${JSON.stringify({ chunk: nectaBody + '\n\n', done: false })}\n\n`,
      `data: ${JSON.stringify({
        chunk: '',
        done: true,
        source: 'casuya-ai',
        kbHits: [],
        formatComplete: true,
        formatLevel: 'complete',
      })}\n\n`,
    ].join('');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sse,
    });
  });
}

async function openLinearEquationsLesson(page: import('@playwright/test').Page) {
  await page.locator('#student-nav [data-view="subjects"]').click();
  await page.locator('.subject-card', { hasText: 'Mathematics' }).click();
  await page.locator('.topic-card', { hasText: 'Algebra' }).click();
  await page.locator('.subtopic-card', { hasText: 'Linear Equations' }).click();
  await page.locator('.lesson-card', { hasText: 'Introduction to Linear Equations' }).click();
  await expect(page.locator('.lesson-iframe iframe')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#casuya-ai-chat-fab')).toBeVisible({ timeout: 30000 });
}

test('student AI chat works at 360px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mockTutorStream(page);
  await loginAsStudent(page);
  await openLinearEquationsLesson(page);

  const fab = page.locator('#casuya-ai-chat-fab');
  const fabBox = await fab.boundingBox();
  expect(fabBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await fab.click();
  await expect(page.locator('#casuya-ai-chat-sheet')).toBeVisible();
  await page.fill('#casuya-ai-chat-input', 'What is a linear equation?');
  await page.locator('#casuya-ai-chat-form button[type="submit"]').click();
  await expect(page.locator('.tutor-necta-tip')).toBeVisible({ timeout: 20000 });
});

test('student AI chat renders in dark mode', async ({ page }) => {
  await mockTutorStream(page);
  await loginAsStudent(page);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('casuya_theme', 'dark');
  });
  await openLinearEquationsLesson(page);
  await page.locator('#casuya-ai-chat-fab').click();
  await expect(page.locator('#casuya-ai-chat-sheet')).toBeVisible();
  await expect(page.locator('.casuya-ai-chat-panel')).toBeVisible();
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(theme).toBe('dark');
});

test('admin can dismiss a review queue item', async ({ page }) => {
  const reviewId = 'e2e-review-001';
  await page.route('**/ai/quality', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        casuya_ai: { reachable: true, kb_ready: true, provider_chain: ['groq'] },
        telemetry: { counters: {}, rates: {}, samples: [] },
        review_queue: [
          {
            id: reviewId,
            question: 'Is this answer correct?',
            response: 'Maybe — verify with your textbook.',
            lesson_id: 'lesson-1',
            subject_slug: 'mathematics',
            format_level: 'partial',
            flagged_terms: ['verify'],
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route(`**/ai/review/${reviewId}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: reviewId, status: 'dismissed' }),
      });
      return;
    }
    await route.continue();
  });

  await loginAsAdmin(page);
  await page.locator('[data-view="ai-quality"]').click();
  await expect(page.getByText('Review queue')).toBeVisible();
  await expect(page.getByText('Is this answer correct?')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('Is this answer correct?')).toHaveCount(0);
});

test('teacher translate streams chunks', async ({ page }) => {
  const translated = 'Hii ni jibu la mfano.';
  await page.route('**/ai/content/translate/stream', async (route) => {
    const sse = [
      `data: ${JSON.stringify({ chunk: translated, done: false })}\n\n`,
      `data: ${JSON.stringify({ chunk: '', done: true, source: 'casuya-ai', translatedText: translated })}\n\n`,
    ].join('');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sse,
    });
  });

  await loginAsTeacher(page);
  await page.locator('[data-view="ai-assistant"]').click();
  await expect(page.locator('#ai-translate-form')).toBeVisible();
  await page.fill('#ai-translate-form textarea[name="text"]', 'This is a sample answer.');
  await page.selectOption('#ai-translate-form select[name="target_language"]', 'Swahili');
  await page.locator('#ai-translate-form button[type="submit"]').click();
  await expect(page.locator('#ai-translate-text')).toContainText(translated, { timeout: 15000 });
});
