import { expect, test } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';
import { openLinearEquationsLesson } from './helpers/student-nav';

function mockTutorStream(page: import('@playwright/test').Page) {
  const nectaBody = [
    '💡 **NECTA Examination Tip**',
    'Always isolate the variable before substituting values.',
  ].join('\n');

  const explainBody = {
    response: nectaBody,
    source: 'casuya-ai',
    kbHits: [],
    formatComplete: true,
    formatLevel: 'complete',
  };

  page.route('**/ai/tutoring/explain', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(explainBody),
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

test('student can ask AI in lesson and see NECTA tip', async ({ page }) => {
  await mockTutorStream(page);
  await loginAsStudent(page);
  await openLinearEquationsLesson(page);

  await page.locator('#casuya-ai-chat-fab').click();
  await expect(page.locator('#casuya-ai-chat-sheet')).toBeVisible();

  await page.fill('#casuya-ai-chat-input', 'What is a linear equation?');
  await page.locator('#casuya-ai-chat-form button[type="submit"]').click();

  await expect(page.locator('.tutor-necta-tip')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.tutor-necta-tip')).toContainText('NECTA');
});
